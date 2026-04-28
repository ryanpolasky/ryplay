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
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel any poll already in flight so a late response can't clobber
    // a fresher one (or the next user's data on username change).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/music?user=${encodeURIComponent(username)}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: MusicData = await res.json();

      if (controller.signal.aborted) return;

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
      if (controller.signal.aborted) return;
      lastArtworkRef.current = newArt;

      setMusic(data);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [username]);

  // Reset loading state on username change so the consumer sees a proper
  // loading flicker instead of stale data while the new user's first
  // response is in flight.
  useEffect(() => {
    setLoading(true);
    setMusic(null);
    lastArtworkRef.current = null;
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
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { music, loading, error };
}
