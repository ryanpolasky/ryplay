import os
import time
import hashlib
import asyncio
from contextlib import asynccontextmanager
from urllib.parse import urlparse

import uvicorn
from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv

load_dotenv()

LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/"
API_KEY = os.getenv("LASTFM_API_KEY", "")
LASTFM_PLACEHOLDER_SUFFIX = "2a96cbd8b46e442fc41c2b86b821562f.png"

ARTWORK_CACHE_TTL = 6 * 60 * 60  # 6 hours
ARTWORK_CACHE_MAX = 500
STATS_CACHE_TTL = 60 * 60  # 1 hour
GRACE_PERIOD = 45  # seconds

# In-memory caches
artwork_cache: dict[str, tuple[str | None, float]] = {}
stats_cache: dict[str, tuple[dict, float]] = {}
grace_cache: dict[str, tuple[dict, float]] = {}  # user -> (last_playing_data, last_active_time)


def _track_hash(artist: str, title: str) -> str:
    return hashlib.md5(f"{artist}|{title}".encode()).hexdigest()


def _pick_image(track: dict) -> str | None:
    images = track.get("image", [])
    for size in ("extralarge", "large", "medium", "small"):
        for img in images:
            if img.get("size") == size and img.get("#text"):
                return img["#text"]
    return None


def _is_placeholder(url: str | None) -> bool:
    return not url or url.endswith(LASTFM_PLACEHOLDER_SUFFIX)


def _get_cached_artwork(track_id: str) -> str | None | type[...]:
    entry = artwork_cache.get(track_id)
    if entry is None:
        return ...  # sentinel: cache miss
    url, ts = entry
    if time.time() - ts > ARTWORK_CACHE_TTL:
        del artwork_cache[track_id]
        return ...
    return url


def _set_cached_artwork(track_id: str, url: str | None) -> None:
    if len(artwork_cache) >= ARTWORK_CACHE_MAX:
        oldest_key = min(artwork_cache, key=lambda k: artwork_cache[k][1])
        del artwork_cache[oldest_key]
    artwork_cache[track_id] = (url, time.time())


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


async def _resolve_artwork(client: httpx.AsyncClient, artist: str, title: str, lastfm_url: str | None) -> str:
    if not _is_placeholder(lastfm_url):
        return lastfm_url or ""

    track_id = _track_hash(artist, title)
    cached = _get_cached_artwork(track_id)
    if cached is not ...:
        return cached or ""

    itunes_url = await _search_itunes(client, artist, title)
    _set_cached_artwork(track_id, itunes_url)
    return itunes_url or ""


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
        if len(recent) >= 9:
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
            tasks.append((track, _resolve_artwork(client, track["artist"], track["title"], track.get("artworkUrl"))))

    if tasks:
        results = await asyncio.gather(*(t[1] for t in tasks), return_exceptions=True)
        for (track, _), result in zip(tasks, results):
            if isinstance(result, str):
                track["artworkUrl"] = result


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=15.0)
    yield
    await app.state.http_client.aclose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/lastfm")
async def lastfm_proxy(request: Request):
    """Generic Last.fm API proxy — used for top artists/tracks/albums by period, tags, etc."""
    params = dict(request.query_params)
    params["api_key"] = API_KEY
    params["format"] = "json"
    resp = await request.app.state.http_client.get(LASTFM_API_URL, params=params)
    return resp.json()


