import os
import time
import hashlib
import asyncio
import ipaddress
import socket
from contextlib import asynccontextmanager
from urllib.parse import urlparse

import uvicorn
from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

load_dotenv()

LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/"
API_KEY = os.getenv("LASTFM_API_KEY", "")
LASTFM_PLACEHOLDER_SUFFIX = "2a96cbd8b46e442fc41c2b86b821562f.png"

# Spotify client credentials (optional — enables extra fallback for artist/track images)
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")

# CORS allowlist — comma-separated origins, or "*" for any (default keeps prior behavior)
_raw_origins = os.getenv("RYPLAY_ALLOWED_ORIGINS", "*").strip()
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]

ARTWORK_CACHE_TTL = 6 * 60 * 60  # 6 hours
ARTWORK_CACHE_MAX = 500
STATS_CACHE_TTL = 60 * 60  # 1 hour
STATS_CACHE_MAX = 500
GRACE_CACHE_MAX = 500
GRACE_PERIOD = 25  # seconds — covers skips/brief pauses without feeling sluggish

# Allowlist of Last.fm read methods exposed via /api/lastfm. Mutating methods
# require a session key (which we never issue), but we still want to limit the
# attack surface and protect our shared API key from abuse.
LASTFM_ALLOWED_METHODS = frozenset({
    "user.getinfo",
    "user.getrecenttracks",
    "user.gettopartists",
    "user.gettoptracks",
    "user.gettopalbums",
    "user.gettoptags",
    "user.getlovedtracks",
    "user.getfriends",
    "artist.getinfo",
    "artist.gettoptags",
    "artist.gettoptracks",
    "artist.gettopalbums",
    "album.getinfo",
    "album.gettoptags",
    "track.getinfo",
    "track.gettoptags",
    "tag.gettopartists",
    "tag.gettoptracks",
})

# In-memory caches
artwork_cache: dict[str, tuple[str | None, int | None, float]] = {}  # track_hash -> (url, duration_ms, ts)
genre_name_cache: dict[str, tuple[str | None, float]] = {}  # artist_name -> (genre_or_none, ts)
GENRE_NAME_CACHE_MAX = 500
stats_cache: dict[str, tuple[dict, float]] = {}
grace_cache: dict[str, tuple[dict, float]] = {}  # user -> (last_playing_data, last_active_time)
_spotify_token: tuple[str, float] | None = None  # (access_token, expires_at) — for client-credentials artwork fallback


def _track_hash(artist: str, title: str) -> str:
    return hashlib.md5(f"{artist}|{title}".encode()).hexdigest()


def _evict_oldest(cache: dict, max_size: int, ts_index: int) -> None:
    """O(n) eviction of the oldest entry. ts_index is the position of the
    timestamp inside each cache value tuple."""
    if len(cache) >= max_size:
        oldest = min(cache, key=lambda k: cache[k][ts_index])
        del cache[oldest]


def _pick_image(track: dict) -> str | None:
    images = track.get("image", [])
    for size in ("extralarge", "large", "medium", "small"):
        for img in images:
            if img.get("size") == size and img.get("#text"):
                return img["#text"]
    return None


def _is_placeholder(url: str | None) -> bool:
    return not url or url.endswith(LASTFM_PLACEHOLDER_SUFFIX)


def _get_cached_artwork(track_id: str) -> tuple[str | None, int | None] | type[...]:
    entry = artwork_cache.get(track_id)
    if entry is None:
        return ...  # sentinel: cache miss
    url, duration_ms, ts = entry
    if time.time() - ts > ARTWORK_CACHE_TTL:
        del artwork_cache[track_id]
        return ...
    return (url, duration_ms)


def _set_cached_artwork(track_id: str, url: str | None, duration_ms: int | None = None) -> None:
    _evict_oldest(artwork_cache, ARTWORK_CACHE_MAX, 2)
    artwork_cache[track_id] = (url, duration_ms, time.time())


def _get_cached_genre(name: str) -> tuple[str | None] | type[...]:
    """Return ``(genre_or_none,)`` on hit (so ``None`` cache entries are
    distinguishable from misses), or ``...`` for a miss/expired entry."""
    entry = genre_name_cache.get(name)
    if entry is None:
        return ...
    val, ts = entry
    if time.time() - ts > ARTWORK_CACHE_TTL:
        del genre_name_cache[name]
        return ...
    return (val,)


