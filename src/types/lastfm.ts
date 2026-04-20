export interface LastfmImage {
  "#text": string;
  size: "small" | "medium" | "large" | "extralarge";
}

export interface UserInfo {
  name: string;
  realname: string;
  playcount: string;
  artist_count: string;
  track_count: string;
  album_count: string;
  image: LastfmImage[];
  registered: { unixtime: string; "#text": string };
  country: string;
  url: string;
}

export interface RecentTrack {
  artist: { "#text": string; mbid: string };
  name: string;
  album: { "#text": string; mbid: string };
  image: LastfmImage[];
  date?: { uts: string; "#text": string };
  "@attr"?: { nowplaying: string };
  url: string;
}

export interface TopArtist {
  name: string;
  playcount: string;
  url: string;
  image: LastfmImage[];
  "@attr"?: { rank: string };
}

export interface TopTrack {
  name: string;
  playcount: string;
  artist: { name: string; url: string; mbid: string };
  image: LastfmImage[];
  url: string;
  "@attr"?: { rank: string };
}

export interface TopAlbum {
  name: string;
  playcount: string;
  artist: { name: string; url: string; mbid: string };
  image: LastfmImage[];
  url: string;
  "@attr"?: { rank: string };
}

export interface ArtistTag {
  name: string;
  count: number;
  url: string;
}

export type Period =
  | "7day"
  | "1month"
  | "3month"
  | "6month"
  | "12month"
  | "overall";

export const PERIOD_LABELS: Record<Period, string> = {
  "7day": "7 days",
  "1month": "1 month",
  "3month": "3 months",
  "6month": "6 months",
  "12month": "12 months",
  overall: "all time",
};

// --- Processed types (from /api/music and /api/music/stats) ---

export interface PaletteColors {
  dominant: string;
  muted: string;
  vibrant: string;
  light: string;
  dark: string;
}

export interface ProcessedTrack {
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  trackUrl: string;
  timestamp: number;
  streak?: number;
}

export interface MusicData {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  trackUrl?: string;
  updatedAt?: number;
  durationMs?: number;
  recentTracks: ProcessedTrack[];
}

export interface StatsData {
  totalScrobbles: number;
  totalArtists: number;
  totalTracks: number;
  totalAlbums: number;
  avgDaily: number;
  memberSince: number;
  topArtist: { name: string; playcount: number } | null;
  topArtists: { name: string; playcount: number }[];
  topTrack: { name: string; artist: string; playcount: number } | null;
  topTracks: { name: string; artist: string; playcount: number }[];
  topAlbum: { name: string; artist: string; playcount: number } | null;
  topGenre: string | null;
}

export interface TopItem {
  name: string;
  subtitle: string;
  playcount: number;
  imageUrl: string;
  url: string;
}

export const DEFAULT_PALETTE: PaletteColors = {
  dominant: "#404040",
  muted: "#262626",
  vibrant: "#525252",
  light: "#737373",
  dark: "#171717",
};
