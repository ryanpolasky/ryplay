import { useState, useEffect } from "react";

export type ClockData = number[][]; // [day][hour] = count, day 0=Mon

export function useListeningClock(username: string) {
  const [clockData, setClockData] = useState<ClockData>(
    Array.from({ length: 7 }, () => Array(24).fill(0) as number[]),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/clock?user=${encodeURIComponent(username)}&tz=${encodeURIComponent(tz)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
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
