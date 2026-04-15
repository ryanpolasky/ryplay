import { useState } from "react";
import { motion } from "framer-motion";
import Panel from "./Panel";
import PeriodSelector from "./PeriodSelector";
import { useGenreBreakdown } from "../hooks/useGenreBreakdown";
import type { Period, PaletteColors } from "../types/lastfm";

interface Props {
  username: string;
  colors: PaletteColors;
}

export default function GenreBreakdown({ username, colors }: Props) {
  const [period, setPeriod] = useState<Period>("3month");
  const { genres, loading } = useGenreBreakdown(username, period);
  const maxWeight = genres.length > 0 ? genres[0].weight : 1;

  return (
    <Panel id="genres">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1 mb-4">
        <div className="h-px flex-1" style={{ background: `${colors.muted}40` }} />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
          Genres
        </span>
        <div className="h-px flex-1" style={{ background: `${colors.muted}40` }} />
      </div>

      <div className="flex justify-center sm:justify-end mb-6">
        <PeriodSelector value={period} onChange={setPeriod} id="genres" />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : genres.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
          no genre data available
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full gap-3">
          {genres.map((genre, i) => {
            const pct = (genre.weight / maxWeight) * 100;
            const displayPct = Math.round(genre.weight * 100);

            return (
              <motion.div
                key={genre.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="group flex items-center gap-3"
              >
                {/* Genre name */}
                <span className="w-28 sm:w-36 text-right text-sm text-white/50 truncate capitalize shrink-0">
                  {genre.name}
                </span>

                {/* Bar track */}
                <div className="flex-1 h-7 rounded-lg bg-white/[0.04] overflow-hidden relative">
                  {/* Filled bar */}
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-lg"
                    style={{
                      background: `linear-gradient(90deg, ${genre.color}cc, ${genre.color}88)`,
                      boxShadow: `0 0 12px ${genre.color}20`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                  />

                  {/* Inner glow on hover */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      width: `${pct}%`,
                      boxShadow: `inset 0 0 12px ${genre.color}30`,
                    }}
                  />
                </div>

                {/* Percentage */}
                <span className="w-10 text-right text-xs text-white/30 tabular-nums shrink-0">
                  {displayPct}%
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
