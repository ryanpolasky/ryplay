import { useState, useEffect } from "react";

export type ClockData = number[][]; // [day][hour] = count, day 0=Mon

// Prefetch cache so data is ready before the component mounts
const prefetchCache: Record<string, Promise<number[][]>> = {};

function fetchClockData(username: string): Promise<number[][]> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return fetch(
    `/api/clock?user=${encodeURIComponent(username)}&tz=${encodeURIComponent(tz)}`,
  )
    .then((res) => {
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    });
}

/** Call early (e.g. on Dashboard mount) so data is warm by scroll-time */
export function prefetchListeningClock(username: string) {
  if (!prefetchCache[username]) {
    prefetchCache[username] = fetchClockData(username);
  }
}

export function useListeningClock(username: string) {
  const [clockData, setClockData] = useState<ClockData>(
    Array.from({ length: 7 }, () => Array(24).fill(0) as number[]),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    // Use prefetched promise if available, otherwise fetch fresh
    const dataPromise = prefetchCache[username]
      ? prefetchCache[username]
      : fetchClockData(username);
    delete prefetchCache[username];

    dataPromise
      .then((grid: number[][]) => {
        if (!cancelled) {
          setClockData(grid);
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
  }, [username]);

  return { clockData, loading, error };
}
