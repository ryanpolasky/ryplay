const LB_API = "https://api.listenbrainz.org/1";
const USER_AGENT = "ryplay/2.0 (+https://ryplay.ryanpolasky.com)";
const PAGE = 1000;
const DAY = 86400;
const WEEK = 7 * DAY;
const CHART_ANCHOR = 1108296000;
const GENRE_RECHECK = 30 * DAY;

export interface ListenEnv {
  DB: D1Database;
  LB_USER: string;
}

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Listen = {
  ts: number;
  artist: string;
  track: string;
  album: string;
  artist_mbid: string | null;
  release_mbid: string | null;
  caa_id: number | null;
  duration_ms: number | null;
};

export type NowPlaying = { artist: string; track: string; album: string; durationMs: number | null };

export const PERIODS: Record<string, number> = {
  "7day": 7, "1month": 30, "3month": 90, "6month": 180, "12month": 365, overall: 0,
};

export const isOwner = (env: ListenEnv, user: string | null | undefined) =>
  !!user && user.toLowerCase() === env.LB_USER.toLowerCase();

export const periodStart = (period: string) => {
  const days = PERIODS[period] ?? 7;
  return days ? Math.floor(Date.now() / 1000) - days * DAY : 0;
};

export const coverArt = (l: Pick<Listen, "release_mbid" | "caa_id">, size = 500) =>
  l.release_mbid && l.caa_id ? `https://coverartarchive.org/release/${l.release_mbid}/${l.caa_id}-${size}.jpg` : "";

async function lb(path: string, timeout = 20000): Promise<Json | null> {
  try {
    const r = await fetch(`${LB_API}${path}`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(timeout) });
    if (!r.ok) {
      console.warn(`listenbrainz ${r.status} ${path}`);
      return null;
    }
    return r.status === 204 ? null : await r.json();
  } catch {
    return null;
  }
}

function toListen(l: Json): Listen | null {
  const m = l?.track_metadata ?? {};
  const map = m.mbid_mapping ?? {};
  const info = m.additional_info ?? {};
  if (!l?.listened_at || !m.artist_name || !m.track_name) return null;
  return {
    ts: l.listened_at,
    artist: m.artist_name,
    track: m.track_name,
    album: m.release_name ?? "",
    artist_mbid: map.artist_mbids?.[0] ?? info.artist_mbids?.[0] ?? null,
    release_mbid: map.caa_release_mbid ?? null,
    caa_id: map.caa_id ?? null,
    duration_ms: typeof info.duration_ms === "number" ? info.duration_ms : null,
  };
}

export async function getMeta(env: ListenEnv, key: string): Promise<string | null> {
  return (await env.DB.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first<{ value: string }>())?.value ?? null;
}

export async function setMeta(env: ListenEnv, key: string, value: string | number) {
  await env.DB.prepare("INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2").bind(key, String(value)).run();
}

// The same play reaches ListenBrainz through multiple paths (its Spotify
// connector AND its Last.fm importer both submit ongoing listens), so the feed
// carries the same song twice a few minutes apart. Collapse same artist+track
// rows within a 5-minute window — a faster genuine replay is implausible.
export const DEDUPE_WINDOW = 300;

export function dedupeListens(rows: Listen[]): Listen[] {
  const seen = new Map<string, number[]>(); // normalized key -> all timestamps seen (kept or not)
  const out: Listen[] = [];
  for (const l of [...rows].sort((a, b) => a.ts - b.ts)) {
    const key = `${l.artist}${l.track}`.toLowerCase();
    const times = seen.get(key) ?? [];
    times.push(l.ts);
    seen.set(key, times);
    if (times.length > 1 && times[times.length - 1] - times[times.length - 2] <= DEDUPE_WINDOW) continue;
    out.push(l);
  }
  return out;
}

