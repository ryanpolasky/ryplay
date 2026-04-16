import type { PaletteColors } from "../types/lastfm";

interface Props {
  label: string;
  colors: PaletteColors;
  className?: string;
}

export default function SectionHeader({
  label,
  colors,
  className = "mb-4",
}: Props) {
  return (
    <div className={`flex items-center gap-2 px-1 ${className}`}>
      <div
        className="h-px flex-1"
        style={{ background: `${colors.muted}40` }}
      />
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
        {label}
      </span>
      <div
        className="h-px flex-1"
        style={{ background: `${colors.muted}40` }}
      />
    </div>
  );
}
