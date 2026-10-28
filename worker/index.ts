interface Env {
  ASSETS: Fetcher;
  SELF: Fetcher;
  LASTFM_API_KEY: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  LIMIT_LASTFM: RateLimit;
  LIMIT_API: RateLimit;
  LIMIT_ARTWORK: RateLimit;
}

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
const LASTFM_PLACEHOLDER_SUFFIX = "2a96cbd8b46e442fc41c2b86b821562f.png";
const ARTWORK_TTL = 6 * 60 * 60;
const HOUR = 60 * 60;
const GRACE_PERIOD = 25;
const MEM_MAX = 500;
const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;
const GENRE_CHUNK = 40;

const LASTFM_ALLOWED_METHODS = new Set([
  "user.getinfo", "user.getrecenttracks", "user.gettopartists", "user.gettoptracks",
  "user.gettopalbums", "user.gettoptags", "user.getlovedtracks", "user.getfriends",
  "artist.getinfo", "artist.gettoptags", "artist.gettoptracks", "artist.gettopalbums",
  "album.getinfo", "album.gettoptags", "track.getinfo", "track.gettoptags",
  "tag.gettopartists", "tag.gettoptracks",
]);

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
const genreNameCache = new TtlMap<string | null>(ARTWORK_TTL);
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
      if (!r.ok) console.warn(`upstream ${r.status} ${new URL(input).hostname}`);
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
  lastfm(params: Record<string, string>): Promise<Json | null> {
    const u = new URL(LASTFM_API_URL);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set("api_key", this.env.LASTFM_API_KEY);
    u.searchParams.set("format", "json");
    return this.json(u);
  }
}

