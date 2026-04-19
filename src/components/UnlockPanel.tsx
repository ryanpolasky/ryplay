import { useState } from "react";
import { motion } from "framer-motion";
import Panel from "./Panel";
import SectionHeader from "./SectionHeader";
import LastFmInfoModal from "./LastFmInfoModal";
import type { PaletteColors } from "../types/lastfm";

interface Props {
  colors: PaletteColors;
}

const FEATURES = [
  "Lifetime stats overview",
  "Top albums breakdown",
  "Genre analysis",
  "Listening activity clock",
];

export default function UnlockPanel({ colors }: Props) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <Panel id="unlock">
      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full text-center">
        <SectionHeader label="Unlock More" colors={colors} className="mb-8 w-full" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 md:p-8 backdrop-blur-sm w-full"
        >
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            Want the full picture?
          </h2>
          <p className="text-sm text-white/40 mb-6">
            Connect Last.fm to unlock long-term tracking and deeper insights.
          </p>

          <div className="flex flex-col gap-2.5 mb-6 text-left">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <path
                    d="M6 10l3 3 5-6"
                    stroke={colors.vibrant}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm text-white/60">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowInfo(true)}
              className="w-full py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: `${colors.vibrant}20`,
                color: `${colors.vibrant}cc`,
                borderWidth: 1,
                borderColor: `${colors.vibrant}30`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.vibrant}35`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.vibrant}20`;
              }}
            >
              What's Last.fm?
            </button>

            <p className="text-xs text-white/20">
              Free to set up — takes about 2 minutes
            </p>
          </div>
        </motion.div>
      </div>

      <LastFmInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        accentColor={colors.vibrant}
      />
    </Panel>
  );
}