def _set_cached_genre(name: str, value: str | None) -> None:
    _evict_oldest(genre_name_cache, GENRE_NAME_CACHE_MAX, 1)
    genre_name_cache[name] = (value, time.time())


async def _search_itunes(client: httpx.AsyncClient, artist: str, title: str) -> str | None:
    try:
        resp = await client.get(
            "https://itunes.apple.com/search",
            params={"term": f"{artist} {title}", "media": "music", "entity": "song", "limit": 1},
            timeout=5.0,
        )
        data = resp.json()
        results = data.get("results", [])
        if results and results[0].get("artworkUrl100"):
            return results[0]["artworkUrl100"].replace("100x100", "600x600")
    except Exception:
        pass
    return None


async def _search_itunes_entity(client: httpx.AsyncClient, query: str, entity: str) -> str | None:
    """Search iTunes for artwork by entity type: musicArtist, song, album."""
    try:
        resp = await client.get(
            "https://itunes.apple.com/search",
            params={"term": query, "media": "music", "entity": entity, "limit": 1},
            timeout=5.0,
        )
        data = resp.json()
        results = data.get("results", [])
        if results:
            art = results[0].get("artworkUrl100") or results[0].get("artworkUrl60")
            if art:
                return art.replace("100x100", "600x600").replace("60x60", "600x600")
    except Exception:
        pass
    return None


async def _search_deezer_artist(client: httpx.AsyncClient, name: str) -> str | None:
    """Search Deezer for an actual artist photo."""
    try:
        resp = await client.get(
            "https://api.deezer.com/search/artist",
            params={"q": name, "limit": 1},
            timeout=5.0,
        )
        data = resp.json()
        results = data.get("data", [])
        if results:
            return results[0].get("picture_xl") or results[0].get("picture_big") or results[0].get("picture_medium")
    except Exception:
        pass
    return None


async def _search_deezer_track(client: httpx.AsyncClient, query: str) -> str | None:
    """Search Deezer for track/album artwork."""
    try:
        resp = await client.get(
            "https://api.deezer.com/search/track",
            params={"q": query, "limit": 1},
            timeout=5.0,
        )
        data = resp.json()
        results = data.get("data", [])
        if results:
            album = results[0].get("album", {})
            return album.get("cover_xl") or album.get("cover_big") or album.get("cover_medium")
    except Exception:
        pass
    return None


async def _get_spotify_token(client: httpx.AsyncClient) -> str | None:
    """Get Spotify access token via client credentials flow. Returns None if creds aren't set."""
    global _spotify_token
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return None
    if _spotify_token and time.time() < _spotify_token[1] - 60:
        return _spotify_token[0]
    try:
        resp = await client.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
            timeout=5.0,
        )
        data = resp.json()
        token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        _spotify_token = (token, time.time() + expires_in)
        return token
    except Exception:
        return None


