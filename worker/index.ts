import {
  type Listen, type ListenEnv, type NowPlaying, type TopKind, PERIODS, artistGenres, countBetween, coverArt, getMeta, isOwner, nowPlaying,
  periodStart, recent, setMeta, sync, timestampsSince, top, totals, weeklyChartList,
} from "./listens";

interface Env extends ListenEnv {
  ASSETS: Fetcher;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  LIMIT_LASTFM: RateLimit;
  LIMIT_API: RateLimit;
  LIMIT_ARTWORK: RateLimit;
}

const CANONICAL_HOST = "ryplay.ryanpolasky.com";
const LEGACY_HOSTS = new Set(["ryplay.dev", "www.ryplay.dev"]);
const ARTWORK_TTL = 6 * 60 * 60;
const HOUR = 60 * 60;
const GRACE_PERIOD = 25;
const MEM_MAX = 500;
const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;
const ARTWORK_REDIRECT_HOSTS = ["coverartarchive.org", "archive.org"];

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

class TtlMap<V> {
  private m = new Map<string, { v: V; ts: number }>();
  constructor(private ttl: number) {}
  get(k: string): { v: V } | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (Date.now() / 1000 - e.ts > this.ttl) {
      this.m.delete(k);
      return undefined;
    }
    return { v: e.v };
  }
  set(k: string, v: V) {
    this.m.delete(k);
    if (this.m.size >= MEM_MAX) this.m.delete(this.m.keys().next().value!);
    this.m.set(k, { v, ts: Date.now() / 1000 });
  }
}

const artworkCache = new TtlMap<{ url: string | null; durationMs: number | null }>(ARTWORK_TTL);
const graceCache = new TtlMap<Json>(GRACE_PERIOD);
let spotifyToken: { token: string; expiresAt: number } | null = null;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Free plan caps external subrequests at 50 per invocation; fallbacks stop early instead of crashing.
class Ctx {
  used = 0;
  constructor(public env: Env, public budget = 45) {}
  async fetch(input: string | URL, init?: RequestInit): Promise<Response | null> {
    if (this.used >= this.budget) return null;
    this.used++;
    try {
      const r = await fetch(input, { ...init, signal: AbortSignal.timeout(8000) });
      if (!r.ok && (r.status < 300 || r.status >= 400)) console.warn(`upstream ${r.status} ${new URL(input).hostname}`);
      return r;
    } catch {
      return null;
    }
  }
  async json(input: string | URL, init?: RequestInit): Promise<Json | null> {
    const r = await this.fetch(input, init);
    if (!r) return null;
    try {
      return await r.json();
    } catch {
      return null;
    }
  }
}