async function md5(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const trackKey = (artist: string, title: string) => md5(`${artist}|${title}`);

function pickImage(item: Json): string | null {
  const images: Json[] = item?.image ?? [];
  for (const size of ["extralarge", "large", "medium", "small"]) {
    for (const img of images) if (img?.size === size && img["#text"]) return img["#text"];
  }
  return null;
}

const isPlaceholder = (url: string | null | undefined) => !url || url.endsWith(LASTFM_PLACEHOLDER_SUFFIX);

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

async function resolveArtwork(c: Ctx, artist: string, title: string, lastfmUrl: string | null, album = "") {
  const key = await trackKey(artist, title);
  const cached = artworkCache.get(key);
  if (!isPlaceholder(lastfmUrl)) return { url: lastfmUrl!, durationMs: cached?.v.durationMs ?? null };
  if (cached) return { url: cached.v.url ?? "", durationMs: cached.v.durationMs };

  const spotify = await searchSpotifyTrack(c, artist, title);
  const durationMs = spotify.durationMs;
  let art = spotify.art;
  art ||= await searchDeezerTrack(c, `${artist} ${title}`);
  art ||= await searchItunes(c, `${artist} ${title}`, "song");
  if (!art && album) art = await searchItunes(c, `${artist} ${album}`, "album");
  artworkCache.set(key, { url: art, durationMs });
  return { url: art ?? "", durationMs };
}

function extractRecentTracks(tracks: Json[]): Json[] {
  const recent: Json[] = [];
  for (const t of tracks) {
    if (t?.["@attr"]?.nowplaying === "true") continue;
    const title = t.name ?? "";
    const artist = t.artist?.["#text"] ?? "";
    const last = recent[recent.length - 1];
    if (last && last.title === title && last.artist === artist) {
      last.streak++;
    } else {
      recent.push({
        title,
        artist,
        album: t.album?.["#text"] ?? "",
        artworkUrl: pickImage(t) ?? "",
        trackUrl: t.url ?? "",
        timestamp: t.date?.uts ? parseInt(t.date.uts) : 0,
        streak: 1,
      });
    }
    if (recent.length >= 12) break;
  }
  for (const r of recent) if (r.streak === 1) delete r.streak;
  return recent;
}

async function getMusic(c: Ctx, user: string) {
  const data = await c.lastfm({ method: "user.getrecenttracks", user, limit: "50" });
  const tracks: Json[] = data?.recenttracks?.track ?? [];
  if (!tracks.length) return graceCache.get(user)?.v ?? { isPlaying: false, recentTracks: [] };

  const nowPlaying = tracks.find((t) => t?.["@attr"]?.nowplaying === "true");
  const recent = extractRecentTracks(tracks);

  const resolveNow = async (t: Json) =>
    resolveArtwork(c, t.artist?.["#text"] ?? "", t.name ?? "", pickImage(t), t.album?.["#text"] ?? "");

  const head = nowPlaying ?? tracks[0];
  const [headArt] = await Promise.all([
    resolveNow(head),
    ...recent
      .filter((r) => isPlaceholder(r.artworkUrl))
      .map(async (r) => {
        r.artworkUrl = (await resolveArtwork(c, r.artist, r.title, r.artworkUrl, r.album)).url;
      }),
  ]);

  const base = {
    title: head.name ?? "",
    artist: head.artist?.["#text"] ?? "",
    album: head.album?.["#text"] ?? "",
    artworkUrl: headArt.url,
    trackUrl: head.url ?? "",
  };

  if (nowPlaying) {
    let durationMs = headArt.durationMs;
    if (durationMs == null) {
      durationMs = (await searchSpotifyTrack(c, base.artist, base.title)).durationMs;
      if (durationMs != null) {
        const key = await trackKey(base.artist, base.title);
        artworkCache.set(key, { url: artworkCache.get(key)?.v.url ?? null, durationMs });
      }
    }
    const result: Json = { isPlaying: true, ...base, recentTracks: recent };
    if (durationMs) result.durationMs = durationMs;
    graceCache.set(user, result);
    return result;
  }

  const grace = graceCache.get(user);
  if (grace) return grace.v;
  return { isPlaying: false, ...base, updatedAt: head.date?.uts ? parseInt(head.date.uts) : 0, recentTracks: recent };
}

const GENRES = [
  "Pop", "Rock", "Alternative", "Indie", "Indie Pop", "Indie Rock", "Hip-Hop", "Rap", "Trap", "R&B", "Soul", "Funk", "Disco",
  "Electronic", "Dance", "House", "Techno", "Drum and Bass", "Dubstep", "Ambient", "Synthpop", "Hyperpop", "Bedroom Pop",
  "Dream Pop", "Shoegaze", "Lo-Fi", "Metal", "Progressive Metal", "Metalcore", "Hard Rock", "Grunge", "Punk", "Pop Punk",
  "Post-Punk", "Emo", "New Wave", "Folk", "Singer-Songwriter", "Country", "Jazz", "Blues", "Classical", "Soundtrack",
  "K-Pop", "J-Pop", "Latin", "Reggaeton", "Reggae", "Afrobeats", "Gospel", "Experimental",
];
const GENRE_LOOKUP = new Map<string, string>([
  ...GENRES.map((g) => [g.toLowerCase().replace(/[^a-z0-9&]/g, ""), g] as [string, string]),
  ["rnb", "R&B"], ["electronica", "Electronic"], ["dnb", "Drum and Bass"], ["lofi", "Lo-Fi"], ["kpop", "K-Pop"],
]);

async function getArtistGenre(c: Ctx, artist: string): Promise<string | null> {
  const cached = genreNameCache.get(artist);
  if (cached) return cached.v;
  const data = await c.lastfm({ method: "artist.gettoptags", artist, autocorrect: "1" });
  if (data === null) return null;
  const tags: Json[] = data?.toptags?.tag ?? [];
  let genre: string | null = null;
  for (const t of tags.slice(0, 10)) {
    genre = GENRE_LOOKUP.get(String(t.name ?? "").toLowerCase().replace(/[^a-z0-9&]/g, "")) ?? null;
    if (genre) break;
  }
  genreNameCache.set(artist, genre);
  return genre;
}

async function getStats(c: Ctx, user: string) {
  const [info, artistsRes, tracksRes, albumsRes] = await Promise.all([
    c.lastfm({ method: "user.getinfo", user }),
    c.lastfm({ method: "user.gettopartists", user, period: "overall", limit: "5" }),
    c.lastfm({ method: "user.gettoptracks", user, period: "overall", limit: "5" }),
    c.lastfm({ method: "user.gettopalbums", user, period: "overall", limit: "1" }),
  ]);
  if (!info?.user) throw new HttpError(502, "Upstream error");
  const u = info.user;
  const artists: Json[] = artistsRes?.topartists?.artist ?? [];
  const tracks: Json[] = tracksRes?.toptracks?.track ?? [];
  const albums: Json[] = albumsRes?.topalbums?.album ?? [];
  const total = parseInt(u.playcount ?? "0");
  const registered = parseInt(u.registered?.unixtime ?? "0");
  const days = registered ? Math.max(1, Math.floor((Date.now() / 1000 - registered) / 86400)) : 1;
  const topGenre = artists.length ? await getArtistGenre(c, artists[0].name ?? "") : null;
  const artistOut = (a: Json) => ({ name: a.name ?? "", playcount: parseInt(a.playcount ?? "0") });
  const trackOut = (t: Json) => ({ name: t.name ?? "", artist: t.artist?.name ?? "", playcount: parseInt(t.playcount ?? "0") });
  return {
    totalScrobbles: total,
    totalArtists: parseInt(u.artist_count ?? "0"),
    totalTracks: parseInt(u.track_count ?? "0"),
    totalAlbums: parseInt(u.album_count ?? "0"),
    avgDaily: Math.round(total / days),
    memberSince: registered,
    topArtist: artists[0] ? artistOut(artists[0]) : null,
    topArtists: artists.slice(0, 5).map(artistOut),
    topTrack: tracks[0] ? trackOut(tracks[0]) : null,
    topTracks: tracks.slice(0, 5).map(trackOut),
    topAlbum: albums[0] ? trackOut(albums[0]) : null,
    topGenre,
  };
}

const TOP_METHODS = {
  artists: ["user.gettopartists", "topartists", "artist", "musicArtist"],
  tracks: ["user.gettoptracks", "toptracks", "track", "song"],
  albums: ["user.gettopalbums", "topalbums", "album", "album"],
} as const;

async function getTop(c: Ctx, type: keyof typeof TOP_METHODS, user: string, period: string, limit: number) {
  const [method, root, key, entity] = TOP_METHODS[type];
  const data = await c.lastfm({ method, user, period, limit: String(limit) });
  if (!data?.[root]) throw new HttpError(502, "Upstream error");
  const items = ((data[root][key] ?? []) as Json[]).slice(0, limit).map((item) => ({
    name: item.name ?? "",
    subtitle: type === "artists" ? "" : typeof item.artist === "object" ? item.artist?.name ?? "" : String(item.artist ?? ""),
    playcount: parseInt(item.playcount ?? "0"),
    imageUrl: pickImage(item) ?? "",
    url: item.url ?? "",
  }));

  await Promise.all(
    items.map(async (e) => {
      if (!isPlaceholder(e.imageUrl)) return;
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
        art ||= await searchItunes(c, query, entity);
      } else {
        art = (await searchSpotifyTrack(c, e.subtitle, e.name)).art;
        art ||= await searchItunes(c, query, entity);
        art ||= await searchDeezerTrack(c, query);
        art ||= await searchItunes(c, e.name, entity);
      }
      artworkCache.set(cacheKey, { url: art, durationMs: null });
      e.imageUrl = art ?? "";
    }),
  );
  return items;
}

