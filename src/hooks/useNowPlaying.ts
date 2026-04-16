import { useState, useEffect, useCallback } from "react";
import type { MusicData } from "../types/lastfm";

export function useNowPlaying(username: string) {
  const [music, setMusic] = useState<MusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/music?user=${encodeURIComponent(username)}`,
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: MusicData = await res.json();
      setMusic(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchData();
    let id = setInterval(fetchData, 10_000);

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        fetchData();
        id = setInterval(fetchData, 10_000);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

  return { music, loading, error };
}