async function md5(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const trackKey = (artist: string, title: string) => md5(`${artist}|${title}`);

async function searchItunes(c: Ctx, term: string, entity: string): Promise<string | null> {
  const u = new URL("https://itunes.apple.com/search");
  u.search = new URLSearchParams({ term, media: "music", entity, limit: "1" }).toString();
  const r = (await c.json(u))?.results?.[0];
  const art: string | undefined = r?.artworkUrl100 || r?.artworkUrl60;
  return art ? art.replace("100x100", "600x600").replace("60x60", "600x600") : null;
}

async function searchDeezerArtist(c: Ctx, name: string): Promise<string | null> {
  const r = (await c.json(`https://api.deezer.com/search/artist?${new URLSearchParams({ q: name, limit: "1" })}`))?.data?.[0];
  return r?.picture_xl || r?.picture_big || r?.picture_medium || null;
}

async function searchDeezerTrack(c: Ctx, q: string): Promise<string | null> {
  const a = (await c.json(`https://api.deezer.com/search/track?${new URLSearchParams({ q, limit: "1" })}`))?.data?.[0]?.album;
  return a?.cover_xl || a?.cover_big || a?.cover_medium || null;
}

async function getSpotifyToken(c: Ctx): Promise<string | null> {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = c.env;
  if (!id || !secret) return null;
  if (spotifyToken && Date.now() / 1000 < spotifyToken.expiresAt - 60) return spotifyToken.token;
  const data = await c.json("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!data?.access_token) return null;
  spotifyToken = { token: data.access_token, expiresAt: Date.now() / 1000 + (data.expires_in ?? 3600) };
  return spotifyToken.token;
}

async function spotifySearch(c: Ctx, q: string, type: "artist" | "track"): Promise<Json | null> {
  const token = await getSpotifyToken(c);
  if (!token) return null;
  const u = `https://api.spotify.com/v1/search?${new URLSearchParams({ q, type, limit: "1" })}`;
  return c.json(u, { headers: { Authorization: `Bearer ${token}` } });
}

async function searchSpotifyArtist(c: Ctx, name: string): Promise<string | null> {
  return (await spotifySearch(c, name, "artist"))?.artists?.items?.[0]?.images?.[0]?.url ?? null;
}

async function searchSpotifyTrack(c: Ctx, artist: string, title: string): Promise<{ art: string | null; durationMs: number | null }> {
  const t = (await spotifySearch(c, `artist:${artist} track:${title}`, "track"))?.tracks?.items?.[0];
  return { art: t?.album?.images?.[0]?.url ?? null, durationMs: t?.duration_ms ?? null };
}

async function resolveArtwork(c: Ctx, artist: string, title: string, fallback = "", album = "") {
  const key = await trackKey(artist, title);
  const cached = artworkCache.get(key);
  if (cached) return { url: cached.v.url ?? fallback, durationMs: cached.v.durationMs };

  const spotify = await searchSpotifyTrack(c, artist, title);
  const durationMs = spotify.durationMs;
  let art = spotify.art;
  art ||= await searchDeezerTrack(c, `${artist} ${title}`);
  if (!art && !fallback) art = await searchItunes(c, `${artist} ${title}`, "song");
  if (!art && !fallback && album) art = await searchItunes(c, `${artist} ${album}`, "album");
  art ||= fallback || null;
  artworkCache.set(key, { url: art, durationMs });
  return { url: art ?? "", durationMs };
}

const listenUrl = (artist: string, title: string) =>
  `https://musicbrainz.org/search?type=recording&query=${encodeURIComponent(`${title} ${artist}`)}`;

type RecentTrack = { title: string; artist: string; album: string; artworkUrl: string; trackUrl: string; timestamp: number; streak?: number };

function collapseRecent(listens: Listen[]): RecentTrack[] {
  const out: RecentTrack[] = [];
  for (const l of listens) {
    const last = out[out.length - 1];
    if (last && last.title === l.track && last.artist === l.artist) {
      last.streak = (last.streak ?? 1) + 1;
      continue;
    }
    if (out.length >= 12) break;
    out.push({ title: l.track, artist: l.artist, album: l.album, artworkUrl: coverArt(l), trackUrl: listenUrl(l.artist, l.track), timestamp: l.ts });
  }
  for (const r of out) if (r.streak === 1) delete r.streak;
  return out;
}

function requireOwner(env: Env, user: string) {
  if (!isOwner(env, user)) throw new HttpError(404, "User not found");
}

// Personal now-playing feed: the cron polls Spotify's currently-playing endpoint
// each minute (ListenBrainz's Spotify importer only syncs history, never now-playing)
// and stashes the result in D1; API responses prefer it over the ListenBrainz
// playing-now endpoint.
type SpotifyNow = NowPlaying & { art: string | null; progressMs: number | null; at: number };
type StoredSpotifyNow = SpotifyNow & { isPlaying: boolean };

async function spotifyTokenPost(env: Env, body: URLSearchParams): Promise<Json | null> {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body,
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) return null;
  return r.json().catch(() => null);
}

async function spotifyAccessToken(env: Env): Promise<string | null> {
  const cached = JSON.parse((await getMeta(env, "spotify.access")) ?? "null") as { token: string; exp: number } | null;
  if (cached && Date.now() / 1000 < cached.exp - 60) return cached.token;
  const refresh = await getMeta(env, "spotify.refresh");
  if (!refresh || !env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return null;
  const data = await spotifyTokenPost(env, new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }));
  if (!data?.access_token) return null;
  if (data.refresh_token) await setMeta(env, "spotify.refresh", data.refresh_token);
  await setMeta(env, "spotify.access", JSON.stringify({ token: data.access_token, exp: Date.now() / 1000 + (data.expires_in ?? 3600) }));
  return data.access_token;
}

