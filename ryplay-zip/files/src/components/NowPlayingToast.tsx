import { motion } from "framer-motion";
import ScrollingText from "./ScrollingText";
import type { PaletteColors } from "../types/lastfm";
import { artworkProxyUrl } from "../lib/artworkLoader";

interface Props {
  title: string;
  artist: string;
  artworkUrl?: string;
  colors: PaletteColors;
  onClose: () => void;
}

export default function NowPlayingToast({
  title,
  artist,
  artworkUrl,
  colors,
  onClose,
}: Props) {
  const proxyUrl = artworkProxyUrl(artworkUrl);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      onClick={onClose}
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-50 flex items-center gap-3 rounded-xl bg-black/60 backdrop-blur-xl ring-1 ring-white/10 px-4 py-3 shadow-2xl cursor-pointer sm:max-w-xs"
    >
      {proxyUrl && (
        <img
          src={proxyUrl}
          alt=""
          className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-white/10"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">
          now playing
        </p>
        <ScrollingText className="text-sm font-medium text-white/80">
          {title}
        </ScrollingText>
        <ScrollingText className="text-xs text-white/40">
          {artist}
        </ScrollingText>
      </div>
      <div
        className="w-1 h-8 rounded-full shrink-0 ml-1"
        style={{ backgroundColor: colors.vibrant }}
      />
    </motion.div>
  );
}
