import type {
  UserInfo,
  RecentTrack,
  TopArtist,
  TopTrack,
  TopAlbum,
  ArtistTag,
  Period,
  LastfmImage,
} from "../types/lastfm";

async function fetchLastfm<T>(
  method: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL("/api/lastfm", window.location.origin);
  url.searchParams.set("method", method);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.message ?? "Last.fm error");
  return data as T;
}

export function getImageUrl(
  images: LastfmImage[],
  size: LastfmImage["size"] = "extralarge",
): string {
  const img = images.find((i) => i.size === size) ?? images[images.length - 1];
  return img?.["#text"] ?? "";
}

export async function getUserInfo(user: string): Promise<UserInfo> {
  const data = await fetchLastfm<{ user: UserInfo }>("user.getinfo", { user });
  return data.user;
}

export async function getRecentTracks(
  user: string,
  limit = 20,
): Promise<RecentTrack[]> {
  const data = await fetchLastfm<{
    recenttracks: { track: RecentTrack[] };
  }>("user.getrecenttracks", { user, limit: String(limit) });
  return data.recenttracks?.track ?? [];
}

export async function getTopArtists(
  user: string,
  period: Period,
  limit = 10,
): Promise<TopArtist[]> {
  const data = await fetchLastfm<{
    topartists: { artist: TopArtist[] };
  }>("user.gettopartists", { user, period, limit: String(limit) });
  return data.topartists?.artist ?? [];
}

export async function getTopTracks(
  user: string,
  period: Period,
  limit = 10,
): Promise<TopTrack[]> {
  const data = await fetchLastfm<{
    toptracks: { track: TopTrack[] };
  }>("user.gettoptracks", { user, period, limit: String(limit) });
  return data.toptracks?.track ?? [];
}

export async function getTopAlbums(
  user: string,
  period: Period,
  limit = 10,
): Promise<TopAlbum[]> {
  const data = await fetchLastfm<{
    topalbums: { album: TopAlbum[] };
  }>("user.gettopalbums", { user, period, limit: String(limit) });
  return data.topalbums?.album ?? [];
}

export async function getArtistTags(artist: string): Promise<ArtistTag[]> {
  const data = await fetchLastfm<{
    toptags: { tag: ArtistTag[] };
  }>("artist.gettoptags", { artist });
  return data.toptags?.tag ?? [];
}
