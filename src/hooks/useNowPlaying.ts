import { useState, useEffect, useCallback, useRef } from "react";
import type { MusicData } from "../types/lastfm";

/** Preload an image into the browser cache. Resolves when ready, rejects after timeout. */
function preloadImage(src: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = "";
      reject(new Error("timeout"));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("load failed"));
    };
    img.src = src;
  });
}

export function useNowPlaying(username: string) {
  const [music, setMusic] = useState<MusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastArtworkRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/music?user=${encodeURIComponent(username)}`,
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: MusicData = await res.json();

      // If artwork changed, preload it before updating state so the
      // image renders instantly instead of flashing a loading state
      const newArt = data.artworkUrl || null;
      if (newArt && newArt !== lastArtworkRef.current) {
        try {
          await preloadImage(newArt);
        } catch {
          /* timeout/error — show song anyway */
        }
      }
      lastArtworkRef.current = newArt;

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
