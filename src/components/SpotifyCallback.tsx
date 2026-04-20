import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";

export default function SpotifyCallback() {
  const { setSpotifySession } = useUser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No authorization code received");
      return;
    }

    let cancelled = false;

    fetch("/api/spotify/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSpotifySession({
          id: data.id,
          displayName: data.displayName,
          imageUrl: data.imageUrl,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Connection failed");
      });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="h-dvh w-screen bg-[#060609] flex flex-col items-center justify-center gap-4 text-white">
        <p className="text-red-400/80 text-sm">{error}</p>
        <a
          href="/"
          className="text-white/30 text-sm hover:text-white/50 transition-colors"
        >
          back to home
        </a>
      </div>
    );
  }

  return (
    <div className="h-dvh w-screen bg-[#060609] flex items-center justify-center">
      <div className="flex items-center gap-3 text-white/30 text-sm">
        <svg
          className="w-4 h-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
        connecting to spotify...
      </div>
    </div>
  );
}
