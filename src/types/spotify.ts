export type SpotifyTimeRange = "short_term" | "medium_term" | "long_term";

export const SPOTIFY_TIME_RANGES: {
  value: SpotifyTimeRange;
  label: string;
}[] = [
  { value: "short_term", label: "4 weeks" },
  { value: "medium_term", label: "6 months" },
  { value: "long_term", label: "all time" },
];

export interface SpotifySession {
  id: string;
  displayName: string;
  imageUrl?: string;
}
