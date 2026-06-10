import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import ScrollingText from "./ScrollingText";
import type { PaletteColors } from "../types/lastfm";
import { artworkProxyUrl, loadArtworkImage } from "../lib/artworkLoader";

interface Props {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  trackUrl?: string;
  colors: PaletteColors;
  loading?: boolean;
  durationMs?: number;
  visible?: boolean;
}

function SkeletonCircle() {
  return (
    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] rounded-full bg-white/5 animate-pulse mx-auto" />
  );
}

const ARM_START = 45; // outer edge
const ARM_END = 20; // inner groove
const ARM_LIFTED = -40; // rested off to the side

// Hold the arm at the inner groove past a track's estimated end for this
// grace period, then assume a replay/loop and sweep it back to the start.
// Kept close to the now-playing poll interval (~10s) so a real track change
// swaps in first.
const END_HOLD_MS = 8_000;

export default function VinylView({
  isPlaying,
  title,
  artist,
  album,
  artworkUrl,
  trackUrl,
  colors,
  loading,
  durationMs,
  visible = true,
}: Props) {
  const discSize = "w-[220px] h-[220px] md:w-[280px] md:h-[280px]";
  const labelSize = "w-[88px] h-[88px] md:w-[112px] md:h-[112px]";

  // Displayed artwork — lags behind prop during flip animation
  const [displayedArt, setDisplayedArt] = useState(artworkUrl);
  const [isChanging, setIsChanging] = useState(false);
  const changingRef = useRef(false);
  const prevTitleRef = useRef<string | undefined>(undefined);
  const discFlipRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const generationRef = useRef(0);

  const displayProxy = artworkProxyUrl(displayedArt);

  // Tonearm: RAF-driven angle based on track progress
  const armRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Replay re-cue: lift/sweep/place animation state when a track loops
  const restartingRef = useRef(false);
  const restartTimersRef = useRef<number[]>([]);

  // Track change animation
  useEffect(() => {
    // First mount — just sync art, no animation
    if (prevTitleRef.current === undefined) {
      prevTitleRef.current = title;
      setDisplayedArt(artworkUrl);
      return;
    }

    // Same track — artwork might update from resolution, just sync
    if (prevTitleRef.current === title) {
      if (!isChanging) setDisplayedArt(artworkUrl);
      return;
    }

    prevTitleRef.current = title;

    // A real track change supersedes any in-flight replay re-cue
    restartTimersRef.current.forEach(clearTimeout);
    restartTimersRef.current = [];
    restartingRef.current = false;

    // Not playing — just swap instantly
    if (!isPlaying) {
      setDisplayedArt(artworkUrl);
      changingRef.current = false;
      setIsChanging(false);
      if (discFlipRef.current) {
        discFlipRef.current.style.transition = "none";
        discFlipRef.current.style.transform = "rotateY(0deg)";
      }
      startRef.current = Date.now();
      return;
    }

    // Preload new artwork before starting animation. Uses the shared
    // loader so we don't re-fetch the same URL that useArtworkPalette
    // is already loading.
    const newProxy = artworkProxyUrl(artworkUrl);

    const preload = new Promise<void>((resolve) => {
      if (!newProxy) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      loadArtworkImage(newProxy).then(done, done);
      setTimeout(done, 3000); // don't wait forever
    });

    // Clear any pending timers from a previous change
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const gen = ++generationRef.current;

    // Signal arm control immediately — before preload resolves
    changingRef.current = true;

    preload.then(() => {
      if (gen !== generationRef.current) return;

      setIsChanging(true);

      // Phase 1: Arm lifts to rest (handled by isChanging state below)

      // Phase 2: After arm lifts (~450ms), flip disc to edge-on
      timersRef.current.push(
        window.setTimeout(() => {
          if (gen !== generationRef.current) return;
          if (discFlipRef.current) {
            discFlipRef.current.style.transition = "transform 0.3s ease-in";
            discFlipRef.current.style.transform = "rotateY(90deg)";
          }
        }, 450),
      );

      // Phase 3: At edge-on (~750ms), swap artwork and flip back
      timersRef.current.push(
        window.setTimeout(() => {
          if (gen !== generationRef.current) return;
          setDisplayedArt(artworkUrl);
          if (discFlipRef.current) {
            discFlipRef.current.style.transition = "transform 0.35s ease-out";
            discFlipRef.current.style.transform = "rotateY(0deg)";
          }
        }, 750),
      );

      // Phase 4: Animation complete (~1200ms), arm drops, RAF resumes
      timersRef.current.push(
        window.setTimeout(() => {
          if (gen !== generationRef.current) return;
          changingRef.current = false;
          setIsChanging(false);
          startRef.current = Date.now();
        }, 1200),
      );
    });

    return () => {
      generationRef.current++;
      changingRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (discFlipRef.current) {
        discFlipRef.current.style.transition = "none";
        discFlipRef.current.style.transform = "rotateY(0deg)";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, artworkUrl]);

  // Replay re-cue — lift the needle off the inner groove, sweep the arm back
  // out to the outer edge, then set it down at the start. A physical re-cue
  // instead of snapping the arm straight from end to start.
  const runReplayRestart = useCallback(() => {
    const arm = armRef.current;
    if (!arm) return;

    restartTimersRef.current.forEach(clearTimeout);
    restartTimersRef.current = [];

    // Phase 1: lift off the groove and swing up to rest (~450ms)
    arm.style.transition = "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)";
    arm.style.transform = `rotate(${ARM_LIFTED}deg)`;

    // Phase 2: sweep across and lower the needle at the start (~600ms)
    restartTimersRef.current.push(
      window.setTimeout(() => {
        if (!armRef.current) return;
        armRef.current.style.transition =
          "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
        armRef.current.style.transform = `rotate(${ARM_START}deg)`;
      }, 470),
    );

    // Phase 3: needle placed — restart the clock so RAF resumes from the start
    restartTimersRef.current.push(
      window.setTimeout(() => {
        startRef.current = Date.now();
        restartingRef.current = false;
      }, 1130),
    );
  }, []);

  // Tonearm tick — only runs when playing + not changing
  const tickArm = useCallback(() => {
    if (!armRef.current) return;
    if (!isPlaying || !durationMs || isChanging || changingRef.current) return;

    // A replay re-cue is animating via CSS transitions; keep the RAF alive so
    // it can resume once the needle is back at the start, but don't fight it.
    if (restartingRef.current) {
      if (visibleRef.current) rafRef.current = requestAnimationFrame(tickArm);
      return;
    }

    const elapsed = Date.now() - startRef.current;

    // Past the end + grace period: assume a replay/loop and re-cue the arm
    // (lift, sweep to start, place) instead of leaving it at the inner groove.
    if (elapsed >= durationMs + END_HOLD_MS) {
      restartingRef.current = true;
      runReplayRestart();
      if (visibleRef.current) rafRef.current = requestAnimationFrame(tickArm);
      return;
    }

    const progress = Math.min(elapsed / durationMs, 1);
    const angle = ARM_START + (ARM_END - ARM_START) * progress;
    armRef.current.style.transition = "none";
    armRef.current.style.transform = `rotate(${angle}deg)`;
    if (visibleRef.current) {
      rafRef.current = requestAnimationFrame(tickArm);
    }
  }, [isPlaying, durationMs, isChanging, runReplayRestart]);

  // Arm control — responds to play/pause/change states
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    // Any play/pause/track-change transition supersedes an in-flight re-cue
    restartTimersRef.current.forEach(clearTimeout);
    restartTimersRef.current = [];
    restartingRef.current = false;

    if (isChanging || changingRef.current) {
      // Arm lifts to rest position
      if (armRef.current) {
        armRef.current.style.transition =
          "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
        armRef.current.style.transform = `rotate(${ARM_LIFTED}deg)`;
      }
    } else if (isPlaying && durationMs) {
      // Arm drops to start, then RAF takes over
      if (!startRef.current) startRef.current = Date.now();
      if (armRef.current) {
        armRef.current.style.transition =
          "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
        armRef.current.style.transform = `rotate(${ARM_START}deg)`;
      }
      const timer = window.setTimeout(() => {
        rafRef.current = requestAnimationFrame(tickArm);
      }, 520);
      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(rafRef.current);
      };
    } else {
      // Not playing — arm rests
      if (armRef.current) {
        armRef.current.style.transition =
          "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
        armRef.current.style.transform = `rotate(${ARM_LIFTED}deg)`;
      }
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [tickArm, isPlaying, durationMs, isChanging]);

  // Clean up any pending replay re-cue timers on unmount
  useEffect(() => {
    return () => {
      restartTimersRef.current.forEach(clearTimeout);
      restartTimersRef.current = [];
    };
  }, []);

  // Restart tonearm RAF when sub-page becomes visible
  useEffect(() => {
    if (!visible || !isPlaying || !durationMs || isChanging) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tickArm);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Detect pending track change during render so JSX sees it before effects run
  if (
    prevTitleRef.current !== undefined &&
    prevTitleRef.current !== title &&
    isPlaying
  ) {
    changingRef.current = true;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-6">
        <SkeletonCircle />
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-40 rounded-md bg-white/5 animate-pulse" />
          <div className="h-4 w-28 rounded-md bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Record + Tonearm container */}
      <div className="relative" style={{ perspective: 800 }}>
        {/* Tonearm */}
        <div
          ref={armRef}
          className="absolute -top-4 -right-4 md:-top-6 md:-right-4 z-10"
          style={{
            transformOrigin: "calc(100% - 8px) 8px",
            transform: `rotate(${ARM_LIFTED}deg)`,
            willChange: "transform",
          }}
        >
          {/* Arm base (pivot) */}
          <div className="absolute top-0 right-0 w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#333] ring-2 ring-[#222] z-10" />
          {/* Arm shaft */}
          <div
            className="absolute top-2 right-2 md:top-2.5 md:right-2.5 origin-top-right"
            style={{ transform: "rotate(35deg)" }}
          >
            <div className="w-[3px] h-[120px] md:h-[155px] bg-gradient-to-b from-[#555] via-[#444] to-[#333] rounded-full" />
            {/* Headshell */}
            <div className="relative -ml-[3px]">
              <div className="w-[9px] h-[18px] md:h-[22px] bg-gradient-to-b from-[#444] to-[#333] rounded-b-sm" />
              {/* Cartridge/needle */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[3px] h-[6px] bg-[#888] rounded-b-full" />
            </div>
          </div>
        </div>

        {/* Disc flip wrapper */}
        <div ref={discFlipRef} style={{ transformStyle: "preserve-3d" }}>
          {/* Vinyl disc */}
          <div
            className={`${discSize} rounded-full relative`}
            style={{
              animation: "spin-record 3s linear infinite",
              animationPlayState:
                isPlaying && !isChanging && !changingRef.current
                  ? "running"
                  : "paused",
              willChange: "transform",
            }}
          >
            {/* Disc base */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, #1a1a1a 0%, #111 40%, #0a0a0a 100%)",
              }}
            />

            {/* Grooves */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "repeating-radial-gradient(circle at center, transparent 0px, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px)",
              }}
            />

            {/* Outer rim highlight */}
            <div className="absolute inset-0 rounded-full ring-1 ring-white/5" />

            {/* Inner rim before label */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, transparent 19%, ${colors.vibrant}08 20%, transparent 21%)`,
              }}
            />

            {/* Center label — album art */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`${labelSize} rounded-full overflow-hidden ring-1 ring-white/10 relative`}
              >
                <div className="w-full h-full">
                  {displayProxy ? (
                    <img
                      src={displayProxy}
                      alt={`${title} album art`}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#222] text-white/20 text-2xl">
                      ♪
                    </div>
                  )}
                </div>

                {/* Spindle hole */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-black/70 ring-1 ring-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle shadow under the disc */}
        <div
          className={`absolute -bottom-3 left-1/2 -translate-x-1/2 ${discSize} rounded-full blur-xl opacity-20`}
          style={{ backgroundColor: colors.dark }}
        />
      </div>

      {/* Track metadata */}
      <div className="flex flex-col items-center gap-1 max-w-[280px] md:max-w-[320px] w-full text-center">
        <ScrollingText className="text-lg md:text-xl font-bold text-white">
          {title || "Nothing playing"}
        </ScrollingText>

        {artist && (
          <ScrollingText className="text-sm text-white/60">
            {artist}
          </ScrollingText>
        )}

        {album && (
          <ScrollingText className="text-xs text-white/30">
            {album}
          </ScrollingText>
        )}

        {trackUrl && (
          <motion.a
            href={trackUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white/80 ring-1 transition-colors hover:text-white"
            style={{
              backgroundColor: `${colors.vibrant}25`,
              ["--tw-ring-color" as string]: `${colors.vibrant}40`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.vibrant}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.vibrant}25`;
            }}
          >
            Open Track
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </motion.a>
        )}
      </div>
    </div>
  );
}
