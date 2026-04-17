import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { BACKGROUNDS } from "../lib/backgrounds";
import { FONTS } from "../types/settings";
import type { PaletteColors } from "../types/lastfm";

interface Props {
  open: boolean;
  onClose: () => void;
  colors: PaletteColors;
}

export default function SettingsPanel({ open, onClose, colors }: Props) {
  const { settings, setSetting, isMobile } = useSettings();
  const touchStartY = useRef(0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 touch-none"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Panel */}
          {isMobile ? (
            /* ── Mobile: bottom sheet with drag-to-dismiss ── */
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              onTouchStart={(e) => {
                touchStartY.current = e.touches[0].clientY;
              }}
              onTouchEnd={(e) => {
                const dy = e.changedTouches[0].clientY - touchStartY.current;
                if (dy > 50) onClose();
              }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl bg-black/80 backdrop-blur-xl ring-1 ring-white/10"
            >
              {/* Drag handle — tap to close */}
              <div
                className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-black/80 rounded-t-2xl"
                onClick={onClose}
              >
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="overflow-y-auto max-h-[calc(70vh-28px)] scrollbar-hide">
                <PanelContent
                  colors={colors}
                  settings={settings}
                  setSetting={setSetting}
                />
              </div>
            </motion.div>
          ) : (
            /* ── Desktop: side drawer ── */
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-0 right-0 bottom-0 w-80 overflow-y-auto bg-black/80 backdrop-blur-xl ring-1 ring-white/10 scrollbar-hide"
            >
              <PanelContent
                colors={colors}
                settings={settings}
                setSetting={setSetting}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PanelContent({
  colors,
  settings,
  setSetting,
}: {
  colors: PaletteColors;
  settings: ReturnType<typeof useSettings>["settings"];
  setSetting: ReturnType<typeof useSettings>["setSetting"];
}) {
  return (
    <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
      {/* Header */}

      {/* ── Backgrounds ── */}
      <div className="flex flex-col gap-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
          Background
        </span>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map((bg) => {
            const active = settings.backgroundId === bg.id;
            return (
              <button
                key={bg.id}
                onClick={() => setSetting("backgroundId", bg.id)}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div
                  className={`w-full aspect-square rounded-lg ring-1 transition-all ${
                    active
                      ? "ring-2 scale-[1.04]"
                      : "ring-white/10 hover:ring-white/25"
                  }`}
                  style={{
                    ...bg.previewStyle(colors),
                    boxShadow: active
                      ? `0 0 0 2px ${colors.vibrant}`
                      : undefined,
                  }}
                />
                <span
                  className={`text-[10px] leading-tight ${active ? "text-white/60" : "text-white/30"}`}
                >
                  {bg.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fonts ── */}
      <div className="flex flex-col gap-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
          Font
        </span>
        <div className="flex flex-col gap-1">
          {FONTS.map((font) => {
            const active = settings.fontId === font.id;
            return (
              <button
                key={font.id}
                onClick={() => setSetting("fontId", font.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                  active
                    ? "bg-white/[0.08] ring-1 ring-white/10"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`text-sm ${active ? "text-white/80" : "text-white/40"}`}
                  style={{ fontFamily: `"${font.family}", system-ui` }}
                >
                  {font.name}
                </span>
                {active && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: colors.vibrant }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Effects section — uncomment when ready
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
            Effects
          </span>
          <span className="text-[9px] uppercase tracking-wider text-white/15 bg-white/5 px-1.5 py-0.5 rounded">
            soon
          </span>
        </div>
      </div>
      */}
    </div>
  );
}
