import { useState, useEffect } from "react";

export type ClockData = number[][]; // [day][hour] = count, day 0=Mon

// Prefetch cache so data is ready before the component mounts
const prefetchCache: Record<string, Promise<number[][]>> = {};

function fetchClockData(username: string): Promise<number[][]> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return fetch(
    `/api/clock?user=${encodeURIComponent(username)}&tz=${encodeURIComponent(tz)}`,
  ).then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }).then((grid: number[][]) => {
    // Treat an all-zeros grid as an error so prefetch doesn't cache a dud
    if (!grid.some((row) => row.some((c) => c > 0))) {
      throw new Error("empty");
    }
    return grid;
  });
}

/** Call early (e.g. on Dashboard mount) so data is warm by scroll-time */
export function prefetchListeningClock(username: string) {
  if (!prefetchCache[username]) {
    prefetchCache[username] = fetchClockData(username).catch(() => {
      // Don't let a failed prefetch stick around — allow retry on mount
      delete prefetchCache[username];
      return Promise.reject(new Error("prefetch failed"));
    });
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
    // @ts-expect-error this is fine
    const dataPromise: Promise<number[][]> = prefetchCache[username]
      ? prefetchCache[username]
      : fetchClockData(username);
    delete prefetchCache[username];

    const onSuccess = (grid: number[][]) => {
      if (!cancelled) {
        setClockData(grid);
        setError(null);
        setLoading(false);
      }
    };

    dataPromise.then(onSuccess).catch(() => {
      // Retry once after a short delay (rate limit / transient failure)
      if (cancelled) return;
      setTimeout(() => {
        if (cancelled) return;
        fetchClockData(username)
          .then(onSuccess)
          .catch((err) => {
            if (!cancelled) {
              setError(
                err instanceof Error ? err.message : "Failed to fetch",
              );
              setLoading(false);
            }
          });
      }, 3000);
    });

    return () => {
      cancelled = true;
    };
  }, [username]);

  return { clockData, loading, error };
}
