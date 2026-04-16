import { useState, useEffect } from "react";
import type { Period } from "../types/lastfm";

export interface GenreData {
  name: string;
  weight: number;
  color: string;
}

const GENRE_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
];

export function useGenreBreakdown(username: string, period: Period) {
  const [genres, setGenres] = useState<GenreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    fetch(`/api/genres?user=${encodeURIComponent(username)}&period=${period}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data: { name: string; weight: number }[]) => {
        setGenres(
          data.map((g, i) => ({
            ...g,
            color: GENRE_COLORS[i % GENRE_COLORS.length],
          })),
        );
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
  }, [username, period]);

  return { genres, loading, error };
}
