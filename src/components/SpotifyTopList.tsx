import { useState } from "react";
import { motion } from "framer-motion";
import Panel from "./Panel";
import SpotifyPeriodSelector from "./SpotifyPeriodSelector";
import ScrollingText from "./ScrollingText";
import SectionHeader from "./SectionHeader";
import Spinner from "./Spinner";
import { useSpotifyTopItems } from "../hooks/useSpotifyTopItems";
import type { PaletteColors } from "../types/lastfm";
import type { SpotifyTimeRange } from "../types/spotify";

type ItemType = "artists" | "tracks";

interface Props {
  sessionId: string;
  type: ItemType;
  title: string;
  id: string;
  colors: PaletteColors;
}

export default function SpotifyTopList({
  sessionId,
  type,
  title,
  id,
  colors,
}: Props) {
  const [timeRange, setTimeRange] = useState<SpotifyTimeRange>("short_term");
  const { items, loading } = useSpotifyTopItems(sessionId, type, timeRange, 5);
  const maxCount = items.length > 0 ? items[0].playcount : 1;
  const vibrant = colors.vibrant;

  return (
    <Panel id={id}>
      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
        <SectionHeader label={title} colors={colors} />

        <div className="flex justify-center sm:justify-end mb-6">
          <SpotifyPeriodSelector
            value={timeRange}
            onChange={setTimeRange}
            id={id}
          />
        </div>

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
            no data for this period
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {items.map((item, i) => {
              const pct = (item.playcount / maxCount) * 100;
              const proxyUrl = item.imageUrl
                ? `/api/artwork?url=${encodeURIComponent(item.imageUrl)}`
                : null;

              return (
                <motion.a
                  key={`${item.name}-${item.subtitle}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <span className="w-4 text-[10px] font-mono text-white/20 text-right shrink-0">
                    {i + 1}
                  </span>

                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
                    {proxyUrl ? (
                      <img
                        src={proxyUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/20 text-xs">
                        ♪
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <ScrollingText className="text-sm font-medium text-white/80 min-w-0 flex-1">
                        {item.name}
                      </ScrollingText>
                      {item.subtitle && (
                        <ScrollingText className="text-xs text-white/30 hidden sm:block shrink-0 max-w-[40%]">
                          {item.subtitle}
                        </ScrollingText>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: vibrant }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: i * 0.04 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
