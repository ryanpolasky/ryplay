import EqBars from "./EqBars";
import TrackCard from "./TrackCard";
import type { MusicData, PaletteColors } from "../types/lastfm";

interface Props {
  username: string;
  music: MusicData | null;
  colors: PaletteColors;
  loading: boolean;
}

export default function NowPlaying({ username, music, colors, loading }: Props) {
  const isPlaying = music?.isPlaying ?? false;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Header: status badge */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-1">
        <span style={{ color: isPlaying ? colors.vibrant : "rgba(255,255,255,0.4)" }}>
          <EqBars animate={isPlaying} />
        </span>
        <span className={isPlaying ? "text-white/70" : "text-white/40"}>
          {isPlaying ? `${username} is listening` : `${username} last listened`}
        </span>
      </div>

      {/* Track card */}
      <TrackCard
        isPlaying={isPlaying}
        title={music?.title}
        artist={music?.artist}
        album={music?.album}
        artworkUrl={music?.artworkUrl}
        trackUrl={music?.trackUrl}
        colors={colors}
        loading={loading}
      />
    </div>
  );
}
