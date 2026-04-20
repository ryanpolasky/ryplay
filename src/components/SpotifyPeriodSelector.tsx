import { motion } from "framer-motion";
import { SPOTIFY_TIME_RANGES, type SpotifyTimeRange } from "../types/spotify";

interface Props {
  value: SpotifyTimeRange;
  onChange: (range: SpotifyTimeRange) => void;
  id?: string;
}

export default function SpotifyPeriodSelector({
  value,
  onChange,
  id = "default",
}: Props) {
  return (
    <div className="flex gap-0.5 p-1 rounded-lg bg-white/5 ring-1 ring-white/10 overflow-x-auto scrollbar-hide">
      {SPOTIFY_TIME_RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className="relative px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer shrink-0"
        >
          {value === r.value && (
            <motion.div
              layoutId={`spotify-period-pill-${id}`}
              className="absolute inset-0 bg-white/10 rounded-md ring-1 ring-white/10"
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            />
          )}
          <span
            className={`relative z-10 ${value === r.value ? "text-white font-medium" : "text-white/30 hover:text-white/50"}`}
          >
            {r.label}
          </span>
        </button>
      ))}
    </div>
  );
}