async function spotifyPoll(env: Env) {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return;
  const token = await spotifyAccessToken(env);
  if (!token) return;
  const r = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (r?.status === 204 || r?.status === 404) {
    await setMeta(env, "spotify.now", JSON.stringify({ isPlaying: false, at: Math.floor(Date.now() / 1000) }));
    return;
  }
  const data = r?.ok ? ((await r.json().catch(() => null)) as Json | null) : null;
  if (!data) return; // keep the last state on upstream errors; readers reject stale entries
  const item = data.item;
  const state: StoredSpotifyNow = {
    isPlaying: !!(data.is_playing && item?.type === "track"),
    artist: item?.artists?.[0]?.name ?? "",
    track: item?.name ?? "",
    album: item?.album?.name ?? "",
    durationMs: typeof item?.duration_ms === "number" ? item.duration_ms : null,
    progressMs: typeof data.progress_ms === "number" ? data.progress_ms : null,
    art: item?.album?.images?.[0]?.url ?? null,
    at: Math.floor(Date.now() / 1000),
  };
  await setMeta(env, "spotify.now", JSON.stringify(state));
}

const SPOTIFY_NOW_STALE = 180;

async function liveNow(env: Env): Promise<(NowPlaying & { art?: string | null }) | null> {
  const raw = await getMeta(env, "spotify.now").catch(() => null);
  if (raw) {
    const s = JSON.parse(raw) as StoredSpotifyNow;
    if (s.isPlaying && Date.now() / 1000 - s.at <= SPOTIFY_NOW_STALE) {
      return { artist: s.artist, track: s.track, album: s.album, durationMs: s.durationMs, art: s.art };
    }
  }
  return nowPlaying(env);
}

async function getMusic(c: Ctx, user: string) {
  requireOwner(c.env, user);
  const [listens, playing] = await Promise.all([recent(c.env, 60), liveNow(c.env)]);
  if (!listens.length && !playing) return graceCache.get(user)?.v ?? { isPlaying: false, recentTracks: [] };

  const recentTracks = collapseRecent(listens);
  const head = playing ?? { artist: listens[0].artist, track: listens[0].track, album: listens[0].album, durationMs: listens[0].duration_ms };
  const headListen = listens.find((l) => l.artist === head.artist && l.track === head.track);

  const [headArt] = await Promise.all([
    playing?.art ? { url: playing.art, durationMs: null } : resolveArtwork(c, head.artist, head.track, headListen ? coverArt(headListen) : "", head.album),
    ...recentTracks.map(async (r) => {
      r.artworkUrl = (await resolveArtwork(c, r.artist, r.title, r.artworkUrl, r.album)).url;
    }),
  ]);

  const base = { title: head.track, artist: head.artist, album: head.album, artworkUrl: headArt.url, trackUrl: listenUrl(head.artist, head.track) };

  if (playing) {
    const durationMs = playing.durationMs ?? headArt.durationMs;
    const result: Json = { isPlaying: true, ...base, recentTracks };
    if (durationMs) result.durationMs = durationMs;
    graceCache.set(user, result);
    return result;
  }

  const grace = graceCache.get(user);
  if (grace) return grace.v;
  return { isPlaying: false, ...base, updatedAt: listens[0].ts, recentTracks };
}

