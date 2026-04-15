import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PaletteColors } from "../types/lastfm";

interface Props {
  panels: { id: string; label: string }[];
  activePage: number;
  colors: PaletteColors;
  onNavigate: (index: number) => void;
  visible?: boolean;
}

export default function NavDots({ panels, activePage, colors, onNavigate, visible = true }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ opacity: visible || hovered ? 1 : 0, x: visible || hovered ? 0 : -8 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed left-3 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col"
      style={{ padding: "8px", pointerEvents: visible || hovered ? "auto" : "none" }}
    >
      {/* Glass backdrop — fades in on hover */}
      <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          initial={false}
          animate={{
            backgroundColor: hovered ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)",
            backdropFilter: hovered ? "blur(16px)" : "blur(0px)",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            WebkitBackdropFilter: hovered ? "blur(16px)" : "blur(0px)",
            border: hovered ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
          }}
      />

      {/* Items */}
      <div className="relative flex flex-col gap-0.5 py-1.5 px-1.5">
        {panels.map((p, i) => {
          const isActive = activePage === i;

          return (
            <motion.button
              key={p.id}
              onClick={() => onNavigate(i)}
              className="relative flex items-center gap-0 rounded-lg cursor-pointer overflow-hidden"
              animate={{
                paddingTop: hovered ? 6 : 3,
                paddingBottom: hovered ? 6 : 3,
                paddingLeft: hovered ? 8 : 4,
                paddingRight: hovered ? 12 : 4,
                backgroundColor: hovered && isActive
                  ? `${colors.vibrant}18`
                  : "rgba(0,0,0,0)",
              }}
              whileHover={{
                backgroundColor: `${colors.vibrant}12`,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {/* Dot */}
              <motion.div
                className="rounded-full shrink-0"
                animate={{
                  width: isActive ? 7 : 5,
                  height: isActive ? 7 : 5,
                  backgroundColor: isActive ? colors.vibrant : "rgba(255,255,255,0.18)",
                  boxShadow: isActive
                    ? `0 0 8px ${colors.vibrant}60`
                    : "0 0 0px transparent",
                }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              />

              {/* Label — slides in from left */}
              <AnimatePresence>
                {hovered && (
                  <motion.span
                    initial={{ opacity: 0, width: 0, x: -4, marginLeft: 0 }}
                    animate={{
                      opacity: 1,
                      width: "auto",
                      x: 0,
                      marginLeft: 10,
                    }}
                    exit={{ opacity: 0, width: 0, x: -4, marginLeft: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 28,
                      // Stagger: each item enters slightly later
                      delay: i * 0.02,
                    }}
                    className={`text-[11px] whitespace-nowrap overflow-hidden ${
                      isActive ? "text-white font-medium" : "text-white/50"
                    }`}
                  >
                    {p.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
