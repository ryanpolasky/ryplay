import { motion } from "framer-motion";
import { PERIOD_LABELS, type Period } from "../types/lastfm";

interface Props {
  value: Period;
  onChange: (period: Period) => void;
  id?: string;
}

const PERIODS: Period[] = [
  "7day",
  "1month",
  "3month",
  "6month",
  "12month",
  "overall",
];

export default function PeriodSelector({
  value,
  onChange,
  id = "default",
}: Props) {
  return (
    <div className="flex gap-0.5 p-1 rounded-lg bg-white/5 ring-1 ring-white/10">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="relative px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer"
        >
          {value === p && (
            <motion.div
              layoutId={`period-pill-${id}`}
              className="absolute inset-0 bg-white/10 rounded-md ring-1 ring-white/10"
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            />
          )}
          <span
            className={`relative z-10 ${value === p ? "text-white font-medium" : "text-white/30 hover:text-white/50"}`}
          >
            {PERIOD_LABELS[p]}
          </span>
        </button>
      ))}
    </div>
  );
}
