import { useState, useEffect } from "react";
import type { TopItem } from "../types/lastfm";
import type { SpotifyTimeRange } from "../types/spotify";

type ItemType = "artists" | "tracks";

export function useSpotifyTopItems(
  sessionId: string,
  type: ItemType,
  timeRange: SpotifyTimeRange,
  limit = 5,
) {
  const [items, setItems] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const params = new URLSearchParams({
      sid: sessionId,
      type,
      time_range: timeRange,
      limit: String(limit),
    });

    fetch(`/api/spotify/top?${params}`, { signal: controller.signal })
      .then((res) => {
        if (res.status === 401) throw new Error("session expired");
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data: TopItem[]) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to fetch");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [sessionId, type, timeRange, limit]);

  return { items, loading, error };
}
