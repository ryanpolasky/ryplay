# ryplay

Your music, visualized. A real-time music stats dashboard powered by Last.fm.

<img width="1200" height="721" alt="og" src="https://github.com/user-attachments/assets/62addbd2-5ee2-44bf-801f-bb7100352fed" />

## Features

- **Now Playing** - live track display with album art, animated EQ bars, and dynamic color extraction
- **Recently Played** - track history with streak detection (x2 REPEAT through x10+ OBSESSED)
- **Profile Overview** - all-time stats: scrobbles, artists, tracks, albums, daily average, top genre, #1s
- **Top Artists / Tracks / Albums** - filterable by time period (7 days to all time)
- **Genre Breakdown** - powered by iTunes/Apple Music artist genre data
- **Listening Clock** - 7-day heatmap of listening activity by hour
- **Shareable Stats Card** - generates a 1080x1350 PNG summary with album art, stats, and top artists/tracks
- **Dynamic Theming** - background, logo, and favicon colors extracted from current album art
- **8 Backgrounds** - Default, Solid, Gradient, Dual Tone, Embers, Reactive, Smoke, and Nebula
- **Customizable Fonts** - choose from multiple font options in the settings panel
- **URL Routing** - shareable profiles at `ryplay.dev/{username}`
- **Auto-hide UI** - chrome fades after 15s idle, on window blur, or tab switch
- **Keyboard Navigation** - arrow keys to move between panels

## Tech Stack

| Layer            | Tech                                                              |
| ---------------- | ----------------------------------------------------------------- |
| Frontend         | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion        |
| Backend          | Python, FastAPI, httpx, slowapi                                   |
| Color Extraction | node-vibrant/browser with canvas median-cut fallback              |
| Artwork Lookup   | Spotify Web API > Deezer > iTunes Search API (cascading fallback) |
| Genre Data       | iTunes/Apple Music artist genre lookups                           |

## Setup

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Install backend dependencies

```bash
cd backend && pip install -r requirements.txt
```

### 3. Get a Last.fm API key

Free and instant at [last.fm/api/account/create](https://www.last.fm/api/account/create). Create `backend/.env`:

```
LASTFM_API_KEY=your_key_here
```

The backend refuses to start without this key set.

### 4. (Optional) Add Spotify credentials for better artwork

Spotify provides the most accurate album art, especially for niche artists. Create a free app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and add to `backend/.env`:

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

Without Spotify credentials, artwork falls back to Deezer and iTunes (still works fine, just less coverage for obscure tracks).

### 5. Run

```bash
# Terminal 1 - backend
cd backend && uvicorn main:app --reload

# Terminal 2 - frontend
npm run dev
```

Vite proxies `/api` to the FastAPI backend on port 8000.

### Run with Docker (alternative)

The repo ships a `docker-compose.yml` that builds the frontend (nginx) and backend (uvicorn) into a single internal network. The backend is not exposed publicly — nginx proxies `/api/*` to it.

```bash
# Set required env (or put in a top-level .env)
export LASTFM_API_KEY=your_key_here
export RYPLAY_ALLOWED_ORIGINS=http://localhost:8080

docker compose up --build
# open http://localhost:8080
```

## Environment Variables

| Variable                 | Required | Default | Description                                                                                          |
| ------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `LASTFM_API_KEY`         | yes      | —       | Last.fm API key. Backend will refuse to start without it.                                            |
| `RYPLAY_ALLOWED_ORIGINS` | no       | `*`     | Comma-separated CORS allowlist. **Set to your real origin(s) in production**, e.g. `https://ryplay.dev` (or `https://ryplay.dev,https://www.ryplay.dev`). |
| `SPOTIFY_CLIENT_ID`      | no       | —       | Spotify app client ID. Improves artwork coverage and gives access to track durations for the progress bar. |
| `SPOTIFY_CLIENT_SECRET`  | no       | —       | Spotify app client secret. Pair with `SPOTIFY_CLIENT_ID`.                                            |
| `RYPLAY_HTTP_PORT`       | no       | `8080`  | (docker-compose only) Host port to expose the frontend nginx on.                                     |

For ryplay.dev's production deployment, the only env vars that need to be set are `LASTFM_API_KEY`, `RYPLAY_ALLOWED_ORIGINS=https://ryplay.dev`, and the optional Spotify pair.

## API Endpoints

| Endpoint                                  | Description                                                            | Rate Limit |
| ----------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| `GET /api/music?user=`                    | Now playing + recent tracks with streak detection and artwork fallback | 30/min     |
| `GET /api/music/stats?user=`              | Profile overview: all-time stats, #1 artist/track/album, top genre     | 30/min     |
| `GET /api/top?type=&user=&period=&limit=` | Top artists/tracks/albums with cascading artwork fallback              | 60/min     |
| `GET /api/genres?user=&period=`           | Genre breakdown via iTunes artist genre lookups                        | 30/min     |
| `GET /api/clock?user=&tz=`                | Listening clock heatmap (last 7 days, 7x24 grid)                       | 20/min     |
| `GET /api/artwork?url=`                   | CORS-compliant image proxy with SSRF protection                        | 300/min    |
| `GET /api/lastfm`                         | Generic Last.fm API proxy (allowlisted read methods only)              | 60/min     |

Limits are per-IP. Powered by [slowapi](https://github.com/laurentS/slowapi).

## Project Structure

```
ryplay/
  backend/
    main.py             # FastAPI server
    .env                # LASTFM_API_KEY + optional Spotify creds
  src/
    components/         # React components
    hooks/              # Data fetching + color extraction
    context/            # User + settings context
    types/              # TypeScript types
    lib/                # Backgrounds, favicon generator, artwork loader
  docker-compose.yml    # Local + single-host production deploy
  Dockerfile            # Frontend (nginx + built SPA)
  backend/Dockerfile    # Backend (uvicorn)
  nginx.conf            # SPA routing + /api proxy to ryplay-backend:8000
```

Built with <3 by [ryanpolasky](https://linkedin.com/in/ryan-polasky)
