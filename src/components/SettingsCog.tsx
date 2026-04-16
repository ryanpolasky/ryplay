import { motion } from "framer-motion";
import type { PaletteColors } from "../types/lastfm";

interface Props {
  onClick: () => void;
  visible: boolean;
  colors: PaletteColors;
}

export default function SettingsCog({ onClick, visible, colors }: Props) {
  return (
    <motion.button
      onClick={onClick}
      animate={{
        opacity: visible ? 0.3 : 0,
        scale: visible ? 1 : 0.9,
      }}
      whileHover={{ opacity: 0.6 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed bottom-5 right-5 z-40 w-8 h-8 flex items-center justify-center cursor-pointer"
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.vibrant}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </motion.button>
  );
}
