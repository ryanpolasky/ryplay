import React from "react";
import { motion } from "framer-motion";
import type { PaletteColors } from "../types/lastfm";

export interface BackgroundDef {
  id: string;
  name: string;
  description: string;
  component: React.FC<{
    colors: PaletteColors;
    isMobile: boolean;
    artworkUrl?: string | null;
  }>;
  previewStyle: (c: PaletteColors) => React.CSSProperties;
}

const NoiseOverlay = () => (
  <div className="absolute inset-0 z-20 opacity-[0.04] mix-blend-overlay">
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <filter id="noiseFilter">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves="3"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#noiseFilter)" />
    </svg>
  </div>
);

const bgKeyframes = `
@keyframes bg-pulse      { 0%,100%{opacity:0.18} 50%{opacity:0.35} }
@keyframes bg-gradient-rotate { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
@keyframes bg-nebula-drift { 0%,100%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.3)} }
@keyframes bg-ember { 0%{transform:translateY(0) scale(1);opacity:0.6} 50%{opacity:1} 100%{transform:translateY(-120vh) scale(0.3);opacity:0} }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = bgKeyframes;
  document.head.appendChild(el);
}

export const BACKGROUNDS: BackgroundDef[] = [
  /* ── Default ── */
  {
    id: "default",
    name: "Default",
    description: "The original ambient blobs.",
    previewStyle: (c) => ({
      background: `radial-gradient(ellipse at 30% 30%, ${c.dominant}80 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, ${c.vibrant}80 0%, transparent 60%), ${c.dark}`,
    }),
    component: ({ colors, isMobile }) => (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-black" />
        <motion.div
          animate={{ backgroundColor: colors.dark }}
          transition={{ duration: 2, ease: "linear" }}
          className="absolute inset-0 opacity-60"
        />
        <motion.div
          animate={
            !isMobile
              ? {
                  backgroundColor: colors.dominant,
                  x: ["-10%", "10%", "-5%"],
                  y: ["-10%", "-5%", "5%"],
                }
              : { backgroundColor: colors.dominant }
          }
          transition={{ duration: 10, repeat: Infinity, repeatType: "mirror" }}
          className="absolute -left-[10%] -top-[20%] rounded-full will-change-transform"
          style={{
            width: isMobile ? "60vw" : "70vh",
            height: isMobile ? "60vw" : "70vh",
            filter: isMobile ? "blur(60px)" : "blur(100px)",
            opacity: isMobile ? 0.3 : 0.5,
            mixBlendMode: isMobile ? "normal" : "screen",
          }}
        />
        <motion.div
          animate={
            !isMobile
              ? {
                  backgroundColor: colors.vibrant,
                  x: ["5%", "-5%", "5%"],
                  y: ["5%", "10%", "-5%"],
                }
              : { backgroundColor: colors.vibrant }
          }
          transition={{ duration: 12, repeat: Infinity, repeatType: "mirror" }}
          className="absolute -bottom-[20%] -right-[10%] rounded-full will-change-transform"
          style={{
            width: isMobile ? "70vw" : "80vh",
            height: isMobile ? "70vw" : "80vh",
            filter: isMobile ? "blur(80px)" : "blur(120px)",
            opacity: isMobile ? 0.25 : 0.4,
            mixBlendMode: isMobile ? "normal" : "screen",
          }}
        />
        {!isMobile && (
          <motion.div
            animate={{
              backgroundColor: colors.light,
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{ duration: 5, repeat: Infinity, repeatType: "mirror" }}
            className="absolute left-1/2 top-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] mix-blend-overlay will-change-transform"
          />
        )}
        {!isMobile && <NoiseOverlay />}
      </div>
    ),
  },

  /* ── Solid ── */
  {
    id: "solid",
    name: "Solid",
    description: "Clean, flat dominant color.",
    previewStyle: (c) => ({ background: c.dominant }),
    component: ({ colors }) => (
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ backgroundColor: colors.dominant }}
          transition={{ duration: 2, ease: "linear" }}
          className="absolute inset-0"
        />
      </div>
    ),
  },

  /* ── Gradient ── */
  {
    id: "gradient",
    name: "Gradient",
    description: "Slow-rotating color wash.",
    previewStyle: (c) => ({
      background: `conic-gradient(from 135deg, ${c.dominant}, ${c.vibrant}, ${c.dark}, ${c.dominant})`,
    }),
    component: ({ colors, isMobile }) => {
      injectStyles();
      return (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-black" />
          <motion.div
            className="absolute will-change-transform rounded-full"
            animate={{
              background: `conic-gradient(from 0deg, ${colors.dominant}, ${colors.vibrant}, ${colors.dark}, ${colors.muted}, ${colors.dominant})`,
            }}
            transition={{ duration: 2 }}
            style={{
              left: "-75%",
              top: "-75%",
              width: "250%",
              height: "250%",
              filter: isMobile ? "blur(60px)" : "blur(80px)",
              opacity: 0.6,
              animation: isMobile
                ? "none"
                : "bg-gradient-rotate 30s linear infinite",
            }}
          />
          <NoiseOverlay />
        </div>
      );
    },
  },

  /* ── Dual Tone ── */
  {
    id: "split",
    name: "Dual Tone",
    description: "Two colors bleeding together.",
    previewStyle: (c) => ({
      background: `linear-gradient(to right, ${c.dominant} 0%, ${c.vibrant} 100%)`,
    }),
    component: ({ colors }) => (
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            background: `linear-gradient(to right, ${colors.dominant} 0%, ${colors.vibrant} 100%)`,
          }}
          transition={{ duration: 2 }}
          className="absolute inset-0"
        />
        <NoiseOverlay />
      </div>
    ),
  },

  /* ── Embers ── */
  {
    id: "embers",
    name: "Embers",
    description: "Tiny glowing particles rising up.",
    previewStyle: (c) => ({
      background: `radial-gradient(ellipse at 50% 90%, ${c.vibrant}40 0%, transparent 40%), radial-gradient(ellipse at 50% 95%, ${c.dominant}30 0%, transparent 30%), ${c.dark}`,
    }),
    component: ({ colors, isMobile }) => {
      injectStyles();
      const count = isMobile ? 10 : 25;
      return (
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ backgroundColor: colors.dark }}
            transition={{ duration: 2 }}
            className="absolute inset-0"
          />
          <motion.div
            className="absolute -inset-x-[20%] bottom-0 h-3/5"
            animate={{
              background: `linear-gradient(to top, ${colors.vibrant}30 0%, ${colors.dominant}15 30%, transparent 100%)`,
            }}
            transition={{ duration: 2 }}
            style={{ filter: "blur(25px)" }}
          />
          {Array.from({ length: count }, (_, i) => {
            const size = 2 + Math.random() * 5;
            return (
              <div
                key={i}
                className="absolute rounded-full will-change-transform"
                style={{
                  left: `${Math.random() * 100}%`,
                  bottom: `-${2 + Math.random() * 5}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor:
                    i % 3 === 0
                      ? colors.vibrant
                      : i % 3 === 1
                        ? colors.dominant
                        : colors.light,
                  boxShadow: `0 0 ${size * 2}px ${i % 3 === 0 ? colors.vibrant : colors.dominant}80`,
                  transition:
                    "background-color 2s linear, box-shadow 2s linear",
                  opacity: 0.7,
                  animation: `bg-ember ${6 + Math.random() * 14}s linear infinite`,
                  animationDelay: `${-Math.random() * 18}s`,
                }}
              />
            );
          })}
          <NoiseOverlay />
        </div>
      );
    },
  },

  /* ── Ryan's Background ── */
  {
    id: "reactive-bg",
    name: "Reactive",
    description: "Album art mosaic with reactive colors.",
    previewStyle: (c) => ({
      background: `radial-gradient(ellipse at 30% 40%, ${c.vibrant}40, transparent 50%), radial-gradient(ellipse at 70% 60%, ${c.dominant}35, transparent 50%), linear-gradient(135deg, ${c.dark} 0%, #050508 100%)`,
    }),
    component: ({ colors, isMobile, artworkUrl }) => {
      injectStyles();
      const v = colors.vibrant;
      const d = colors.dominant;
      const m = colors.muted;
      const l = colors.light;
      const dk = colors.dark;
      return (
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ backgroundColor: dk }}
            transition={{ duration: 4, ease: "easeInOut" }}
            className="absolute inset-0"
          />

          {/* Album art tiled layers */}
          {artworkUrl && (
            <motion.div
              className="absolute"
              style={{
                inset: isMobile ? "-100px" : "-140px",
                backgroundImage: `url(${artworkUrl})`,
                backgroundSize: isMobile ? "100px 100px" : "140px 140px",
                backgroundRepeat: "repeat",
                filter: "grayscale(0.5) contrast(1.1)",
              }}
              animate={{
                x: [0, isMobile ? -100 : -140],
                y: [0, isMobile ? -100 : -140],
                opacity: [0.055, 0.08, 0.055],
              }}
              transition={{
                x: { duration: 40, repeat: Infinity, ease: "linear" },
                y: { duration: 40, repeat: Infinity, ease: "linear" },
                opacity: { duration: 15, repeat: Infinity, ease: "easeInOut" },
              }}
            />
          )}
          {artworkUrl && (
            <motion.div
              className="absolute"
              style={{
                inset: isMobile ? "-180px" : "-240px",
                backgroundImage: `url(${artworkUrl})`,
                backgroundSize: isMobile ? "180px 180px" : "240px 240px",
                backgroundRepeat: "repeat",
                filter: "grayscale(0.3) blur(2px)",
                mixBlendMode: "screen",
              }}
              animate={{
                x: [0, isMobile ? 180 : 240],
                y: [0, isMobile ? -180 : -240],
                opacity: [0.04, 0.06, 0.04],
              }}
              transition={{
                x: { duration: 55, repeat: Infinity, ease: "linear" },
                y: { duration: 55, repeat: Infinity, ease: "linear" },
                opacity: { duration: 20, repeat: Infinity, ease: "easeInOut" },
              }}
            />
          )}

          {/* Color wash */}
          <motion.div
            className="absolute inset-0"
            style={{ filter: "blur(80px)" }}
            animate={{
              backgroundColor: [d, v, m, d],
              opacity: [0.25, 0.18, 0.22, 0.25],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Reactive orbs */}
          <motion.div
            className="absolute"
            style={{
              width: isMobile ? "70vw" : "55vh",
              height: isMobile ? "70vw" : "55vh",
              left: "15%",
              top: "20%",
              borderRadius: "50%",
              filter: isMobile ? "blur(60px)" : "blur(80px)",
            }}
            animate={{
              backgroundColor: d,
              scale: [1, 1.1],
              opacity: [0.2, 0.35],
            }}
            transition={{
              scale: { duration: 7, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              opacity: { duration: 7, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              backgroundColor: { duration: 4, ease: "easeInOut" },
            }}
          />
          <motion.div
            className="absolute"
            style={{
              width: isMobile ? "55vw" : "45vh",
              height: isMobile ? "55vw" : "45vh",
              right: "5%",
              bottom: "10%",
              borderRadius: "50%",
              filter: isMobile ? "blur(50px)" : "blur(70px)",
              mixBlendMode: "screen",
            }}
            animate={{
              backgroundColor: v,
              scale: [1.05, 0.95],
              opacity: [0.15, 0.3],
            }}
            transition={{
              scale: { duration: 9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              opacity: { duration: 9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              backgroundColor: { duration: 4, ease: "easeInOut" },
            }}
          />
          {!isMobile && (
            <motion.div
              className="absolute"
              style={{
                width: "30vh",
                height: "30vh",
                left: "50%",
                top: "50%",
                borderRadius: "50%",
                filter: "blur(60px)",
                mixBlendMode: "overlay",
              }}
              animate={{
                backgroundColor: l,
                scale: [1, 1.15],
                opacity: [0.06, 0.15],
              }}
              transition={{
                scale: { duration: 6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                opacity: { duration: 6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                backgroundColor: { duration: 4, ease: "easeInOut" },
              }}
            />
          )}

          {/* Grid overlay */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(${v}08 1px, transparent 1px), linear-gradient(90deg, ${v}08 1px, transparent 1px)`,
              backgroundSize: isMobile ? "40px 40px" : "60px 60px",
              opacity: 0.5,
            }}
          />

          {/* Vignette */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)",
            }}
          />
          <NoiseOverlay />
        </div>
      );
    },
  },

  /* ── Lava Lamp ── */
  {
    id: "lava",
    name: "Lava Lamp",
    description: "Slow, stretchy blobs. Retro warmth.",
    previewStyle: (c) => ({
      background: `
        radial-gradient(ellipse at 35% 60%, ${c.dominant}80 0%, transparent 45%),
        radial-gradient(ellipse at 65% 35%, ${c.vibrant}60 0%, transparent 40%),
        ${c.dark}`,
    }),
    component: ({ colors, isMobile }) => (
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ backgroundColor: colors.dark }}
          transition={{ duration: 2 }}
          className="absolute inset-0"
        />
        {[
          {
            color: "dominant" as const,
            x: ["15%", "55%", "35%", "15%"],
            y: ["15%", "45%", "75%", "15%"],
            w: "30vh",
            h: "50vh",
            dur: 28,
          },
          {
            color: "vibrant" as const,
            x: ["65%", "25%", "55%", "65%"],
            y: ["65%", "25%", "10%", "65%"],
            w: "25vh",
            h: "45vh",
            dur: 32,
          },
          {
            color: "light" as const,
            x: ["40%", "65%", "20%", "40%"],
            y: ["10%", "55%", "40%", "10%"],
            w: "22vh",
            h: "38vh",
            dur: 24,
          },
        ].map((blob, i) => (
          <motion.div
            key={i}
            animate={{
              left: blob.x,
              top: blob.y,
              backgroundColor: colors[blob.color],
              borderRadius: [
                "40% 60% 55% 45% / 55% 45% 60% 40%",
                "55% 45% 40% 60% / 45% 60% 40% 55%",
                "45% 55% 60% 40% / 60% 40% 55% 45%",
                "40% 60% 55% 45% / 55% 45% 60% 40%",
              ],
            }}
            transition={{
              left: { duration: blob.dur, repeat: Infinity, ease: "easeInOut" },
              top: { duration: blob.dur, repeat: Infinity, ease: "easeInOut" },
              borderRadius: {
                duration: blob.dur * 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              },
              backgroundColor: { duration: 2 },
            }}
            className="absolute will-change-transform"
            style={{
              width: isMobile ? "40vw" : blob.w,
              height: isMobile ? "55vw" : blob.h,
              filter: isMobile ? "blur(45px)" : "blur(70px)",
              opacity: 0.5,
              mixBlendMode: "screen",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
        <NoiseOverlay />
      </div>
    ),
  },

  /* ── Nebula ── */
  {
    id: "nebula",
    name: "Nebula",
    description: "Deep space. Beauty guaranteed.",
    previewStyle: (c) => ({
      background: `
        radial-gradient(ellipse at 40% 40%, ${c.vibrant}50 0%, transparent 40%),
        radial-gradient(ellipse at 65% 55%, ${c.dominant}40 0%, transparent 35%),
        #050510`,
    }),
    component: ({ colors, isMobile }) => {
      injectStyles();
      const stars = Array.from({ length: isMobile ? 30 : 60 }, (_, i) => ({
        left: `${(i * 37 + 13) % 100}%`,
        top: `${(i * 53 + 7) % 100}%`,
        size: i % 5 === 0 ? 2 : 1,
        opacity: 0.2 + (i % 4) * 0.15,
      }));
      return (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ backgroundColor: "#050510" }}
        >
          {stars.map((s, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                backgroundColor: `rgba(255,255,255,${s.opacity})`,
              }}
            />
          ))}
          <motion.div
            className="absolute will-change-transform"
            animate={{
              background: `radial-gradient(ellipse, ${colors.vibrant}40 0%, ${colors.dominant}18 35%, transparent 65%)`,
            }}
            transition={{ duration: 2 }}
            style={{
              left: "5%",
              top: "0%",
              width: isMobile ? "80vw" : "90vh",
              height: isMobile ? "80vw" : "90vh",
              borderRadius: "50%",
              filter: "blur(45px)",
              animation: isMobile
                ? "none"
                : "bg-nebula-drift 60s linear infinite",
              opacity: 0.85,
            }}
          />
          <motion.div
            className="absolute"
            animate={{
              background: `radial-gradient(ellipse, ${colors.dominant}35 0%, ${colors.muted}18 35%, transparent 65%)`,
            }}
            transition={{ duration: 2 }}
            style={{
              right: "-15%",
              bottom: "-15%",
              width: isMobile ? "60vw" : "70vh",
              height: isMobile ? "60vw" : "70vh",
              borderRadius: "50%",
              filter: "blur(55px)",
              opacity: 0.65,
            }}
          />
          <motion.div
            className="absolute will-change-transform"
            animate={{
              background: `radial-gradient(circle, ${colors.light}25 0%, transparent 55%)`,
            }}
            transition={{ duration: 2 }}
            style={{
              left: "35%",
              top: "25%",
              width: isMobile ? "40vw" : "40vh",
              height: isMobile ? "40vw" : "40vh",
              borderRadius: "50%",
              filter: "blur(25px)",
              animation: isMobile
                ? "none"
                : "bg-pulse 8s ease-in-out infinite",
            }}
          />
          <NoiseOverlay />
        </div>
      );
    },
  },
];

export function getBackground(id: string): BackgroundDef | undefined {
  return BACKGROUNDS.find((b) => b.id === id);
}