async function getStats(c: Ctx, user: string) {
  requireOwner(c.env, user);
  const [t, artists, tracks, albums] = await Promise.all([
    totals(c.env), top(c.env, "artists", 0, 5), top(c.env, "tracks", 0, 5), top(c.env, "albums", 0, 1),
  ]);
  const days = t.first ? Math.max(1, Math.floor((Date.now() / 1000 - t.first) / 86400)) : 1;
  const topGenre = artists.length ? (await artistGenres(c.env, [artists[0].name]))[artists[0].name] ?? null : null;
  const artistOut = (a: { name: string; playcount: number }) => ({ name: a.name, playcount: a.playcount });
  const trackOut = (r: { name: string; artist: string; playcount: number }) => ({ name: r.name, artist: r.artist, playcount: r.playcount });
  return {
    totalScrobbles: t.scrobbles,
    totalArtists: t.artists,
    totalTracks: t.tracks,
    totalAlbums: t.albums,
    avgDaily: Math.round(t.scrobbles / days),
    memberSince: t.first,
    topArtist: artists[0] ? artistOut(artists[0]) : null,
    topArtists: artists.map(artistOut),
    topTrack: tracks[0] ? trackOut(tracks[0]) : null,
    topTracks: tracks.map(trackOut),
    topAlbum: albums[0] ? trackOut(albums[0]) : null,
    topGenre,
  };
}

const TOP_ENTITY: Record<TopKind, string> = { artists: "musicArtist", tracks: "song", albums: "album" };

async function getTop(c: Ctx, type: TopKind, user: string, period: string, limit: number) {
  requireOwner(c.env, user);
  const rows = await top(c.env, type, periodStart(period), limit);
  const items = rows.map((r) => ({
    name: r.name,
    subtitle: r.artist,
    playcount: r.playcount,
    imageUrl: "",
    url: type === "artists" ? `https://musicbrainz.org/search?type=artist&query=${encodeURIComponent(r.name)}` : listenUrl(r.artist, r.name),
    caa: coverArt(r),
  }));

  await Promise.all(
    items.map(async (e) => {
      const cacheKey = await trackKey(type, e.name + e.subtitle);
      const cached = artworkCache.get(cacheKey);
      if (cached) {
        e.imageUrl = cached.v.url ?? "";
        return;
      }
      const query = e.subtitle ? `${e.subtitle} ${e.name}` : e.name;
      let art: string | null;
      if (type === "artists") {
        art = await searchSpotifyArtist(c, e.name);
        art ||= await searchDeezerArtist(c, e.name);
        art ||= await searchItunes(c, query, TOP_ENTITY[type]);
      } else {
        art = (await searchSpotifyTrack(c, e.subtitle, e.name)).art;
        art ||= e.caa || null;
        art ||= await searchItunes(c, query, TOP_ENTITY[type]);
        art ||= await searchDeezerTrack(c, query);
      }
      artworkCache.set(cacheKey, { url: art, durationMs: null });
      e.imageUrl = art ?? "";
    }),
  );
  return items.map(({ caa: _caa, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
}

const GENRE_PERIOD_LIMITS: Record<string, number> = {
  "7day": 20, "1month": 50, "3month": 80, "6month": 120, "12month": 150, overall: 200,
};

async function getGenres(c: Ctx, user: string, period: string) {
  requireOwner(c.env, user);
  const artists = await top(c.env, "artists", periodStart(period), GENRE_PERIOD_LIMITS[period] ?? 50);
  const genres = await artistGenres(c.env, artists.map((a) => a.name));
  const weights = new Map<string, number>();
  for (const a of artists) {
    const g = genres[a.name];
    if (!g) continue;
    for (const part of g.split("/").map((p) => p.trim()).filter(Boolean)) weights.set(part, (weights.get(part) ?? 0) + a.playcount);
  }
  const sorted = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = sorted.reduce((s, [, w]) => s + w, 0);
  return sorted.map(([name, w]) => ({ name, weight: total > 0 ? Math.round((w / total) * 1000) / 1000 : 0 }));
}

function tzParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second,
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday),
  };
}