async function insertListens(env: ListenEnv, rows: Listen[]) {
  rows = dedupeListens(rows);
  if (!rows.length) return;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO listens (ts, artist, track, album, artist_mbid, release_mbid, caa_id, duration_ms)
     SELECT j.value->>'ts', j.value->>'artist', j.value->>'track', j.value->>'album',
            j.value->>'artist_mbid', j.value->>'release_mbid', j.value->>'caa_id', j.value->>'duration_ms'
     FROM json_each(?1) j
     WHERE NOT EXISTS (
       SELECT 1 FROM listens b
       WHERE b.artist = j.value->>'artist' AND b.track = j.value->>'track'
         AND abs(b.ts - CAST(j.value->>'ts' AS INTEGER)) <= ${DEDUPE_WINDOW}
     )`,
  ).bind(JSON.stringify(rows)).run();
}

// Walks forward from the cursor; a count mismatch with ListenBrainz (e.g. a late history import) restarts the walk from 0.
export async function sync(env: ListenEnv, maxPages = 10) {
  const user = encodeURIComponent(env.LB_USER);
  if (new Date().getUTCMinutes() % 15 === 0) {
    const remote = (await lb(`/user/${user}/listen-count`))?.payload?.count;
    const local = (await env.DB.prepare("SELECT COUNT(*) AS n FROM listens").first<{ n: number }>())?.n ?? 0;
    // remote stays permanently ahead by however many dupes ListenBrainz stores
    // server-side (dedupeListens keeps them out locally), so cap rewalks to
    // once a day instead of trusting a count margin.
    const lastRewalk = Number((await getMeta(env, "last_rewalk_at")) ?? 0);
    if (typeof remote === "number" && remote > local && Date.now() / 1000 - lastRewalk > 86400) {
      await setMeta(env, "last_rewalk_at", Math.floor(Date.now() / 1000));
      await setMeta(env, "cursor", 0);
    }
  }
  let cursor = Number((await getMeta(env, "cursor")) ?? 0);
  for (let i = 0; i < maxPages; i++) {
    const data = await lb(`/user/${user}/listens?count=${PAGE}&min_ts=${Math.max(0, cursor - 1)}`);
    const raw: Json[] = data?.payload?.listens ?? [];
    const rows = raw.map(toListen).filter((l): l is Listen => !!l);
    await insertListens(env, rows);
    const newest = rows.reduce((m, l) => Math.max(m, l.ts), cursor);
    if (newest > cursor) {
      cursor = newest;
      await setMeta(env, "cursor", cursor);
    }
    if (raw.length < PAGE) break;
  }
}

export async function nowPlaying(env: ListenEnv): Promise<NowPlaying | null> {
  const l = (await lb(`/user/${encodeURIComponent(env.LB_USER)}/playing-now`, 6000))?.payload?.listens?.[0];
  const m = l?.track_metadata;
  if (!m?.artist_name || !m?.track_name) return null;
  const d = m.additional_info?.duration_ms ?? (m.additional_info?.duration ? m.additional_info.duration * 1000 : null);
  return { artist: m.artist_name, track: m.track_name, album: m.release_name ?? "", durationMs: typeof d === "number" ? d : null };
}

export async function recent(env: ListenEnv, limit: number, from = 0, to = 2 ** 31, offset = 0) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM listens WHERE ts >= ?1 AND ts <= ?2 ORDER BY ts DESC LIMIT ?3 OFFSET ?4",
  ).bind(from, to, limit, offset).all<Listen>();
  return results;
}

export async function countBetween(env: ListenEnv, from = 0, to = 2 ** 31) {
  return (await env.DB.prepare("SELECT COUNT(*) AS n FROM listens WHERE ts >= ?1 AND ts <= ?2").bind(from, to).first<{ n: number }>())?.n ?? 0;
}

export type TopRow = { name: string; artist: string; playcount: number; release_mbid: string | null; caa_id: number | null };

const TOP_SQL = {
  artists: "SELECT artist AS name, '' AS artist, COUNT(*) AS playcount, NULL AS release_mbid, NULL AS caa_id FROM listens WHERE ts >= ?1 AND ts <= ?2 GROUP BY artist",
  tracks: "SELECT track AS name, artist, COUNT(*) AS playcount, MAX(release_mbid) AS release_mbid, MAX(caa_id) AS caa_id FROM listens WHERE ts >= ?1 AND ts <= ?2 GROUP BY artist, track",
  albums: "SELECT album AS name, artist, COUNT(*) AS playcount, MAX(release_mbid) AS release_mbid, MAX(caa_id) AS caa_id FROM listens WHERE ts >= ?1 AND ts <= ?2 AND album != '' GROUP BY artist, album",
} as const;

export type TopKind = keyof typeof TOP_SQL;

export async function top(env: ListenEnv, kind: TopKind, from: number, limit: number, offset = 0, to = 2 ** 31) {
  const { results } = await env.DB.prepare(`${TOP_SQL[kind]} ORDER BY playcount DESC, MAX(ts) DESC LIMIT ?3 OFFSET ?4`)
    .bind(from, to, limit, offset).all<TopRow>();
  return results;
}

export async function totals(env: ListenEnv) {
  const r = await env.DB.prepare(
    `SELECT COUNT(*) AS scrobbles, COUNT(DISTINCT artist) AS artists,
            COUNT(DISTINCT artist || char(0) || track) AS tracks,
            COUNT(DISTINCT CASE WHEN album != '' THEN artist || char(0) || album END) AS albums,
            MIN(ts) AS first
     FROM listens`,
  ).first<{ scrobbles: number; artists: number; tracks: number; albums: number; first: number | null }>();
  return { scrobbles: r?.scrobbles ?? 0, artists: r?.artists ?? 0, tracks: r?.tracks ?? 0, albums: r?.albums ?? 0, first: r?.first ?? 0 };
}

export async function timestampsSince(env: ListenEnv, from: number) {
  const { results } = await env.DB.prepare("SELECT ts FROM listens WHERE ts >= ?1").bind(from).all<{ ts: number }>();
  return results.map((r) => r.ts);
}

// Last.fm charts run Sunday 12:00 UTC to Sunday 12:00 UTC.
export async function weeklyChartList(env: ListenEnv) {
  const first = (await totals(env)).first;
  const now = Math.floor(Date.now() / 1000);
  if (!first) return [];
  const out: { from: number; to: number }[] = [];
  for (let f = CHART_ANCHOR + Math.floor((first - CHART_ANCHOR) / WEEK) * WEEK; f <= now; f += WEEK) out.push({ from: f, to: f + WEEK });
  return out;
}

const GENRES = [
  "Pop", "Rock", "Alternative", "Indie", "Indie Pop", "Indie Rock", "Hip-Hop", "Rap", "Trap", "R&B", "Soul", "Funk", "Disco",
  "Electronic", "Dance", "House", "Techno", "Drum and Bass", "Dubstep", "Ambient", "Synthpop", "Hyperpop", "Bedroom Pop",
  "Dream Pop", "Shoegaze", "Lo-Fi", "Metal", "Progressive Metal", "Metalcore", "Hard Rock", "Grunge", "Punk", "Pop Punk",
  "Post-Punk", "Emo", "New Wave", "Folk", "Singer-Songwriter", "Country", "Jazz", "Blues", "Classical", "Soundtrack",
  "K-Pop", "J-Pop", "Latin", "Reggaeton", "Reggae", "Afrobeats", "Gospel", "Experimental",
];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9&]/g, "");
const GENRE_LOOKUP = new Map<string, string>([
  ...GENRES.map((g) => [norm(g), g] as [string, string]),
  ["rnb", "R&B"], ["rhythmandblues", "R&B"], ["contemporaryrnb", "R&B"], ["hiphop", "Hip-Hop"], ["electronica", "Electronic"],
  ["dnb", "Drum and Bass"], ["lofi", "Lo-Fi"], ["lofihiphop", "Lo-Fi"], ["kpop", "K-Pop"], ["jpop", "J-Pop"],
  ["alternativerock", "Alternative"], ["altpop", "Pop"], ["electropop", "Synthpop"], ["synthwave", "Synthpop"],
]);
const GENRE_KEYWORDS: [string, string][] = [
  ["hiphop", "Hip-Hop"], ["rap", "Rap"], ["trap", "Trap"], ["rnb", "R&B"], ["soul", "Soul"], ["metal", "Metal"], ["punk", "Punk"],
  ["emo", "Emo"], ["house", "House"], ["techno", "Techno"], ["ambient", "Ambient"], ["jazz", "Jazz"], ["folk", "Folk"],
  ["country", "Country"], ["indie", "Indie"], ["rock", "Rock"], ["electro", "Electronic"], ["pop", "Pop"],
];

function pickGenre(tags: { tag: string; count: number }[]): string | null {
  const sorted = [...tags].sort((a, b) => b.count - a.count).map((t) => norm(t.tag));
  for (const t of sorted) {
    const g = GENRE_LOOKUP.get(t);
    if (g) return g;
  }
  for (const t of sorted) for (const [k, g] of GENRE_KEYWORDS) if (t.includes(k)) return g;
  return null;
}

export async function artistGenres(env: ListenEnv, artists: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  if (!artists.length) return out;
  const now = Math.floor(Date.now() / 1000);
  const { results: cached } = await env.DB.prepare(
    "SELECT g.artist, g.genre, g.checked_at FROM artist_genres g JOIN json_each(?1) j ON j.value = g.artist",
  ).bind(JSON.stringify(artists)).all<{ artist: string; genre: string | null; checked_at: number }>();
  for (const c of cached) if (now - c.checked_at < GENRE_RECHECK || c.genre) out[c.artist] = c.genre;

  const missing = artists.filter((a) => !(a in out));
  if (!missing.length) return out;
  const { results: ids } = await env.DB.prepare(
    "SELECT artist, MAX(artist_mbid) AS mbid FROM listens WHERE artist IN (SELECT value FROM json_each(?1)) GROUP BY artist",
  ).bind(JSON.stringify(missing)).all<{ artist: string; mbid: string | null }>();
  const byMbid = new Map<string, string>();
  for (const r of ids) if (r.mbid) byMbid.set(r.mbid, r.artist);

  // Most imported listens lack artist_mbids; resolve a handful of names via
  // MusicBrainz so the genre lookup has something to work with. Artists past the
  // cap or whose search fails are left uncached so they retry next call.
  const noMbidAll = missing.filter((a) => !ids.some((r) => r.artist === a && r.mbid));
  // Shuffle so a failing head-of-list doesn't starve lower artists across retries.
  for (let i = noMbidAll.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [noMbidAll[i], noMbidAll[j]] = [noMbidAll[j], noMbidAll[i]];
  }
  const unsearched = new Set(noMbidAll.slice(25));
  const failedMb = new Set<string>();
  const noMbid = missing.filter((a) => !unsearched.has(a) && !ids.some((r) => r.artist === a && r.mbid));
  await Promise.all(noMbid.map(async (name) => {
    const q = encodeURIComponent(`artist:"${name.replace(/"/g, "")}"`);
    try {
      const r = await fetch(`https://musicbrainz.org/ws/2/artist/?fmt=json&limit=1&query=${q}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const hit = (await r.json() as Json)?.artists?.[0];
      // Only trust high-confidence matches; for namesakes the top hit can be the wrong artist.
      if (hit?.id && (hit.score ?? 0) >= 90) byMbid.set(hit.id, name);
    } catch {
      failedMb.add(name);
    }
  }));

  const mbids = [...byMbid.keys()];
  const found: Record<string, string | null> = {};
  const lookupFailed = new Set<string>();
  for (let i = 0; i < mbids.length; i += 40) {
    const batch = mbids.slice(i, i + 40);
    const data: Json[] | null = await lb(`/metadata/artist/?artist_mbids=${batch.join(",")}&inc=tag`, 15000);
    if (data === null) {
      // Lookup failed (e.g. upstream challenge); leave those artists uncached so
      // they retry instead of pinning genre=null for GENRE_RECHECK days.
      for (const m of batch) {
        const name = byMbid.get(m);
        if (name) lookupFailed.add(name);
      }
      continue;
    }
    for (const a of data) {
      const name = byMbid.get(a.artist_mbid);
      if (name) found[name] = pickGenre(a.tag?.artist ?? []);
    }
  }
  const rows = missing.filter((a) => !lookupFailed.has(a) && !unsearched.has(a) && !failedMb.has(a)).map((a) => ({ artist: a, genre: found[a] ?? null }));
  if (rows.length) await env.DB.prepare(
    `INSERT INTO artist_genres (artist, genre, checked_at)
     SELECT j.value->>'artist', j.value->>'genre', ?2 FROM json_each(?1) j WHERE true
     ON CONFLICT(artist) DO UPDATE SET genre = excluded.genre, checked_at = excluded.checked_at`,
  ).bind(JSON.stringify(rows), now).run();
  for (const r of rows) out[r.artist] = r.genre;
  return out;
}