async def _search_spotify_artist(client: httpx.AsyncClient, name: str) -> str | None:
    """Search Spotify for an artist photo."""
    token = await _get_spotify_token(client)
    if not token:
        return None
    try:
        resp = await client.get(
            "https://api.spotify.com/v1/search",
            params={"q": name, "type": "artist", "limit": 1},
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        data = resp.json()
        items = data.get("artists", {}).get("items", [])
        if items and items[0].get("images"):
            return items[0]["images"][0]["url"]
    except Exception:
        pass
    return None


async def _search_spotify_track(client: httpx.AsyncClient, artist: str, title: str) -> tuple[str | None, int | None]:
    """Search Spotify for track album artwork and duration."""
    token = await _get_spotify_token(client)
    if not token:
        return None, None
    try:
        resp = await client.get(
            "https://api.spotify.com/v1/search",
            params={"q": f"artist:{artist} track:{title}", "type": "track", "limit": 1},
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        data = resp.json()
        items = data.get("tracks", {}).get("items", [])
        if items:
            track = items[0]
            duration_ms = track.get("duration_ms")
            images = track.get("album", {}).get("images", [])
            art = images[0]["url"] if images else None
            return art, duration_ms
    except Exception:
        pass
    return None, None


async def _resolve_artwork(client: httpx.AsyncClient, artist: str, title: str, lastfm_url: str | None, album: str = "") -> tuple[str, int | None]:
    if not _is_placeholder(lastfm_url):
        # Last.fm has good artwork but no duration — check cache for duration from a prior Spotify hit
        track_id = _track_hash(artist, title)
        cached = _get_cached_artwork(track_id)
        if cached is not ...:
            _, cached_duration = cached
            return lastfm_url or "", cached_duration
        return lastfm_url or "", None

    track_id = _track_hash(artist, title)
    cached = _get_cached_artwork(track_id)
    if cached is not ...:
        url, duration_ms = cached
        return url or "", duration_ms

    # Chain: Spotify track → Deezer track → iTunes song → iTunes album
    query = f"{artist} {title}"
    art, duration_ms = await _search_spotify_track(client, artist, title)
    if not art:
        art = await _search_deezer_track(client, query)
    if not art:
        art = await _search_itunes(client, artist, title)
    if not art and album:
        art = await _search_itunes_entity(client, f"{artist} {album}", "album")
    _set_cached_artwork(track_id, art, duration_ms)
    return art or "", duration_ms


def _extract_recent_tracks(tracks: list, client: httpx.AsyncClient) -> list[dict]:
    """Synchronous extraction — artwork resolved later in batch."""
    recent: list[dict] = []
    for track in tracks:
        if track.get("@attr", {}).get("nowplaying") == "true":
            continue
        title = track.get("name", "")
        artist = track.get("artist", {}).get("#text", "")
        album = track.get("album", {}).get("#text", "")
        artwork_url = _pick_image(track)
        track_url = track.get("url", "")
        date = track.get("date", {})
        timestamp = int(date.get("uts", 0)) if date else 0

        if recent and recent[-1]["title"] == title and recent[-1]["artist"] == artist:
            recent[-1]["streak"] += 1
        else:
            recent.append({
                "title": title,
                "artist": artist,
                "album": album,
                "artworkUrl": artwork_url or "",
                "trackUrl": track_url,
                "timestamp": timestamp,
                "streak": 1,
            })
        if len(recent) >= 12:
            break

    for entry in recent:
        if entry["streak"] == 1:
            del entry["streak"]

    return recent


async def _resolve_artwork_batch(client: httpx.AsyncClient, tracks: list[dict]) -> None:
    """Resolve artwork for tracks that have placeholder/missing art."""
    tasks = []
    for track in tracks:
        if _is_placeholder(track.get("artworkUrl")):
            tasks.append((track, _resolve_artwork(client, track["artist"], track["title"], track.get("artworkUrl"), track.get("album", ""))))

    if tasks:
        results = await asyncio.gather(*(t[1] for t in tasks), return_exceptions=True)
        for (track, _), result in zip(tasks, results):
            if isinstance(result, tuple):
                track["artworkUrl"] = result[0]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast at startup if the only required secret is missing — better
    # than serving 502s for every Last.fm call until someone notices.
    if not API_KEY:
        raise RuntimeError(
            "LASTFM_API_KEY is not set. Get a free key at "
            "https://www.last.fm/api/account/create and put it in backend/.env"
        )
    app.state.http_client = httpx.AsyncClient(timeout=15.0)
    yield
    await app.state.http_client.aclose()


app = FastAPI(lifespan=lifespan)

# Per-IP rate limiting. Defaults are generous for normal browser traffic
# (the dashboard polls /api/music every 10s) but cap automated abuse.
# Override per-endpoint with @limiter.limit("...").
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/lastfm")
@limiter.limit("60/minute")
async def lastfm_proxy(request: Request):
    """Last.fm API proxy restricted to a known set of read methods.

    The shared API key is injected server-side; the frontend never sees it.
    The method allowlist limits abuse of our shared rate-limit budget.
    """
    params = dict(request.query_params)
    method = (params.get("method") or "").lower()
    if method not in LASTFM_ALLOWED_METHODS:
        raise HTTPException(400, "Method not allowed")
    params["method"] = method
    params["api_key"] = API_KEY
    params["format"] = "json"
    try:
        resp = await request.app.state.http_client.get(LASTFM_API_URL, params=params)
        return resp.json()
    except (httpx.RequestError, ValueError):
        raise HTTPException(502, "Upstream error")


@app.get("/api/music")
@limiter.limit("30/minute")
async def get_music(request: Request, user: str = Query(..., min_length=1)):
    """Processed now-playing endpoint with streak detection and artwork fallback."""
    client = request.app.state.http_client

    # Fetch recent tracks from Last.fm
    resp = await client.get(LASTFM_API_URL, params={
        "method": "user.getrecenttracks",
        "user": user,
        "api_key": API_KEY,
        "format": "json",
        "limit": "50",
    })
    data = resp.json()

    tracks = data.get("recenttracks", {}).get("track", [])
    if not tracks:
        # Check grace period
        grace = grace_cache.get(user)
        if grace and time.time() - grace[1] < GRACE_PERIOD:
            return grace[0]
        return {"isPlaying": False, "recentTracks": []}

    # Detect now-playing
    now_playing = None
    for track in tracks:
        if track.get("@attr", {}).get("nowplaying") == "true":
            now_playing = track
            break

    # Extract recent tracks with streaks
    recent = _extract_recent_tracks(tracks, client)

    # Resolve artwork for recent tracks (batch)
    await _resolve_artwork_batch(client, recent)

    if now_playing:
        title = now_playing.get("name", "")
        artist = now_playing.get("artist", {}).get("#text", "")
        album = now_playing.get("album", {}).get("#text", "")
        raw_art = _pick_image(now_playing)
        artwork_url, duration_ms = await _resolve_artwork(client, artist, title, raw_art, album)

        # If artwork came from Last.fm (skipped Spotify), fetch duration separately
        if duration_ms is None:
            _, duration_ms = await _search_spotify_track(client, artist, title)
            if duration_ms is not None:
                # Cache duration for future hits
                track_id = _track_hash(artist, title)
                cached = _get_cached_artwork(track_id)
                if cached is not ...:
                    _set_cached_artwork(track_id, cached[0], duration_ms)

        result = {
            "isPlaying": True,
            "title": title,
            "artist": artist,
            "album": album,
            "artworkUrl": artwork_url,
            "trackUrl": now_playing.get("url", ""),
            "recentTracks": recent,
        }
        if duration_ms:
            result["durationMs"] = duration_ms
        _evict_oldest(grace_cache, GRACE_CACHE_MAX, 1)
        grace_cache[user] = (result, time.time())
        return result

    # Not currently playing — check grace period
    grace = grace_cache.get(user)
    if grace and time.time() - grace[1] < GRACE_PERIOD:
        return grace[0]

    # Return last played track
    last = tracks[0] if tracks else None
    if last and last.get("@attr", {}).get("nowplaying") != "true":
        title = last.get("name", "")
        artist = last.get("artist", {}).get("#text", "")
        album = last.get("album", {}).get("#text", "")
        raw_art = _pick_image(last)
        artwork_url, _ = await _resolve_artwork(client, artist, title, raw_art, album)
        date = last.get("date", {})
        timestamp = int(date.get("uts", 0)) if date else 0

        return {
            "isPlaying": False,
            "title": title,
            "artist": artist,
            "album": album,
            "artworkUrl": artwork_url,
            "trackUrl": last.get("url", ""),
            "updatedAt": timestamp,
            "recentTracks": recent,
        }

    return {"isPlaying": False, "recentTracks": recent}


@app.get("/api/music/stats")
@limiter.limit("30/minute")
async def get_music_stats(request: Request, user: str = Query(..., min_length=1)):
    """Profile overview — all-time stats, 1 hour cache."""
    cached = stats_cache.get(user)
    if cached and time.time() - cached[1] < STATS_CACHE_TTL:
        return cached[0]
    _evict_oldest(stats_cache, STATS_CACHE_MAX, 1)

    client = request.app.state.http_client

    # Parallel fetch: user info + #1 artist overall + #1 track overall + #1 album overall
    info_req = client.get(LASTFM_API_URL, params={
        "method": "user.getinfo", "user": user, "api_key": API_KEY, "format": "json",
    })
    artist_req = client.get(LASTFM_API_URL, params={
        "method": "user.gettopartists", "user": user, "api_key": API_KEY,
        "format": "json", "period": "overall", "limit": "5",
    })
    track_req = client.get(LASTFM_API_URL, params={
        "method": "user.gettoptracks", "user": user, "api_key": API_KEY,
        "format": "json", "period": "overall", "limit": "5",
    })
    album_req = client.get(LASTFM_API_URL, params={
        "method": "user.gettopalbums", "user": user, "api_key": API_KEY,
        "format": "json", "period": "overall", "limit": "1",
    })

    info_resp, artist_resp, track_resp, album_resp = await asyncio.gather(
        info_req, artist_req, track_req, album_req,
    )

    info_data = info_resp.json().get("user", {})
    artists = artist_resp.json().get("topartists", {}).get("artist", [])
    tracks = track_resp.json().get("toptracks", {}).get("track", [])
    albums = album_resp.json().get("topalbums", {}).get("album", [])

    total_scrobbles = int(info_data.get("playcount", 0))
    registered = int(info_data.get("registered", {}).get("unixtime", 0))
    days_active = max(1, (int(time.time()) - registered) // 86400) if registered else 1

    # Top genre via iTunes (best effort, don't block on failure)
    top_genre = None
    if artists:
        top_genre = await _search_itunes_artist_genre(client, artists[0].get("name", ""))

    result = {
        "totalScrobbles": total_scrobbles,
        "totalArtists": int(info_data.get("artist_count", 0)),
        "totalTracks": int(info_data.get("track_count", 0)),
        "totalAlbums": int(info_data.get("album_count", 0)),
        "avgDaily": round(total_scrobbles / days_active),
        "memberSince": registered,
        "topArtist": {"name": artists[0].get("name", ""), "playcount": int(artists[0].get("playcount", 0))} if artists else None,
        "topArtists": [
            {"name": a.get("name", ""), "playcount": int(a.get("playcount", 0))}
            for a in artists[:5]
        ],
        "topTrack": {"name": tracks[0].get("name", ""), "artist": tracks[0].get("artist", {}).get("name", ""), "playcount": int(tracks[0].get("playcount", 0))} if tracks else None,
        "topTracks": [
            {"name": t.get("name", ""), "artist": t.get("artist", {}).get("name", ""), "playcount": int(t.get("playcount", 0))}
            for t in tracks[:5]
        ],
        "topAlbum": {"name": albums[0].get("name", ""), "artist": albums[0].get("artist", {}).get("name", ""), "playcount": int(albums[0].get("playcount", 0))} if albums else None,
        "topGenre": top_genre,
    }

    stats_cache[user] = (result, time.time())
    return result


LASTFM_TOP_METHODS = {
    "artists": ("user.gettopartists", "topartists", "artist"),
    "tracks": ("user.gettoptracks", "toptracks", "track"),
    "albums": ("user.gettopalbums", "topalbums", "album"),
}

ITUNES_ENTITIES = {
    "artists": "musicArtist",
    "tracks": "song",
    "albums": "album",
}


@app.get("/api/top")
@limiter.limit("60/minute")
async def get_top_items(
    request: Request,
    type: str = Query(..., pattern="^(artists|tracks|albums)$"),
    user: str = Query(..., min_length=1),
    period: str = Query("7day"),
    limit: int = Query(10, ge=1, le=50),
):
    """Top artists/tracks/albums with artwork fallback via iTunes."""
    client = request.app.state.http_client
    method, root_key, item_key = LASTFM_TOP_METHODS[type]
    itunes_entity = ITUNES_ENTITIES[type]

    resp = await client.get(LASTFM_API_URL, params={
        "method": method, "user": user, "api_key": API_KEY,
        "format": "json", "period": period, "limit": str(limit),
    })
    data = resp.json()
    raw_items = data.get(root_key, {}).get(item_key, [])

    items = []
    for item in raw_items[:limit]:
        name = item.get("name", "")
        playcount = int(item.get("playcount", 0))
        url = item.get("url", "")
        lastfm_img = _pick_image(item)

        if type == "artists":
            subtitle = ""
            search_query = name
        else:
            artist_name = item.get("artist", {}).get("name", "") if isinstance(item.get("artist"), dict) else str(item.get("artist", ""))
            subtitle = artist_name
            search_query = f"{artist_name} {name}"

        items.append({
            "name": name,
            "subtitle": subtitle,
            "playcount": playcount,
            "imageUrl": lastfm_img or "",
            "url": url,
        })

    # Resolve missing artwork in parallel via iTunes
    async def resolve(entry: dict):
        if not _is_placeholder(entry["imageUrl"]):
            return
        cache_key = _track_hash(type, entry["name"] + entry["subtitle"])
        cached = _get_cached_artwork(cache_key)
        if cached is not ...:
            entry["imageUrl"] = cached[0] or ""
            return
        if entry["subtitle"]:
            query = f"{entry['subtitle']} {entry['name']}"
        else:
            query = entry["name"]
        # For artists, try Spotify first (best coverage), then Deezer, then iTunes
        if itunes_entity == "musicArtist":
            art = await _search_spotify_artist(client, entry["name"])
            if not art:
                art = await _search_deezer_artist(client, entry["name"])
            if not art:
                art = await _search_itunes_entity(client, query, itunes_entity)
        else:
            # Try Spotify first (most accurate for active listeners)
            art, _ = await _search_spotify_track(client, entry.get("subtitle", ""), entry["name"])
            # Fallback: iTunes with full "artist trackname" query
            if not art:
                art = await _search_itunes_entity(client, query, itunes_entity)
            # Fallback: Deezer (different catalog, better fuzzy matching)
            if not art:
                art = await _search_deezer_track(client, query)
            # Fallback: iTunes with just the track/album name
            if not art:
                art = await _search_itunes_entity(client, entry["name"], itunes_entity)
        _set_cached_artwork(cache_key, art)
        entry["imageUrl"] = art or ""

    await asyncio.gather(*(resolve(it) for it in items), return_exceptions=True)

    return items


# Genre cache: user+period -> (result, timestamp)
genre_cache: dict[str, tuple[list, float]] = {}
GENRE_CACHE_TTL = 60 * 60  # 1 hour


async def _search_itunes_artist_genre(client: httpx.AsyncClient, artist: str) -> str | None:
    """Get an artist's primary genre from iTunes/Apple Music.

    Uses a dedicated genre cache. (Earlier versions piggy-backed on the
    artwork cache, which returns ``(url, duration)`` tuples — that caused
    ``top_genre`` to become a tuple on cache hits and crashed downstream
    code that called ``.split("/")`` on the result.)
    """
    cached = _get_cached_genre(artist)
    if cached is not ...:
        return cached[0]

    try:
        resp = await client.get(
            "https://itunes.apple.com/search",
            params={"term": artist, "media": "music", "entity": "musicArtist", "limit": 1},
            timeout=5.0,
        )
        data = resp.json()
        results = data.get("results", [])
        if results:
            genre = results[0].get("primaryGenreName")
            _set_cached_genre(artist, genre)
            return genre
    except Exception:
        pass
    _set_cached_genre(artist, None)
    return None


@app.get("/api/genres")
@limiter.limit("30/minute")
async def get_genres(
    request: Request,
    user: str = Query(..., min_length=1),
    period: str = Query("3month"),
):
    """Genre breakdown via iTunes artist genre lookups, weighted by playcount."""
    # Scale artist sample by period — short periods have limited data,
    # longer periods need more artists to reveal genre diversity
    PERIOD_LIMITS = {
        "7day": 20, "1month": 50, "3month": 80,
        "6month": 120, "12month": 150, "overall": 200,
    }
    artist_limit = PERIOD_LIMITS.get(period, 50)

    cache_key = f"{user}:{period}"
    cached = genre_cache.get(cache_key)
    if cached and time.time() - cached[1] < GENRE_CACHE_TTL:
        return cached[0]
    _evict_oldest(genre_cache, STATS_CACHE_MAX, 1)

    client = request.app.state.http_client

    # Fetch top 20 artists for this period
    resp = await client.get(LASTFM_API_URL, params={
        "method": "user.gettopartists", "user": user, "api_key": API_KEY,
        "format": "json", "period": period, "limit": str(artist_limit),
    })
    data = resp.json()
    artists = data.get("topartists", {}).get("artist", [])

    # Resolve genres in parallel via iTunes
    genre_weights: dict[str, int] = {}

    async def resolve_genre(artist_data: dict):
        name = artist_data.get("name", "")
        plays = int(artist_data.get("playcount", 0))
        genre = await _search_itunes_artist_genre(client, name)
        if genre:
            # Normalize: "Hip-Hop/Rap" -> split and count both
            for part in genre.split("/"):
                part = part.strip()
                if part:
                    genre_weights[part] = genre_weights.get(part, 0) + plays

    await asyncio.gather(*(resolve_genre(a) for a in artists[:artist_limit]), return_exceptions=True)

    if not genre_weights:
        genre_cache[cache_key] = ([], time.time())
        return []

    # Sort by weight, take top 8
    sorted_genres = sorted(genre_weights.items(), key=lambda x: -x[1])[:8]
    total = sum(w for _, w in sorted_genres)

    result = [
        {"name": name, "weight": round(w / total, 3) if total > 0 else 0}
        for name, w in sorted_genres
    ]

    genre_cache[cache_key] = (result, time.time())
    return result


# Listening clock cache
clock_cache: dict[str, tuple[list, float]] = {}
CLOCK_CACHE_TTL = 60 * 60  # 1 hour


@app.get("/api/clock")
@limiter.limit("20/minute")
async def get_listening_clock(request: Request, user: str = Query(..., min_length=1), tz: str = Query("UTC")):
    """Listening heatmap — fetches multiple pages of recent tracks to build a 7x24 grid."""
    cache_key = f"{user}:{tz}"
    cached = clock_cache.get(cache_key)
    if cached and time.time() - cached[1] < CLOCK_CACHE_TTL:
        return cached[0]

    client = request.app.state.http_client
    grid = [[0] * 24 for _ in range(7)]  # [day][hour], day 0=Mon

    from datetime import datetime, timezone, timedelta
    from zoneinfo import ZoneInfo
    try:
        user_tz = ZoneInfo(tz)
    except (KeyError, Exception):
        user_tz = ZoneInfo("UTC")

    now = datetime.now(tz=user_tz)
    cutoff = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff_uts = int(cutoff.astimezone(timezone.utc).timestamp())

    # Pull only the last 7 days using Last.fm's `from=` filter rather than
    # paging through everything ever scrobbled. Most users fit in 1–3 pages;
    # cap at 5 (1000 tracks) as a safety bound for very heavy listeners.
    for page in range(1, 6):
        # Try the page, retry once on failure
        data = None
        for attempt in range(2):
            try:
                resp = await client.get(LASTFM_API_URL, params={
                    "method": "user.getrecenttracks",
                    "user": user,
                    "api_key": API_KEY,
                    "format": "json",
                    "limit": "200",
                    "page": str(page),
                    "from": str(cutoff_uts),
                })
                body = resp.json()
                if body.get("recenttracks", {}).get("track"):
                    data = body
                    break
                # Empty response is legitimate when the user has no scrobbles
                # in the last 7 days — only retry on the first attempt.
                if attempt == 0:
                    await asyncio.sleep(0.5)
            except Exception:
                if attempt == 0:
                    await asyncio.sleep(0.5)

        if not data:
            break

        tracks = data.get("recenttracks", {}).get("track", [])

        for track in tracks:
            if track.get("@attr", {}).get("nowplaying") == "true":
                continue
            date_info = track.get("date")
            if not date_info or not date_info.get("uts"):
                continue
            dt = datetime.fromtimestamp(int(date_info["uts"]), tz=timezone.utc).astimezone(user_tz)
            # `from=` should already exclude this, but Last.fm's bounds aren't
            # always strict — keep the guard.
            if dt < cutoff:
                continue
            day = dt.weekday()  # 0=Mon
            hour = dt.hour
            grid[day][hour] += 1

        # If we've exhausted the windowed result set, stop paging
        attr = data.get("recenttracks", {}).get("@attr", {})
        total_pages = int(attr.get("totalPages", 1))
        if page >= total_pages:
            break

    # Only cache non-empty grids — if Last.fm was rate-limited / errored,
    # we'd cache all-zeros for an hour and block retries
    if any(count for row in grid for count in row):
        _evict_oldest(clock_cache, STATS_CACHE_MAX, 1)
        clock_cache[cache_key] = (grid, time.time())
    return grid


_BLOCKED_NETWORKS = (
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),  # CGNAT
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),  # ULA
    ipaddress.ip_network("fe80::/10"),  # link-local v6
)


def _ip_blocked(ip: ipaddress._BaseAddress) -> bool:
    if ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        return True
    return any(ip in net for net in _BLOCKED_NETWORKS)


async def _host_is_blocked(host: str) -> bool:
    """Resolve ``host`` and reject if any candidate IP is private/loopback/etc.

    Mitigates SSRF — without this, an attacker can ask the proxy to fetch
    internal-network resources by passing e.g. ``http://10.0.0.1/`` or a
    public hostname whose A record resolves to a private address.

    Note: this resolution is advisory. There's a TOCTOU window between this
    DNS check and httpx's own resolution at connect-time. ``_peer_is_blocked``
    closes that gap by re-validating the actually-connected IP after the
    socket is open.
    """
    if not host:
        return True
    # Literal IP — check directly without DNS
    try:
        return _ip_blocked(ipaddress.ip_address(host.strip("[]")))
    except ValueError:
        pass
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, None)
    except (socket.gaierror, OSError):
        return True  # unresolvable — block
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr.split("%", 1)[0])  # strip v6 zone-id
        except ValueError:
            return True
        if _ip_blocked(ip):
            return True
    return False


