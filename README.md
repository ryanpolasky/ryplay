# ryplay

What Ryan is listening to right now. Archived side project, live at [ryplay.ryanpolasky.com](https://ryplay.ryanpolasky.com).

Originally a multi-user Last.fm dashboard. When Last.fm put API keys behind Pro, it became a single-user dashboard backed by [ListenBrainz](https://listenbrainz.org): a cron mirrors listens into D1 and every stat is computed locally.

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
- **Auto-hide UI** - chrome fades after 15s idle, on window blur, or tab switch
- **Keyboard Navigation** - arrow keys to move between panels

## Tech Stack

| Layer            | Tech                                                              |
|------------------|-------------------------------------------------------------------|
| Frontend         | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion        |
| Backend          | Cloudflare Worker (TypeScript) + Workers Assets, D1, Cache API    |
| Listen Data      | ListenBrainz listens mirrored into D1 every minute                |
| Color Extraction | node-vibrant/browser with canvas median-cut fallback              |
| Artwork Lookup   | Spotify Web API > Deezer > Cover Art Archive > iTunes             |
| Genre Data       | MusicBrainz artist tags via ListenBrainz, mapped to an allowlist  |

## Setup

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Configure

`LB_USER` in `wrangler.jsonc` is the ListenBrainz user to mirror. Optionally create `.dev.vars`:

```
SPOTIFY_CLIENT_ID=optional
SPOTIFY_CLIENT_SECRET=optional
```

Spotify is optional: it improves artwork coverage and gives track durations for the progress bar. Without it, artwork falls back to Deezer and iTunes.

### 3. Run

```bash
npx wrangler d1 migrations apply ryplay --local
npm run build && npm run dev:worker   # Worker + built assets on :8787
curl "localhost:8787/__scheduled?cron=*+*+*+*+*"   # with --test-scheduled, pulls listens
npm run dev                           # Vite on :5173, proxies /api to :8787
```

### Deploy

```bash
npx wrangler d1 migrations apply ryplay --remote
npx wrangler secret put SPOTIFY_CLIENT_ID   # + SPOTIFY_CLIENT_SECRET
npm run deploy
```

`wrangler.jsonc` binds `ryplay.ryanpolasky.com`; `ryplay.dev` 301s there until it expires. A once-a-minute cron pulls new listens from ListenBrainz, and re-walks history if ListenBrainz reports more listens than D1 has (e.g. after an import).

## API Endpoints

| Endpoint                                  | Description                                                            | Rate Limit |
|-------------------------------------------|------------------------------------------------------------------------|------------|
| `GET /api/music?user=`                    | Now playing + recent tracks with streak detection and artwork fallback | 60/min     |
| `GET /api/music/stats?user=`              | Profile overview: all-time stats, #1 artist/track/album, top genre     | 60/min     |
| `GET /api/top?type=&user=&period=&limit=` | Top artists/tracks/albums with cascading artwork fallback              | 60/min     |
| `GET /api/genres?user=&period=`           | Genre breakdown via MusicBrainz artist tags                            | 60/min     |
| `GET /api/clock?user=&tz=`                | Listening clock heatmap (last 7 days, 7x24 grid)                       | 60/min     |
| `GET /api/artwork?url=`                   | CORS-compliant image proxy with SSRF protection                        | 300/min    |
| `GET /api/lastfm?method=&user=`           | Last.fm-shaped read-only view of the mirror (`user.getinfo`, `user.getrecenttracks`, `user.gettop{artists,tracks,albums}`, `user.getweekly{chartlist,artistchart}`) | 60/min     |

`user` must be the configured `LB_USER`; anything else 404s. Limits are per-IP per endpoint, via Workers Rate Limiting bindings.

## Project Structure

```
ryplay/
  worker/index.ts       # Cloudflare Worker: /api/* + static assets
  worker/listens.ts     # ListenBrainz sync + D1 queries
  migrations/           # D1 schema
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
