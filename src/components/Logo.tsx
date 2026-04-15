import type { PaletteColors } from "../types/lastfm";

// Pastel gradient palettes — landing page picks one at random, click to cycle
export const PASTEL_PALETTES = [
  { from: "#c4b5fd", to: "#f0abfc", name: "violet" },     // violet → fuchsia
  { from: "#93c5fd", to: "#a5f3fc", name: "sky" },         // sky → cyan
  { from: "#fca5a5", to: "#fdba74", name: "sunset" },      // rose → amber
  { from: "#86efac", to: "#67e8f9", name: "mint" },        // emerald → cyan
  { from: "#fbbf24", to: "#f472b6", name: "golden" },      // amber → pink
  { from: "#a78bfa", to: "#60a5fa", name: "indigo" },      // purple → blue
  { from: "#f9a8d4", to: "#fde68a", name: "candy" },       // pink → yellow
] as const;

export function randomPaletteIndex(): number {
  return Math.floor(Math.random() * PASTEL_PALETTES.length);
}

interface Props {
  colors?: PaletteColors | null;
  hasArtwork?: boolean;
  /** Override with a specific pastel palette index (landing page use) */
  pastelIndex?: number;
  onClick?: () => void;
  className?: string;
}

export default function Logo({
  colors,
  hasArtwork,
  pastelIndex,
  onClick,
  className = "",
}: Props) {
  const paletteReady = hasArtwork && colors;

  const pastel = PASTEL_PALETTES[pastelIndex ?? 0];
  const gradFrom = paletteReady ? colors.vibrant : pastel.from;
  const gradTo = paletteReady ? colors.light : pastel.to;

  return (
    <span
      className={`font-bold tracking-tight ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <span
        className="inline pb-[2px]"
        style={{
          backgroundImage: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        ry
      </span>
      <span className="text-white/60">play</span>
    </span>
  );
}