const GENRE_PERIOD_LIMITS: Record<string, number> = {
  "7day": 20, "1month": 50, "3month": 80, "6month": 120, "12month": 150, overall: 200,
};

async function lookupGenres(c: Ctx, names: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  await Promise.all(names.map(async (n) => (out[n] = await getArtistGenre(c, n))));
  return out;
}

async function getGenres(c: Ctx, user: string, period: string) {
  const limit = GENRE_PERIOD_LIMITS[period] ?? 50;
  const data = await c.lastfm({ method: "user.gettopartists", user, period, limit: String(limit) });
  if (!data?.topartists) throw new HttpError(502, "Upstream error");
  const artists: Json[] = (data.topartists.artist ?? []).slice(0, limit);
  const names = artists.map((a) => a.name ?? "");

  // Each chunk runs in its own invocation so it gets a fresh subrequest budget.
  const chunks: string[][] = [];
  for (let i = 0; i < names.length; i += GENRE_CHUNK) chunks.push(names.slice(i, i + GENRE_CHUNK));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const r = await c.env.SELF.fetch("https://ryplay.internal/internal/genres", {
        method: "POST",
        body: JSON.stringify(chunk),
      });
      return r.ok ? ((await r.json()) as Record<string, string | null>) : {};
    }),
  );
  const genres = Object.assign({}, ...results) as Record<string, string | null>;

  const weights = new Map<string, number>();
  for (const a of artists) {
    const g = genres[a.name ?? ""];
    if (!g) continue;
    for (const part of g.split("/").map((p) => p.trim()).filter(Boolean)) {
      weights.set(part, (weights.get(part) ?? 0) + parseInt(a.playcount ?? "0"));
    }
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

  for (let page = 1; page <= 5; page++) {
    let data: Json = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = await c.lastfm({
        method: "user.getrecenttracks", user, limit: "200", page: String(page), from: String(cutoff),
      });
      if (body?.recenttracks?.track?.length) {
        data = body;
        break;
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }
    if (!data) break;
    for (const t of data.recenttracks.track as Json[]) {
      if (t?.["@attr"]?.nowplaying === "true" || !t?.date?.uts) continue;
      const uts = parseInt(t.date.uts);
      if (uts < cutoff) continue;
      const p = tzParts(new Date(uts * 1000), tz);
      grid[p.weekday][p.h]++;
    }
    if (page >= parseInt(data.recenttracks["@attr"]?.totalPages ?? "1")) break;
  }
  return grid;
}

