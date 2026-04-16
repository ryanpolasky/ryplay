import { motion } from "framer-motion";
import ScrollingText from "./ScrollingText";
import SectionHeader from "./SectionHeader";
import Panel from "./Panel";
import type { ProcessedTrack, PaletteColors } from "../types/lastfm";

interface Props {
  tracks: ProcessedTrack[];
  colors: PaletteColors;
}

// Streak tier system matching wrlt
const STREAK_TIERS = [
  { min: 1, label: "", tier: 0 },
  { min: 2, label: "REPEAT", tier: 1 },
  { min: 3, label: "LOOPIN'", tier: 2 },
  { min: 5, label: "VIBIN'", tier: 3 },
  { min: 7, label: "JAMMIN'", tier: 4 },
  { min: 10, label: "OBSESSED", tier: 5 },
] as const;

function getStreakTier(streak: number) {
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].min) return STREAK_TIERS[i];
  }
  return STREAK_TIERS[0];
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function streakRowStyle(tier: number, accent: string) {
  if (tier === 0) return {};
  if (tier === 1)
    return { background: `${accent}08`, borderLeft: `2px solid ${accent}20` };
  if (tier === 2)
    return { background: `${accent}0c`, borderLeft: `2px solid ${accent}35` };
  if (tier === 3)
    return { background: `${accent}12`, borderLeft: `2px solid ${accent}50` };
  if (tier === 4)
    return {
      background: `linear-gradient(90deg, ${accent}18 0%, transparent 100%)`,
      borderLeft: `2px solid ${accent}70`,
    };
  return {
    background: `linear-gradient(90deg, ${accent}22 0%, ${accent}08 60%, transparent 100%)`,
    borderLeft: `2px solid ${accent}90`,
  };
}

function StreakBadge({ streak, accent }: { streak: number; accent: string }) {
  const { label, tier } = getStreakTier(streak);
  if (tier === 0) return null;
  const isFire = streak >= 5;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
      className="flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{
        background: `${accent}${isFire ? "30" : "20"}`,
        boxShadow: isFire ? `0 0 8px ${accent}30` : undefined,
      }}
    >
      {isFire && <span>🔥</span>}
      <span style={{ color: accent }} className="font-black">
        x{streak}
      </span>
      <span className="text-white/40 hidden sm:inline">{label}</span>
    </motion.div>
  );
}

export default function RecentlyPlayed({ tracks, colors }: Props) {
  const accent = colors.vibrant;

  if (tracks.length === 0) return null;

  return (
    <Panel id="recent">
      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-3">
          <SectionHeader label="Recently Played" colors={colors} />

          {/* Track list */}
          <div className="flex flex-col gap-1.5">
            {tracks.map((track, i) => {
              const streak = track.streak ?? 1;
              const { tier } = getStreakTier(streak);
              const proxyArt = track.artworkUrl
                ? `/api/artwork?url=${encodeURIComponent(track.artworkUrl)}`
                : null;

              return (
                <motion.a
                  key={`${track.title}-${track.timestamp}-${i}`}
                  href={track.trackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="group relative flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5 overflow-hidden"
                  style={streakRowStyle(tier, accent)}
                >
                  {/* Gradient shine for tier >= 3 */}
                  {tier >= 3 && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `linear-gradient(105deg, transparent 40%, ${accent}${tier >= 4 ? "18" : "0c"} 50%, transparent 60%)`,
                        backgroundSize: "200% 100%",
                      }}
                      animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
                      transition={{
                        duration: tier >= 5 ? 2 : tier >= 4 ? 2.5 : 3.5,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  )}

                  {/* Pulsing glow for tier >= 4 */}
                  {tier >= 4 && (
                    <motion.div
                      className="absolute inset-0 rounded-lg pointer-events-none"
                      animate={{
                        boxShadow: [
                          `inset 0 0 ${tier >= 5 ? "12px" : "8px"} ${accent}${tier >= 5 ? "25" : "15"}`,
                          `inset 0 0 ${tier >= 5 ? "20px" : "14px"} ${accent}${tier >= 5 ? "35" : "22"}`,
                          `inset 0 0 ${tier >= 5 ? "12px" : "8px"} ${accent}${tier >= 5 ? "25" : "15"}`,
                        ],
                      }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}

                  {/* Soundwave bars for tier >= 4 */}
                  {tier >= 4 && (
                    <div className="absolute inset-0 pointer-events-none flex items-end justify-around px-1 opacity-40">
                      {Array.from({ length: tier >= 5 ? 28 : 18 }).map(
                        (_, bi) => {
                          const seed = (bi * 7 + 3) % 11;
                          const baseH = 30 + seed * 6;
                          const peakH = tier >= 5 ? 95 : 80;
                          const midH = baseH + (peakH - baseH) * 0.5;
                          return (
                            <div
                              key={bi}
                              className="rounded-full"
                              style={{
                                width: tier >= 5 ? 2.5 : 2,
                                background: `linear-gradient(to top, ${accent}${tier >= 5 ? "40" : "25"}, ${accent}${tier >= 5 ? "18" : "0c"})`,
                                ["--sw-base" as string]: `${baseH}%`,
                                ["--sw-peak" as string]: `${peakH}%`,
                                ["--sw-mid" as string]: `${midH}%`,
                                animation: `soundwave-bar ${0.6 + seed * 0.08}s ease-in-out ${bi * (tier >= 5 ? 0.04 : 0.06)}s infinite`,
                              }}
                            />
                          );
                        },
                      )}
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10 z-10">
                    {proxyArt ? (
                      <img
                        src={proxyArt}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/20 text-xs">
                        ♪
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1 z-10">
                    <ScrollingText className="text-sm font-medium text-white/80">
                      {track.title}
                    </ScrollingText>
                    <ScrollingText className="text-xs text-white/40">
                      {track.artist}
                    </ScrollingText>
                  </div>

                  {/* Streak badge */}
                  {streak > 1 && (
                    <StreakBadge streak={streak} accent={accent} />
                  )}

                  {/* Timestamp */}
                  <span className="shrink-0 text-[11px] font-mono text-white/25 tabular-nums z-10">
                    {timeAgo(track.timestamp)}
                  </span>
                </motion.a>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}
