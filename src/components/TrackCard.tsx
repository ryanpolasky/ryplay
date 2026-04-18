import { motion, AnimatePresence } from "framer-motion";
import ScrollingText from "./ScrollingText";
import type { PaletteColors } from "../types/lastfm";

// SVG noise overlay as a data URI
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

interface Props {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  trackUrl?: string;
  colors: PaletteColors;
  loading?: boolean;
}

function SkeletonLine({ w = "w-32" }: { w?: string }) {
  return <div className={`h-4 ${w} rounded-md bg-white/5 animate-pulse`} />;
}

export default function TrackCard({
  isPlaying,
  title,
  artist,
  album,
  artworkUrl,
  trackUrl,
  colors,
  loading,
}: Props) {
  const proxyUrl = artworkUrl
    ? `/api/artwork?url=${encodeURIComponent(artworkUrl)}`
    : null;

  if (loading) {
    return (
      <div className="group/card relative isolate overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-white/5 p-[0.35rem] md:p-[0.5rem] ring-1 ring-white/10">
        <div className="relative flex flex-col gap-4 rounded-xl md:rounded-[2.2rem] bg-black/40 p-4 md:p-6 shadow-2xl backdrop-blur-md md:flex-row md:items-start md:gap-6">
          <div className="relative aspect-square w-40 sm:w-48 md:w-52 overflow-hidden rounded-xl md:rounded-2xl bg-white/5 animate-pulse mx-auto md:mx-0" />
          <div className="flex flex-col gap-3 flex-1">
            <SkeletonLine w="w-48" />
            <SkeletonLine w="w-64" />
            <SkeletonLine w="w-36" />
            <SkeletonLine w="w-24" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group/card relative isolate overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-white/5 p-[0.35rem] md:p-[0.5rem] ring-1 ring-white/10 transition-all duration-500 hover:bg-white/8 hover:ring-white/20">
      {/* Noise texture */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl md:rounded-[2.5rem] opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: NOISE_SVG }}
      />

      {/* Main card body */}
      <div className="relative flex flex-col gap-4 rounded-xl md:rounded-[2.2rem] bg-black/40 p-4 md:p-6 shadow-2xl backdrop-blur-md md:flex-row md:items-start md:gap-6">
        {/* Album art */}
        <div
          className="relative mx-auto md:mx-0 shrink-0"
          style={{ perspective: 800 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={proxyUrl || "placeholder"}
              className="relative"
              style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
              initial={{ rotateY: -90 }}
              animate={{ rotateY: 0 }}
              exit={{
                rotateY: 90,
                transition: { duration: 0.25, ease: "easeIn" },
              }}
              transition={{
                rotateY: {
                  type: "spring",
                  stiffness: 250,
                  damping: 14,
                  mass: 0.9,
                },
              }}
            >
              <motion.div
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative aspect-square w-40 sm:w-48 md:w-52 overflow-hidden rounded-xl md:rounded-2xl shadow-2xl ring-1 ring-white/10"
              >
                {proxyUrl ? (
                  <img
                    src={proxyUrl}
                    alt={`${title} album art`}
                    crossOrigin="anonymous"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/20 text-4xl">
                    ♪
                  </div>
                )}
              </motion.div>

              {/* Live / Offline badge */}
              <div
                className={`absolute -bottom-2 -right-2 md:-bottom-3 md:-right-3 z-10 flex items-center gap-1.5 md:gap-2 rounded-full border border-white/10 px-2.5 py-1 md:px-3 md:py-1.5 text-[9px] md:text-[10px] font-bold tracking-wider text-white shadow-xl backdrop-blur-xl ${isPlaying ? "bg-black/80" : "bg-neutral-900/90"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isPlaying ? "bg-green-400 animate-pulse" : "bg-white/30"}`}
                />
                {isPlaying ? "LIVE" : "OFFLINE"}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Track info */}
        <div className="flex flex-1 flex-col justify-between min-w-0 text-center md:text-left">
          {/* Metadata header */}
          <div className="flex items-center justify-center md:justify-start gap-2 border-b border-white/5 pb-2 md:pb-3 mb-3 text-[10px] text-white/30 uppercase tracking-widest">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            Last.fm | {isPlaying ? "Now Playing" : "Last Played"}
          </div>

          {/* Title */}
          <ScrollingText className="text-xl md:text-3xl font-bold text-white mb-1">
            {title || "Nothing playing"}
          </ScrollingText>

          {/* Artist */}
          {artist && (
            <ScrollingText className="text-base text-white/60 mb-0.5">
              {artist}
            </ScrollingText>
          )}

          {/* Album */}
          {album && (
            <ScrollingText className="text-sm text-white/30 mb-4">
              {album}
            </ScrollingText>
          )}

          {/* Open Track button */}
          {trackUrl && (
            <motion.a
              href={trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white/80 ring-1 transition-colors self-center md:self-start hover:text-white"
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
    </div>
  );
}
