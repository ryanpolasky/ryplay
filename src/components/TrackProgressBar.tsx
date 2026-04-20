import { useRef, useEffect } from "react";
import type { PaletteColors } from "../types/lastfm";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface Props {
  durationMs: number;
  colors: PaletteColors;
  trackTitle?: string;
}

export default function TrackProgressBar({ durationMs, colors, trackTitle }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`;
      }
      if (elapsedRef.current) {
        elapsedRef.current.textContent = formatTime(elapsed > durationMs ? durationMs : elapsed);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [durationMs, trackTitle]);

  return (
    <div className="flex items-center gap-2 mb-4">
      <span
        ref={elapsedRef}
        className="text-[10px] text-white/30 tabular-nums w-8 text-right shrink-0"
      >
        0:00
      </span>
      <div className="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full origin-left"
          style={{
            backgroundColor: colors.vibrant,
            boxShadow: `0 0 6px ${colors.vibrant}40`,
            transform: "scaleX(0)",
            willChange: "transform",
          }}
        />
      </div>
      <span className="text-[10px] text-white/30 tabular-nums w-8 shrink-0">
        {formatTime(durationMs)}
      </span>
    </div>
  );
}
