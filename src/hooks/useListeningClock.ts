import { useState, useEffect } from "react";

export type ClockData = number[][]; // [day][hour] = count, day 0=Mon

export function useListeningClock(username: string) {
  const [clockData, setClockData] = useState<ClockData>(
    Array.from({ length: 7 }, () => Array(24).fill(0) as number[]),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(
      `/api/clock?user=${encodeURIComponent(username)}&tz=${encodeURIComponent(tz)}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((grid: number[][]) => {
        setClockData(grid);
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
  }, [username]);

  return { clockData, loading, error };
}
