import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../context/UserContext";
import Logo, { PASTEL_PALETTES, randomPaletteIndex } from "./Logo";
import LastFmInfoModal from "./LastFmInfoModal";
import { setGradientFavicon } from "../lib/favicon";

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export default function Landing() {
  const { setUsername, peekUsername } = useUser();
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showPeekHint, setShowPeekHint] = useState(
    () => !localStorage.getItem("ryplay-username"),
  );
  const [paletteIdx, setPaletteIdx] = useState(() => randomPaletteIndex());
  const peekBtnRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Measure button position + auto-dismiss for peek hint
  useEffect(() => {
    if (!showPeekHint) return;
    const measureTimer = setTimeout(() => {
      if (!peekBtnRef.current) return;
      const rect = peekBtnRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
    }, 700);
    const dismissTimer = setTimeout(() => setShowPeekHint(false), 8000);
    const dismiss = () => setShowPeekHint(false);
    const attachTimer = setTimeout(() => {
      window.addEventListener("click", dismiss, { once: true });
    }, 1200);
    const onResize = () => {
      if (!peekBtnRef.current) return;
      const rect = peekBtnRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(measureTimer);
      clearTimeout(dismissTimer);
      clearTimeout(attachTimer);
      window.removeEventListener("click", dismiss);
      window.removeEventListener("resize", onResize);
      setTooltipPos(null);
    };
  }, [showPeekHint]);

  const palette = PASTEL_PALETTES[paletteIdx];

  // Sync favicon to active palette
  useEffect(() => {
    setGradientFavicon(palette.from, palette.to);
  }, [palette]);

  const cyclePalette = () => {
    setPaletteIdx((prev) => (prev + 1) % PASTEL_PALETTES.length);
  };

  const [connectingSpotify, setConnectingSpotify] = useState(false);

  const handleSpotifyConnect = useCallback(async () => {
    setConnectingSpotify(true);
    try {
      const res = await fetch("/api/spotify/login");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setConnectingSpotify(false);
      }
    } catch {
      setConnectingSpotify(false);
    }
  }, []);

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
          className="absolute -top-[15%] -left-[10%] w-[80vw] h-[80vw] md:-top-1/2 md:-left-1/4 md:w-[600px] md:h-[600px] rounded-full blur-[120px] animate-[drift_20s_ease-in-out_infinite]"
          animate={{ backgroundColor: hexToRgba(palette.from, 0.15) }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-[15%] -right-[10%] w-[70vw] h-[70vw] md:-bottom-1/2 md:-right-1/4 md:w-[500px] md:h-[500px] rounded-full blur-[120px] animate-[drift_25s_ease-in-out_infinite_reverse]"
          animate={{ backgroundColor: hexToRgba(palette.to, 0.12) }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[20%] right-[5%] w-[50vw] h-[50vw] md:top-1/4 md:right-1/4 md:w-[300px] md:h-[300px] rounded-full blur-[100px] animate-[drift_15s_ease-in-out_infinite]"
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
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="last.fm username"
            autoFocus
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            className="w-full max-w-xs px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-center text-lg outline-none focus:bg-white/[0.07] transition-all"
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
            className="w-full max-w-xs px-8 py-3 rounded-xl text-white font-medium transition-all cursor-pointer disabled:opacity-40"
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

        {/* Spotify connect divider + button */}
        <div className="flex items-center gap-3 mt-4 mb-3 max-w-xs mx-auto w-full">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/20">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          onClick={handleSpotifyConnect}
          disabled={connectingSpotify}
          className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 ring-1 ring-white/10 text-white/50 text-sm transition-all hover:bg-white/8 hover:text-white/70 cursor-pointer disabled:opacity-40"
        >
          <svg className="w-4 h-4 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          {connectingSpotify ? "connecting..." : "connect with spotify"}
        </button>

        {/* Links row */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs">
          <button
            onClick={() => setShowInfo(true)}
            className="text-white/25 hover:text-white/50 transition-colors cursor-pointer"
          >
            what's last.fm?
          </button>
          <span className="text-white/10">|</span>
          <div className="relative">
            <button
              ref={peekBtnRef}
              onClick={() => peekUsername("ryanpolasky")}
              className="text-white/25 transition-colors cursor-pointer"
              style={{ color: undefined }}
              onMouseEnter={(e) => (e.currentTarget.style.color = palette.from)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              what's ryan listening to?
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-3 flex-wrap text-xs text-white/15">
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

      {/* Peek hint tooltip */}
      <AnimatePresence>
        {showPeekHint && tooltipPos && (
          <motion.div
            key="peek-tooltip"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[60] flex flex-col items-center pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y + 20,
              transform: "translateX(-50%)",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ y: 6 }}
              transition={{
                y: { type: "spring", stiffness: 400, damping: 28 },
                opacity: { duration: 0.12, ease: "easeOut" },
              }}
              className="flex flex-col items-center"
            >
              <svg
                width="16"
                height="10"
                viewBox="0 0 16 10"
                className="text-white/80"
              >
                <path d="M8 0L0 10h16z" fill="currentColor" />
              </svg>
              <div className="relative rounded-xl bg-white/10 backdrop-blur-xl ring-1 ring-white/[0.08] border border-white/[0.06] px-4 py-3 max-w-[250px]">
                <button
                  onClick={() => setShowPeekHint(false)}
                  className="pointer-events-auto absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-[#2a2a35] ring-1 ring-white/10 text-white/50 hover:text-white/80 hover:bg-[#3a3a45] transition-colors cursor-pointer text-xs leading-none"
                >
                  &times;
                </button>
                <p className="text-sm text-white/80 leading-snug text-center">
                  don't have an account but want to see the site in action?
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LastFmInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        accentColor={palette.from}
      />
    </div>
  );
}