function localMidnightUts(y: number, mo: number, d: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d);
  const p = tzParts(new Date(guess), tz);
  const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - guess;
  return Math.floor((guess - offset) / 1000);
}

async function getClock(c: Ctx, user: string, tzIn: string) {
  requireOwner(c.env, user);
  let tz = "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tzIn });
    tz = tzIn;
  } catch {
    /* fall back to UTC */
  }
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const now = tzParts(new Date(), tz);
  const start = new Date(Date.UTC(now.y, now.mo - 1, now.d - 6));
  const cutoff = localMidnightUts(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), tz);
  for (const uts of await timestampsSince(c.env, cutoff)) {
    const p = tzParts(new Date(uts * 1000), tz);
    grid[p.weekday][p.h]++;
  }
  return grid;
}

const lfImage = (url: string) => [
  { size: "small", "#text": url }, { size: "medium", "#text": url }, { size: "large", "#text": url }, { size: "extralarge", "#text": url },
];
const lfError = (status: number, error: number, message: string) => json({ error, message }, 0, status);
const intParam = (url: URL, name: string, def: number, max = Infinity) =>
  Math.min(max, Math.max(1, parseInt(url.searchParams.get(name) ?? "") || def));

// Read-only Last.fm-shaped view over the local listen mirror, so older consumers keep working unchanged.
async function lastfmCompat(c: Ctx, url: URL): Promise<Response> {
  const env = c.env;
  const method = (url.searchParams.get("method") ?? "").toLowerCase();
  const user = url.searchParams.get("user") ?? "";
  if (!isOwner(env, user)) return lfError(404, 6, "User not found");
  const name = env.LB_USER;
  const limit = intParam(url, "limit", 50, 1000);
  const page = intParam(url, "page", 1);
  const offset = (page - 1) * limit;
  const attr = (total: number) => ({ user: name, page: String(page), perPage: String(limit), totalPages: String(Math.max(1, Math.ceil(total / limit))), total: String(total) });

  switch (method) {
    case "user.getinfo": {
      const t = await totals(env);
      return json({
        user: {
          name, realname: "", url: `https://listenbrainz.org/user/${name}/`, image: [],
          playcount: String(t.scrobbles), artist_count: String(t.artists), track_count: String(t.tracks), album_count: String(t.albums),
          registered: { unixtime: String(t.first), "#text": t.first },
        },
      }, 300);
    }
    case "user.getrecenttracks": {
      const from = parseInt(url.searchParams.get("from") ?? "") || 0;
      const to = parseInt(url.searchParams.get("to") ?? "") || 2 ** 31;
      const nowTs = Math.floor(Date.now() / 1000);
      const [rows, total, playing] = await Promise.all([
        recent(env, Math.min(limit, 200), from, to, offset), countBetween(env, from, to), page === 1 && to >= nowTs ? liveNow(env) : null,
      ]);
      const track: Json[] = rows.map((l) => ({
        name: l.track, artist: { "#text": l.artist, mbid: l.artist_mbid ?? "" }, album: { "#text": l.album, mbid: l.release_mbid ?? "" },
        image: lfImage(coverArt(l)), url: listenUrl(l.artist, l.track), streamable: "0",
        date: { uts: String(l.ts), "#text": new Date(l.ts * 1000).toUTCString() },
      }));
      if (playing) {
        const art = rows.find((l) => l.artist === playing.artist && l.track === playing.track);
        track.unshift({
          name: playing.track, artist: { "#text": playing.artist, mbid: "" }, album: { "#text": playing.album, mbid: "" },
          image: lfImage(art ? coverArt(art) : (playing.art ?? "")), url: listenUrl(playing.artist, playing.track), streamable: "0", "@attr": { nowplaying: "true" },
        });
      }
      return json({ recenttracks: { track, "@attr": attr(total) } });
    }
    case "user.gettopartists":
    case "user.gettoptracks":
    case "user.gettopalbums": {
      const kind = method.slice("user.gettop".length) as TopKind;
      const period = url.searchParams.get("period") ?? "overall";
      const rows = await top(env, kind, periodStart(period in PERIODS ? period : "overall"), limit, offset);
      const items = rows.map((r, i) => ({
        name: r.name, playcount: String(r.playcount), url: listenUrl(r.artist, r.name), image: lfImage(coverArt(r)),
        "@attr": { rank: String(offset + i + 1) },
        ...(kind === "artists" ? {} : { artist: { name: r.artist, url: "", mbid: "" } }),
      }));
      const root = `top${kind}`;
      return json({ [root]: { [kind.slice(0, -1)]: items, "@attr": { ...attr(items.length), user: name } } }, 600);
    }
    case "user.getweeklychartlist": {
      const chart = (await weeklyChartList(env)).map((w) => ({ "#text": "", from: String(w.from), to: String(w.to) }));
      return json({ weeklychartlist: { chart, "@attr": { user: name } } }, HOUR);
    }
    case "user.getweeklyartistchart": {
      const from = parseInt(url.searchParams.get("from") ?? "") || periodStart("7day");
      const to = parseInt(url.searchParams.get("to") ?? "") || Math.floor(Date.now() / 1000);
      const rows = await top(env, "artists", from, 1000, 0, to);
      const artist = rows.map((r, i) => ({ name: r.name, playcount: String(r.playcount), mbid: "", url: "", "@attr": { rank: String(i + 1) } }));
      return json({ weeklyartistchart: { artist, "@attr": { user: name, from: String(from), to: String(to) } } }, to < Date.now() / 1000 - HOUR ? HOUR : 0);
    }
    default:
      return lfError(400, 3, "Invalid Method - No method with that name in this package");
  }
}

