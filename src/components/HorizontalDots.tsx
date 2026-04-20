import { useState } from "react";
import { motion } from "framer-motion";
import type { PaletteColors } from "../types/lastfm";

interface Props {
  count: number;
  activeIndex: number;
  colors: PaletteColors;
  onNavigate: (index: number) => void;
  visible?: boolean;
  labels?: string[];
}

export default function HorizontalDots({
  count,
  activeIndex,
  colors,
  onNavigate,
  visible = true,
  labels,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const show = visible || hovered;

  return (
    <div className="fixed top-14 left-0 right-0 z-20 flex justify-center pointer-events-none">
      <motion.nav
        aria-label="Sub-page navigation"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        initial={{ opacity: 0 }}
        animate={{ opacity: show ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="relative flex items-center"
        style={{
          padding: "8px",
          pointerEvents: show ? "auto" : "none",
        }}
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
            border: hovered
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid transparent",
          }}
        />

        {/* Items */}
        <div className="relative flex items-center gap-0.5 py-1.5 px-1.5">
          {Array.from({ length: count }, (_, i) => {
            const isActive = activeIndex === i;
            const label = labels?.[i];
            return (
              <motion.button
                key={i}
                onClick={() => onNavigate(i)}
                aria-label={
                  label ? `Go to ${label}` : `Go to sub-page ${i + 1}`
                }
                className="relative flex items-center rounded-lg cursor-pointer overflow-hidden focus-visible:ring-2 focus-visible:ring-white/30 outline-none"
                style={{ padding: "6px 8px" }}
                animate={{
                  backgroundColor:
                    hovered && isActive
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
                    backgroundColor: isActive
                      ? colors.vibrant
                      : "rgba(255,255,255,0.18)",
                    boxShadow: isActive
                      ? `0 0 8px ${colors.vibrant}60`
                      : "0 0 0px transparent",
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                />

                {/* Label — always mounted, animated via width/opacity */}
                {label && (
                  <motion.span
                    animate={{
                      opacity: hovered ? 1 : 0,
                      width: hovered ? "auto" : 0,
                      marginLeft: hovered ? 10 : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 28,
                      delay: hovered ? i * 0.02 : 0,
                    }}
                    className={`text-[11px] whitespace-nowrap overflow-hidden ${
                      isActive ? "text-white font-medium" : "text-white/50"
                    }`}
                  >
                    {label}
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.nav>
    </div>
  );
}
