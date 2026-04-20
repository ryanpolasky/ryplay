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
| Backend          | Python, FastAPI, httpx                                            |
| Color Extraction | node-vibrant/browser with canvas median-cut fallback              |
| Artwork Lookup   | Spotify Web API > Deezer > iTunes Search API (cascading fallback) |
| Genre Data       | iTunes/Apple Music artist genre lookups                           |

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

## API Endpoints

| Endpoint                                  | Description                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `GET /api/music?user=`                    | Now playing + recent tracks with streak detection and artwork fallback |
| `GET /api/music/stats?user=`              | Profile overview: all-time stats, #1 artist/track/album, top genre     |
| `GET /api/top?type=&user=&period=&limit=` | Top artists/tracks/albums with cascading artwork fallback              |
| `GET /api/genres?user=&period=`           | Genre breakdown via iTunes artist genre lookups                        |
| `GET /api/clock?user=&tz=`                | Listening clock heatmap (up to 2000 tracks, 7x24 grid)                 |
| `GET /api/artwork?url=`                   | CORS-compliant image proxy for color extraction                        |
| `GET /api/lastfm`                         | Generic Last.fm API proxy                                              |

## Spotify Lite Mode (Commented Out)

A Spotify-connected lite dashboard was built but is commented out. Spotify changed their API policy to require 250k MAU for production access, effectively killing indie development. The code is all still there if they ever reverse this decision:

- `src/components/SpotifyDashboard.tsx`, `SpotifyCallback.tsx`, `SpotifyTopList.tsx`, `SpotifyPeriodSelector.tsx`, `UnlockPanel.tsx`
- `src/hooks/useSpotifyNowPlaying.ts`, `useSpotifyTopItems.ts`
- `src/types/spotify.ts`
- Backend endpoints in `backend/main.py` (`/api/spotify/*`)
- Commented-out routing in `src/App.tsx` and connect button in `src/components/Landing.tsx`

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
    lib/                # Backgrounds, favicon generator
```

Built with <3 by [ryanpolasky](https://linkedin.com/in/ryan-polasky)
