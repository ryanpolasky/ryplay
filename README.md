# ryplay

Your music, visualized. A real-time music stats dashboard powered by Last.fm.

<img width="1467" height="764" alt="Screenshot 2026-04-14 at 11 31 58 PM" src="https://github.com/user-attachments/assets/977b5759-094c-480b-9abe-f2ec2c1b7e05" />

## Features

- **Now Playing** - live track display with album art, animated EQ bars, and dynamic color extraction
- **Recently Played** - track history with streak detection (x2 REPEAT through x10+ OBSESSED)
- **Profile Overview** - all-time stats: scrobbles, artists, tracks, albums, daily average, top genre, #1s
- **Top Artists / Tracks / Albums** - filterable by time period (7 days to all time) with artwork via iTunes fallback
- **Genre Breakdown** - powered by iTunes/Apple Music artist genre data
- **Listening Clock** - 7-day heatmap of listening activity by hour
- **Shareable Stats Card** - generates a 1080x1350 PNG summary with album art, stats, and top artists/tracks
- **Dynamic Theming** - background, logo, and favicon colors extracted from current album art
- **URL Routing** - shareable profiles at `ryplay.dev/{username}`
- **Auto-hide UI** - chrome fades after 15s idle, on window blur, or tab switch
- **Keyboard Navigation** - arrow keys to move between panels

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion |
| Backend | Python, FastAPI, httpx |
| Color Extraction | Canvas-based median-cut quantization (node-vibrant/browser fallback) |
| Artwork Fallback | iTunes Search API |
| Genre Data | iTunes/Apple Music artist genre lookups |

## Setup

### 1. Install frontend dependencies

```bash
npm install framer-motion node-vibrant tailwindcss @tailwindcss/vite
```

### 2. Install backend dependencies

```bash
pip install fastapi uvicorn httpx python-dotenv
```

### 3. Get a Last.fm API key

Free and instant at [last.fm/api/account/create](https://www.last.fm/api/account/create). Create `backend/.env`:

```
LASTFM_API_KEY=your_key_here
```

### 4. Run

```bash
# Terminal 1 - backend
cd backend && uvicorn main:app --reload

# Terminal 2 - frontend
npm run dev
```

Vite proxies `/api` to the FastAPI backend on port 8000.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/music?user=` | Now playing + recent tracks with streak detection and artwork fallback |
| `GET /api/music/stats?user=` | Profile overview: all-time stats, #1 artist/track/album, top genre |
| `GET /api/top?type=&user=&period=&limit=` | Top artists/tracks/albums with iTunes artwork fallback |
| `GET /api/genres?user=&period=` | Genre breakdown via iTunes artist genre lookups |
| `GET /api/clock?user=` | Listening clock heatmap (2000 tracks, 7x24 grid) |
| `GET /api/artwork?url=` | CORS-compliant image proxy for color extraction |
| `GET /api/lastfm` | Generic Last.fm API proxy |

## Project Structure

```
ryplay/
  backend/
    main.py             # FastAPI server
    .env                # LASTFM_API_KEY
  src/
    components/         # React components
    hooks/              # Data fetching + color extraction
    context/            # User context + URL routing
    services/           # Last.fm API client
    types/              # TypeScript types
    lib/                # Favicon generator
  music-ref/            # Reference code from wrlt
```

Built with <3 by [ryanpolasky](https://linkedin.com/in/ryan-polasky)
