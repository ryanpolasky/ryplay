import EqBars from "./EqBars";
import TrackCard from "./TrackCard";
import VinylView from "./VinylView";
import MinimalView from "./MinimalView";
import HorizontalSubPages from "./HorizontalSubPages";
import Panel from "./Panel";
import type { MusicData, PaletteColors } from "../types/lastfm";

const SUB_PAGE_COUNT = 3;

interface Props {
  username: string;
  music: MusicData | null;
  colors: PaletteColors;
  loading: boolean;
  source?: string;
  activeSubPage?: number;
  onSubPageChange?: (index: number) => void;
}

export { SUB_PAGE_COUNT };

export default function NowPlaying({
  username,
  music,
  colors,
  loading,
  source,
  activeSubPage = 0,
  onSubPageChange,
}: Props) {
  const isPlaying = music?.isPlaying ?? false;

  const statusBadge = (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-1">
      <span
        style={{
          color: isPlaying ? colors.vibrant : "rgba(255,255,255,0.4)",
        }}
      >
        <EqBars animate={isPlaying} />
      </span>
      <span className={isPlaying ? "text-white/70" : "text-white/40"}>
        {isPlaying ? `${username} is listening` : `${username} last listened`}
      </span>
    </div>
  );

  return (
    <Panel id="now-playing" noPadding>
      <HorizontalSubPages
        activeSubPage={activeSubPage}
        onSubPageChange={onSubPageChange ?? (() => {})}
      >
        {/* Sub-page 0: TrackCard view */}
        <div className="w-full flex items-center justify-center px-4 md:px-8 lg:px-16 pt-16 pb-16 md:pt-20 md:pb-20">
          <div className="w-full max-w-2xl">
            <div className="flex flex-col gap-4 md:gap-5">
              {statusBadge}
              <TrackCard
                isPlaying={isPlaying}
                title={music?.title}
                artist={music?.artist}
                album={music?.album}
                artworkUrl={music?.artworkUrl}
                trackUrl={music?.trackUrl}
                colors={colors}
                loading={loading}
                source={source}
                durationMs={music?.durationMs}
              />
            </div>
          </div>
        </div>

        {/* Sub-page 1: Vinyl view */}
        <div className="w-full flex items-center justify-center px-4 md:px-8 lg:px-16 pt-16 pb-16 md:pt-20 md:pb-20">
          <div className="w-full max-w-2xl flex flex-col items-center gap-6">
            {statusBadge}
            <VinylView
              isPlaying={isPlaying}
              title={music?.title}
              artist={music?.artist}
              album={music?.album}
              artworkUrl={music?.artworkUrl}
              trackUrl={music?.trackUrl}
              colors={colors}
              loading={loading}
              durationMs={music?.durationMs}
            />
          </div>
        </div>

        {/* Sub-page 2: Minimal typography view */}
        <div className="w-full flex items-center justify-center px-4 md:px-8 lg:px-16 pt-16 pb-16 md:pt-20 md:pb-20">
          <div className="w-full max-w-3xl flex flex-col items-center gap-6">
            {statusBadge}
            <MinimalView
              isPlaying={isPlaying}
              title={music?.title}
              artist={music?.artist}
              album={music?.album}
              trackUrl={music?.trackUrl}
              colors={colors}
              loading={loading}
            />
          </div>
        </div>
      </HorizontalSubPages>
    </Panel>
  );
}