def _peer_is_blocked(resp: httpx.Response) -> bool:
    """Inspect the response's underlying socket and reject if the actually-
    connected peer IP is private/loopback/etc.

    This catches DNS TOCTOU — between ``_host_is_blocked`` (which resolves
    via the standard resolver) and httpx's own resolution at connect-time,
    DNS could have flipped to a blocked IP. We verify the peer post-connect
    and abort before reading the body.
    """
    stream = resp.extensions.get("network_stream") if hasattr(resp, "extensions") else None
    if stream is None:
        return False
    try:
        peer = stream.get_extra_info("server_addr")
    except Exception:
        return False
    if not peer:
        return False
    try:
        ip = ipaddress.ip_address(str(peer[0]).split("%", 1)[0])
    except (ValueError, IndexError, TypeError):
        return False
    return _ip_blocked(ip)


ARTWORK_MAX_BYTES = 10 * 1024 * 1024  # 10 MB ceiling on a single image fetch


@app.get("/api/artwork")
@limiter.limit("300/minute")
async def proxy_artwork(request: Request, url: str = Query(..., min_length=8, max_length=2048)):
    """CORS-compliant image proxy for Vibrant.js color extraction.

    Rejects non-http(s) schemes, hosts that resolve to private/loopback IPs,
    redirects (which could bypass host validation), non-image content types,
    and responses larger than ``ARTWORK_MAX_BYTES``.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Invalid URL scheme")
    host = (parsed.hostname or "").lower()
    if await _host_is_blocked(host):
        raise HTTPException(400, "Blocked host")

    client = request.app.state.http_client
    try:
        async with client.stream(
            "GET", url,
            headers={"User-Agent": "ryplay/1.0", "Accept": "image/*"},
            # follow_redirects disabled: a redirect could point at a private
            # IP and bypass the host check above. The image CDNs we hit
            # (Spotify, Deezer, iTunes, Last.fm) all serve images directly.
            follow_redirects=False,
        ) as resp:
            # Re-validate the actual peer IP — closes the DNS TOCTOU window
            # between _host_is_blocked() and httpx's own DNS lookup.
            if _peer_is_blocked(resp):
                raise HTTPException(400, "Blocked peer IP")
            if resp.status_code >= 400:
                raise HTTPException(502, "Upstream error")
            if resp.status_code in (301, 302, 303, 307, 308):
                raise HTTPException(502, "Upstream redirect not allowed")
            content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip().lower()
            if not content_type.startswith("image/"):
                raise HTTPException(415, "Not an image")
            declared = resp.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > ARTWORK_MAX_BYTES:
                raise HTTPException(413, "Image too large")
            buf = bytearray()
            async for chunk in resp.aiter_bytes():
                buf.extend(chunk)
                if len(buf) > ARTWORK_MAX_BYTES:
                    raise HTTPException(413, "Image too large")
            content = bytes(buf)
    except httpx.RequestError:
        raise HTTPException(404, "Image not found")

    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )




if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