@app.get("/api/music")
async def get_music(user: str = Query(..., min_length=1), request: Request = None):
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
        artwork_url = await _resolve_artwork(client, artist, title, raw_art)

        result = {
            "isPlaying": True,
            "title": title,
            "artist": artist,
            "album": album,
            "artworkUrl": artwork_url,
            "trackUrl": now_playing.get("url", ""),
            "recentTracks": recent,
        }
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
        artwork_url = await _resolve_artwork(client, artist, title, raw_art)
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
async def get_music_stats(user: str = Query(..., min_length=1), request: Request = None):
    """Profile overview — all-time stats, 1 hour cache."""
    cached = stats_cache.get(user)
    if cached and time.time() - cached[1] < STATS_CACHE_TTL:
        return cached[0]

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
async def get_top_items(
    type: str = Query(..., pattern="^(artists|tracks|albums)$"),
    user: str = Query(..., min_length=1),
    period: str = Query("7day"),
    limit: int = Query(10, ge=1, le=50),
    request: Request = None,
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
            entry["imageUrl"] = cached or ""
            return
        if entry["subtitle"]:
            query = f"{entry['subtitle']} {entry['name']}"
        else:
            query = entry["name"]
        art = await _search_itunes_entity(client, query, itunes_entity)
        _set_cached_artwork(cache_key, art)
        entry["imageUrl"] = art or ""

    await asyncio.gather(*(resolve(it) for it in items), return_exceptions=True)

    return items


# Genre cache: user+period -> (result, timestamp)
genre_cache: dict[str, tuple[list, float]] = {}
GENRE_CACHE_TTL = 60 * 60  # 1 hour


async def _search_itunes_artist_genre(client: httpx.AsyncClient, artist: str) -> str | None:
    """Get an artist's primary genre from iTunes/Apple Music."""
    cache_key = _track_hash("genre", artist)
    cached = _get_cached_artwork(cache_key)  # reuse artwork cache for genre strings
    if cached is not ...:
        return cached

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
            _set_cached_artwork(cache_key, genre)
            return genre
    except Exception:
        pass
    _set_cached_artwork(cache_key, None)
    return None


@app.get("/api/genres")
async def get_genres(
    user: str = Query(..., min_length=1),
    period: str = Query("3month"),
    request: Request = None,
):
    """Genre breakdown via iTunes artist genre lookups, weighted by playcount."""
    cache_key = f"{user}:{period}"
    cached = genre_cache.get(cache_key)
    if cached and time.time() - cached[1] < GENRE_CACHE_TTL:
        return cached[0]

    client = request.app.state.http_client

    # Fetch top 20 artists for this period
    resp = await client.get(LASTFM_API_URL, params={
        "method": "user.gettopartists", "user": user, "api_key": API_KEY,
        "format": "json", "period": period, "limit": "20",
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

    await asyncio.gather(*(resolve_genre(a) for a in artists[:20]), return_exceptions=True)

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
async def get_listening_clock(user: str = Query(..., min_length=1), request: Request = None):
    """Listening heatmap — fetches multiple pages of recent tracks to build a 7x24 grid."""
    cached = clock_cache.get(user)
    if cached and time.time() - cached[1] < CLOCK_CACHE_TTL:
        return cached[0]

    client = request.app.state.http_client
    grid = [[0] * 24 for _ in range(7)]  # [day][hour], day 0=Mon

    # Fetch up to 10 pages (2000 tracks) for heavy listeners
    for page in range(1, 11):
        resp = await client.get(LASTFM_API_URL, params={
            "method": "user.getrecenttracks",
            "user": user,
            "api_key": API_KEY,
            "format": "json",
            "limit": "200",
            "page": str(page),
        })
        data = resp.json()
        tracks = data.get("recenttracks", {}).get("track", [])
        if not tracks:
            break

        for track in tracks:
            if track.get("@attr", {}).get("nowplaying") == "true":
                continue
            date_info = track.get("date")
            if not date_info or not date_info.get("uts"):
                continue
            from datetime import datetime, timezone
            dt = datetime.fromtimestamp(int(date_info["uts"]), tz=timezone.utc).astimezone()
            day = (dt.weekday())  # 0=Mon
            hour = dt.hour
            grid[day][hour] += 1

        # If last page had fewer than 200, no more pages
        attr = data.get("recenttracks", {}).get("@attr", {})
        total_pages = int(attr.get("totalPages", 1))
        if page >= total_pages:
            break

    clock_cache[user] = (grid, time.time())
    return grid


@app.get("/api/artwork")
async def proxy_artwork(url: str = Query(..., min_length=8, max_length=2048), request: Request = None):
    """CORS-compliant image proxy for Vibrant.js color extraction."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Invalid URL scheme")
    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1"):
        raise HTTPException(400, "Refusing localhost")

    client = request.app.state.http_client
    try:
        resp = await client.get(url, headers={
            "User-Agent": "ryplay/1.0",
            "Accept": "image/*",
        }, follow_redirects=True)
    except httpx.RequestError:
        raise HTTPException(404, "Image not found")

    if resp.status_code >= 400:
        raise HTTPException(502, "Upstream error")

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]

    return Response(
        content=resp.content,
        media_type=content_type,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