async function proxyArtwork(c: Ctx, raw: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new HttpError(400, "Invalid URL scheme");
  const followable = (u: URL) => u.protocol === "https:" && ARTWORK_REDIRECT_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  let resp = await c.fetch(url, { headers: { "User-Agent": "ryplay/2.0", Accept: "image/*" }, redirect: "manual" });
  for (let hops = 0; resp && resp.status >= 300 && resp.status < 400 && hops < 4; hops++) {
    const next = resp.headers.get("location");
    if (!next || !followable(url)) break;
    url = new URL(next, url);
    if (!followable(url)) break;
    resp = await c.fetch(url, { headers: { "User-Agent": "ryplay/2.0", Accept: "image/*" }, redirect: "manual" });
  }
  if (!resp) throw new HttpError(404, "Image not found");
  if (resp.status >= 300 && resp.status < 400) throw new HttpError(502, "Upstream redirect not allowed");
  if (resp.status >= 400) throw new HttpError(502, "Upstream error");
  const type = (resp.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) throw new HttpError(415, "Not an image");
  const declared = parseInt(resp.headers.get("content-length") ?? "");
  if (declared > ARTWORK_MAX_BYTES) throw new HttpError(413, "Image too large");
  const body = await resp.arrayBuffer();
  if (body.byteLength > ARTWORK_MAX_BYTES) throw new HttpError(413, "Image too large");
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

const json = (data: unknown, maxAge = 0, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...(maxAge && status === 200 ? { "Cache-Control": `public, max-age=${maxAge}` } : { "Cache-Control": "no-store" }),
    },
  });

function requireParam(url: URL, name: string): string {
  const v = url.searchParams.get(name);
  if (!v) throw new HttpError(422, `Missing ${name}`);
  return v;
}

