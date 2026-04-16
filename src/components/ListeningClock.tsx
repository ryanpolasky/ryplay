import { Fragment, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Panel from "./Panel";
import { useListeningClock } from "../hooks/useListeningClock";
import type { PaletteColors } from "../types/lastfm";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function getDateForRow(_todayIdx: number, rowOffset: number): string {
  const d = new Date();
  // rowOffset 0 = 7 days ago (top), rowOffset 6 = today (bottom)
  d.setDate(d.getDate() - (6 - rowOffset));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  username: string;
  colors: PaletteColors;
}

export default function ListeningClock({ username, colors }: Props) {
  const { clockData, loading } = useListeningClock(username);

  // Reorder rows so today is at the bottom (desktop) / rightmost (mobile)
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon
  const currentHour = new Date().getHours();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const orderedRows = useMemo(() => {
    const rows: { dayIdx: number; name: string; date: string }[] = [];
    for (let i = 0; i < 7; i++) {
      // Start from the day after today (oldest), end with today
      const dayIdx = (todayIdx + 1 + i) % 7;
      rows.push({
        dayIdx,
        name: DAY_NAMES[dayIdx],
        date: getDateForRow(todayIdx, i),
      });
    }
    return rows;
  }, [todayIdx]);

  const max = Math.max(1, ...clockData.flat());

  return (
    <Panel id="clock">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1 mb-8">
        <div
          className="h-px flex-1"
          style={{ background: `${colors.muted}40` }}
        />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
          Listening Clock
        </span>
        <div
          className="h-px flex-1"
          style={{ background: `${colors.muted}40` }}
        />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : isMobile ? (
        /* ── Mobile: transposed grid (hours on Y, days on X) ── */
        <div className="flex-1 flex items-center justify-center">
          <div
            className="inline-grid gap-[3px]"
            style={{ gridTemplateColumns: `auto repeat(7, 1fr)` }}
          >
            {/* Header row: empty cell + 7 day abbreviations */}
            <div />
            {orderedRows.map((row, i) => (
              <div
                key={row.name}
                className={`text-[10px] text-center pb-1 min-w-[20px] ${
                  i === 6 ? "text-white/60 font-medium" : "text-white/20"
                }`}
              >
                {row.name}
              </div>
            ))}

            {/* 24 hour rows */}
            {HOURS.map((hour) => (
              <Fragment key={hour}>
                <div className="text-[10px] text-white/20 text-right pr-1.5 flex items-center justify-end">
                  {hour % 3 === 0 ? hourLabel(hour) : ""}
                </div>
                {orderedRows.map((row, rowI) => {
                  const count = clockData[row.dayIdx][hour];
                  const intensity = count / max;
                  const isToday = rowI === 6;
                  const isNow = isToday && hour === currentHour;
                  return (
                    <motion.div
                      key={`${row.name}-${hour}`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (hour * 7 + rowI) * 0.002 }}
                      className="w-5 h-5 rounded-[3px]"
                      style={{
                        backgroundColor:
                          count === 0
                            ? "rgba(255,255,255,0.03)"
                            : `color-mix(in srgb, ${colors.vibrant} ${Math.max(20, Math.round(intensity * 100))}%, transparent)`,
                        outline: isNow
                          ? `1.5px solid ${colors.vibrant}`
                          : undefined,
                        outlineOffset: isNow ? "1px" : undefined,
                      }}
                      title={`${row.name} ${row.date} ${hourLabel(hour)}: ${count} scrobbles${isNow ? " (now)" : ""}`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      ) : (
        /* ── Desktop: original grid (days on Y, hours on X) ── */
        <div className="flex-1 flex items-center justify-center">
          <div className="overflow-x-auto">
            <div
              className="inline-grid gap-[3px] pb-1 pr-1"
              style={{ gridTemplateColumns: `auto auto repeat(24, 1fr)` }}
            >
              {/* Header row */}
              <div />
              <div />
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="text-[10px] text-white/20 text-center pb-1 min-w-[18px]"
                >
                  {h % 3 === 0 ? hourLabel(h) : ""}
                </div>
              ))}

              {/* Data rows — ordered so today is at the bottom */}
              {orderedRows.map((row, rowI) => {
                const isToday = rowI === 6;
                return (
                  <Fragment key={`${row.name}-${row.date}`}>
                    <div
                      className={`text-xs pr-1.5 flex items-center ${isToday ? "text-white/60 font-medium" : "text-white/30"}`}
                    >
                      {row.name}
                    </div>
                    <div
                      className={`text-[10px] pr-2 flex items-center tabular-nums ${isToday ? "text-white/40" : "text-white/15"}`}
                    >
                      {row.date}
                    </div>
                    {HOURS.map((hour) => {
                      const count = clockData[row.dayIdx][hour];
                      const intensity = count / max;
                      const isNow = isToday && hour === currentHour;
                      return (
                        <motion.div
                          key={`${row.name}-${hour}`}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (rowI * 24 + hour) * 0.002 }}
                          className="w-[18px] h-[18px] rounded-[3px]"
                          style={{
                            backgroundColor:
                              count === 0
                                ? "rgba(255,255,255,0.03)"
                                : `color-mix(in srgb, ${colors.vibrant} ${Math.max(20, Math.round(intensity * 100))}%, transparent)`,
                            outline: isNow
                              ? `1.5px solid ${colors.vibrant}`
                              : undefined,
                            outlineOffset: isNow ? "1px" : undefined,
                          }}
                          title={`${row.name} ${row.date} ${hourLabel(hour)}: ${count} scrobbles${isNow ? " (now)" : ""}`}
                        />
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
