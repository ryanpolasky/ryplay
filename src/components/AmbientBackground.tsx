import { motion } from "framer-motion";
import type { PaletteColors } from "../types/lastfm";

interface Props {
  colors: PaletteColors;
  artworkUrl?: string | null;
}

export default function AmbientBackground({ colors, artworkUrl }: Props) {
  const proxyUrl = artworkUrl
    ? `/api/artwork?url=${encodeURIComponent(artworkUrl)}`
    : null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-[#060609]" />

      {/* Blurred album art — most authentic color source */}
      {proxyUrl && (
        <motion.img
          key={proxyUrl}
          src={proxyUrl}
          alt=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full object-cover blur-[80px] scale-125 saturate-150"
        />
      )}

      {/* Dark vignette overlay to keep text readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(6,6,9,0.4) 0%, rgba(6,6,9,0.85) 70%, rgba(6,6,9,0.95) 100%)",
        }}
      />

      {/* Dominant blob — top-left */}
      <motion.div
        className="absolute -top-[20%] -left-[15%] w-[65vw] h-[65vw] rounded-full blur-[100px]"
        animate={{
          backgroundColor: colors.dominant,
          opacity: proxyUrl ? 0.25 : 0.12,
        }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* Vibrant blob — bottom-right */}
      <motion.div
        className="absolute -bottom-[15%] -right-[10%] w-[55vw] h-[55vw] rounded-full blur-[100px]"
        animate={{
          backgroundColor: colors.vibrant,
          opacity: proxyUrl ? 0.2 : 0.08,
        }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* Muted blob — center */}
      <motion.div
        className="absolute top-[20%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[120px]"
        animate={{
          backgroundColor: colors.muted,
          opacity: proxyUrl ? 0.15 : 0.06,
        }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
    </div>
  );
}