const CACHED_ROUTES: Record<string, number> = {
  "/api/lastfm": 1,
  "/api/music/stats": HOUR,
  "/api/genres": HOUR,
  "/api/clock": 10 * 60,
  "/api/top": 10 * 60,
  "/api/artwork": 365 * 24 * HOUR,
};

async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const c = new Ctx(env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" },
    });
  }
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const limiter = path === "/api/lastfm" ? env.LIMIT_LASTFM : path === "/api/artwork" ? env.LIMIT_ARTWORK : env.LIMIT_API;
  if (!(await limiter.limit({ key: `${path}:${ip}` })).success) throw new HttpError(429, "Rate limit exceeded");

  const ttl = CACHED_ROUTES[path];
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  if (ttl) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  let res: Response;
  switch (path) {
    case "/api/lastfm":
      res = await lastfmCompat(c, url);
      break;
    case "/api/music":
      res = json(await getMusic(c, requireParam(url, "user")));
      break;
    case "/api/music/stats":
      res = json(await getStats(c, requireParam(url, "user")), ttl);
      break;
    case "/api/top": {
      const type = requireParam(url, "type");
      if (!(type in TOP_ENTITY)) throw new HttpError(422, "Invalid type");
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10") || 10));
      const items = await getTop(c, type as TopKind, requireParam(url, "user"), url.searchParams.get("period") ?? "7day", limit);
      res = json(items, ttl);
      break;
    }
    case "/api/genres": {
      const result = await getGenres(c, requireParam(url, "user"), url.searchParams.get("period") ?? "3month");
      res = json(result, result.length ? ttl : 0);
      break;
    }
    case "/api/clock": {
      const grid = await getClock(c, requireParam(url, "user"), url.searchParams.get("tz") ?? "UTC");
      res = json(grid, grid.some((row) => row.some(Boolean)) ? ttl : 0);
      break;
    }
    case "/api/artwork":
      res = await proxyArtwork(c, requireParam(url, "url"));
      break;
    default:
      throw new HttpError(404, "Not Found");
  }

  if (ttl && res.ok && res.headers.get("Cache-Control")?.startsWith("public")) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

// One-time OAuth link: visit /auth/spotify?key=<client secret>, approve Spotify,
// and the callback stores the refresh token in D1 for the cron poller.
async function spotifyAuth(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return new Response("Spotify not configured", { status: 500 });
  if (url.pathname === "/auth/spotify") {
    if (url.searchParams.get("key") !== env.SPOTIFY_CLIENT_SECRET) return new Response("Forbidden", { status: 403 });
    const auth = new URL("https://accounts.spotify.com/authorize");
    auth.search = new URLSearchParams({
      client_id: env.SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: `${url.origin}/auth/spotify/callback`,
      scope: "user-read-currently-playing",
    }).toString();
    return Response.redirect(auth.toString(), 302);
  }
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });
  const data = await spotifyTokenPost(env, new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${url.origin}/auth/spotify/callback`,
  }));
  if (!data?.refresh_token) return new Response("Spotify auth failed", { status: 502 });
  await setMeta(env, "spotify.refresh", data.refresh_token);
  await setMeta(env, "spotify.access", JSON.stringify({ token: data.access_token, exp: Date.now() / 1000 + (data.expires_in ?? 3600) }));
  return new Response("Spotify connected — ryplay picks up now-playing within a minute.", { headers: { "Content-Type": "text/plain" } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (LEGACY_HOSTS.has(url.hostname)) {
      url.hostname = CANONICAL_HOST;
      return new Response(null, { status: 301, headers: { Location: url.toString(), "Access-Control-Allow-Origin": "*" } });
    }
    if (url.pathname === "/auth/spotify" || url.pathname === "/auth/spotify/callback") return spotifyAuth(request, url, env);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) return new Response(JSON.stringify({ detail: e.message }), { status: e.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      console.error(e);
      return new Response(JSON.stringify({ detail: "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(Promise.all([sync(env), spotifyPoll(env)]));
  },
} satisfies ExportedHandler<Env>;
