import { useState, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../context/UserContext";
import Logo, { PASTEL_PALETTES, randomPaletteIndex } from "./Logo";
import { setGradientFavicon } from "../lib/favicon";

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export default function Landing() {
  const { setUsername } = useUser();
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [paletteIdx, setPaletteIdx] = useState(() => randomPaletteIndex());

  const palette = PASTEL_PALETTES[paletteIdx];

  // Sync favicon to active palette
  useEffect(() => {
    setGradientFavicon(palette.from, palette.to);
  }, [palette]);

  const cyclePalette = () => {
    setPaletteIdx((prev) => (prev + 1) % PASTEL_PALETTES.length);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = input.trim();
    if (!name) return;

    setChecking(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/lastfm?method=user.getinfo&user=${encodeURIComponent(name)}`,
      );
      const data = await res.json();
      if (data.error) {
        setError("user not found - check the spelling");
        setChecking(false);
        return;
      }
      setUsername(name);
    } catch {
      setError("couldn't reach the server");
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060609] relative overflow-hidden">
      {/* Ambient blobs — follow active palette */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] rounded-full blur-[120px] animate-[drift_20s_ease-in-out_infinite]"
          animate={{ backgroundColor: hexToRgba(palette.from, 0.15) }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] animate-[drift_25s_ease-in-out_infinite_reverse]"
          animate={{ backgroundColor: hexToRgba(palette.to, 0.12) }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[100px] animate-[drift_15s_ease-in-out_infinite]"
          animate={{ backgroundColor: hexToRgba(palette.from, 0.08) }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center px-6"
      >
        <h1 className="text-6xl mb-2">
          <Logo
            className="text-6xl"
            pastelIndex={paletteIdx}
            onClick={cyclePalette}
          />
        </h1>
        <p className="text-lg text-white/50 mb-8">your music, visualized</p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="last.fm username"
            autoFocus
            className="w-72 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-center text-lg outline-none focus:bg-white/[0.07] transition-all"
            style={{ borderColor: `${palette.from}30` }}
          />

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400/80 text-sm"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={checking || !input.trim()}
            className="px-8 py-3 rounded-xl text-white font-medium transition-all cursor-pointer disabled:opacity-40"
            animate={{
              background: checking
                ? "rgba(255,255,255,0.1)"
                : `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
            }}
            transition={{ duration: 0.6 }}
          >
            {checking ? "connecting..." : "view my stats"}
          </motion.button>
        </form>

        {/* Info button */}
        <button
          onClick={() => setShowInfo(true)}
          className="mt-5 text-xs text-white/25 hover:text-white/50 transition-colors cursor-pointer"
        >
          what's last.fm?
        </button>

        <div className="mt-2 flex items-center justify-center gap-3 text-xs text-white/15">
          <span>powered by last.fm</span>
          <span className="text-white/10">|</span>
          <span>
            built w/{" "}
            <motion.span
              className="inline-block opacity-40"
              animate={{ color: [palette.from, palette.to, palette.from] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              &lt;3
            </motion.span>{" "}
            by{" "}
            <a
              href="https://www.linkedin.com/in/ryan-polasky"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/25 transition-colors"
              style={{ color: undefined }}
              onMouseEnter={(e) => (e.currentTarget.style.color = palette.from)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              ryanpolasky
            </a>
          </span>
        </div>
      </motion.div>

      {/* Info modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowInfo(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-md w-full rounded-2xl bg-[#12121a] ring-1 ring-white/10 p-6 shadow-2xl"
            >
              <h2 className="text-lg font-bold text-white mb-3">
                How it works
              </h2>

              <div className="flex flex-col gap-3 text-sm text-white/60 leading-relaxed">
                <p>
                  <strong className="text-white/80">Last.fm</strong> is a free
                  service that tracks every song you listen to across all your
                  music apps. It's been around since 2002 and works with
                  Spotify, Apple Music, Tidal, and more.
                </p>

                <div className="rounded-xl bg-white/5 p-4 flex flex-col gap-2">
                  <p className="text-white/70 font-medium text-xs uppercase tracking-wider">
                    Quick setup
                  </p>
                  <ol className="list-decimal list-inside flex flex-col gap-1.5 text-white/50 text-[13px]">
                    <li>
                      Create a free account at{" "}
                      <a
                        href="https://www.last.fm/join"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: palette.from }}
                        className="hover:underline"
                      >
                        last.fm/join
                      </a>
                    </li>
                    <li>
                      Go to{" "}
                      <a
                        href="https://www.last.fm/settings/applications"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: palette.from }}
                        className="hover:underline"
                      >
                        Settings &rarr; Applications
                      </a>{" "}
                      and connect your music service (Spotify, Apple Music,
                      etc.)
                    </li>
                    <li>Listen to some music so it starts tracking</li>
                    <li>Come back here and enter your Last.fm username</li>
                  </ol>
                </div>

                <p className="text-white/40 text-xs">
                  This site only reads your public listening data - no
                  passwords, no login required. Your Last.fm profile is public
                  by default, so all this site needs is your username.
                </p>
              </div>

              <button
                onClick={() => setShowInfo(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/60 transition-colors cursor-pointer"
              >
                got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
