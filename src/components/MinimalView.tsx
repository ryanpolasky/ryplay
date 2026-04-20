import { motion } from "framer-motion";
import ScrollingText from "./ScrollingText";
import type { PaletteColors } from "../types/lastfm";

interface Props {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  album?: string;
  trackUrl?: string;
  colors: PaletteColors;
  loading?: boolean;
}

export default function MinimalView({
  title,
  artist,
  album,
  trackUrl,
  colors,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 md:h-16 w-64 md:w-96 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-6 md:h-8 w-40 md:w-60 rounded-md bg-white/5 animate-pulse" />
        <div className="h-4 w-28 rounded-md bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 md:gap-5 max-w-xl md:max-w-3xl w-full text-center">
      {/* Title */}
      <ScrollingText
        className="text-4xl md:text-7xl font-bold leading-tight w-full"
      >
        <span
          style={{
            color: colors.vibrant,
            textShadow: `0 0 40px ${colors.vibrant}30, 0 0 80px ${colors.vibrant}15`,
          }}
        >
          {title || "Nothing playing"}
        </span>
      </ScrollingText>

      {/* Artist */}
      {artist && (
        <ScrollingText className="text-xl md:text-3xl font-medium text-white/50 w-full">
          {artist}
        </ScrollingText>
      )}

      {/* Album */}
      {album && (
        <ScrollingText className="text-sm md:text-lg text-white/20 w-full">
          {album}
        </ScrollingText>
      )}

      {/* Open Track */}
      {trackUrl && (
        <motion.a
          href={trackUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white/80 ring-1 transition-colors hover:text-white"
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
  );
}