async function proxyArtwork(c: Ctx, raw: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new HttpError(400, "Invalid URL scheme");
  const resp = await c.fetch(url, { headers: { "User-Agent": "ryplay/1.0", Accept: "image/*" }, redirect: "manual" });
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

const json = (data: unknown, maxAge = 0) =>
  new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...(maxAge ? { "Cache-Control": `public, max-age=${maxAge}` } : { "Cache-Control": "no-store" }),
    },
  });

function requireParam(url: URL, name: string): string {
  const v = url.searchParams.get(name);
  if (!v) throw new HttpError(422, `Missing ${name}`);
  return v;
}

const CACHED_ROUTES: Record<string, number> = {
  "/api/music/stats": HOUR,
  "/api/genres": HOUR,
  "/api/clock": HOUR,
  "/api/top": 10 * 60,
  "/api/artwork": 365 * 24 * HOUR,
};

async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const c = new Ctx(env);

  if (path === "/internal/genres") {
    if (request.method !== "POST" || url.hostname !== "ryplay.internal") return new Response("Not found", { status: 404 });
    const names = ((await request.json()) as string[]).slice(0, GENRE_CHUNK).map(String);
    return json(await lookupGenres(c, names));
  }

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
    case "/api/lastfm": {
      const method = (url.searchParams.get("method") ?? "").toLowerCase();
      if (!LASTFM_ALLOWED_METHODS.has(method)) throw new HttpError(400, "Method not allowed");
      const params = Object.fromEntries(url.searchParams);
      params.method = method;
      const data = await c.lastfm(params);
      if (data === null) throw new HttpError(502, "Upstream error");
      res = json(data);
      break;
    }
    case "/api/music":
      res = json(await getMusic(c, requireParam(url, "user")));
      break;
    case "/api/music/stats":
      res = json(await getStats(c, requireParam(url, "user")), ttl);
      break;
    case "/api/top": {
      const type = requireParam(url, "type");
      if (!(type in TOP_METHODS)) throw new HttpError(422, "Invalid type");
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10") || 10));
      const items = await getTop(c, type as keyof typeof TOP_METHODS, requireParam(url, "user"), url.searchParams.get("period") ?? "7day", limit);
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

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/") && !pathname.startsWith("/internal/")) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) return new Response(JSON.stringify({ detail: e.message }), { status: e.status, headers: { "Content-Type": "application/json" } });
      console.error(e);
      return new Response(JSON.stringify({ detail: "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  },
} satisfies ExportedHandler<Env>;
