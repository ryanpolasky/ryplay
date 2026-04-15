import { useState, useEffect } from "react";
import type { TopItem, Period } from "../types/lastfm";

type ItemType = "artists" | "tracks" | "albums";

export function useTopItems(
  username: string,
  type: ItemType,
  period: Period,
  limit = 10,
) {
  const [items, setItems] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      type,
      user: username,
      period,
      limit: String(limit),
    });

    fetch(`/api/top?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data: TopItem[]) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to fetch");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, type, period, limit]);

  return { items, loading, error };
}
