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
|------------------|-------------------------------------------------------------------|
| Frontend         | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion        |
| Backend          | Cloudflare Worker (TypeScript) + Workers Assets, Cache API        |
| Color Extraction | node-vibrant/browser with canvas median-cut fallback              |
| Artwork Lookup   | Spotify Web API > Deezer > iTunes Search API (cascading fallback) |
| Genre Data       | Last.fm artist top tags, filtered to a genre allowlist            |

## Setup

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Get a Last.fm API key

Free and instant at [last.fm/api/account/create](https://www.last.fm/api/account/create). Create `.dev.vars`:

```
LASTFM_API_KEY=your_key_here
SPOTIFY_CLIENT_ID=optional
SPOTIFY_CLIENT_SECRET=optional
```

Spotify is optional: it improves artwork coverage and gives track durations for the progress bar. Without it, artwork falls back to Deezer and iTunes.

### 3. Run

```bash
npm run build && npm run dev:worker   # Worker + built assets on :8787
npm run dev                           # Vite on :5173, proxies /api to :8787
```

### Deploy

```bash
npx wrangler secret put LASTFM_API_KEY   # + SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
npm run deploy
```

`wrangler.jsonc` binds the `ryplay.dev` custom domain. Public API responses are cached with the Cache API (no KV), and genre lookups fan out across self-calls to stay under the Workers Free 50-subrequest limit.

## API Endpoints

| Endpoint                                  | Description                                                            | Rate Limit |
|-------------------------------------------|------------------------------------------------------------------------|------------|
| `GET /api/music?user=`                    | Now playing + recent tracks with streak detection and artwork fallback | 60/min     |
| `GET /api/music/stats?user=`              | Profile overview: all-time stats, #1 artist/track/album, top genre     | 60/min     |
| `GET /api/top?type=&user=&period=&limit=` | Top artists/tracks/albums with cascading artwork fallback              | 60/min     |
| `GET /api/genres?user=&period=`           | Genre breakdown via Last.fm artist tags                                | 60/min     |
| `GET /api/clock?user=&tz=`                | Listening clock heatmap (last 7 days, 7x24 grid)                       | 60/min     |
| `GET /api/artwork?url=`                   | CORS-compliant image proxy with SSRF protection                        | 300/min    |
| `GET /api/lastfm`                         | Generic Last.fm API proxy (allowlisted read methods only)              | 60/min     |

Limits are per-IP per endpoint, via Workers Rate Limiting bindings.

## Project Structure

```
ryplay/
  worker/index.ts       # Cloudflare Worker: /api/* + static assets
  wrangler.jsonc        # Worker config, custom domain, rate limits
  src/
    components/         # React components
    hooks/              # Data fetching + color extraction
    context/            # User + settings context
    types/              # TypeScript types
    lib/                # Backgrounds, favicon generator, artwork loader
  public/_headers       # Static asset cache headers
```

Built with <3 by [ryanpolasky](https://linkedin.com/in/ryan-polasky)
