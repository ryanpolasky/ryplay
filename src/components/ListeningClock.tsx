import { Fragment, useMemo } from "react";
import Panel from "./Panel";
import SectionHeader from "./SectionHeader";
import Spinner from "./Spinner";
import { useSettings } from "../context/SettingsContext";
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
  d.setDate(d.getDate() - (6 - rowOffset));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  username: string;
  colors: PaletteColors;
}

export default function ListeningClock({ username, colors }: Props) {
  const { clockData, loading } = useListeningClock(username);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const currentHour = new Date().getHours();

  const { isMobile } = useSettings();

  const orderedRows = useMemo(() => {
    const rows: { dayIdx: number; name: string; date: string }[] = [];
    for (let i = 0; i < 7; i++) {
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
      <SectionHeader label="Listening Clock" colors={colors} className="mb-8" />

      {loading ? (
        <Spinner />
      ) : isMobile ? (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="inline-grid gap-[3px]"
            style={{ gridTemplateColumns: `auto repeat(7, 1fr)` }}
          >
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
                    <div
                      key={`${row.name}-${hour}`}
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
                        animation: `cell-pop 0.3s ease-out ${(hour * 7 + rowI) * 2}ms both`,
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
        <div className="flex-1 flex items-center justify-center">
          <div className="overflow-x-auto">
            <div
              className="inline-grid gap-[3px] pb-1 pr-1"
              style={{ gridTemplateColumns: `auto auto repeat(24, 1fr)` }}
            >
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
                      className={`text-[10px] pr-2 flex items-center tabular-nums ${isToday ? "text-white/40" : "text-white/25"}`}
                    >
                      {row.date}
                    </div>
                    {HOURS.map((hour) => {
                      const count = clockData[row.dayIdx][hour];
                      const intensity = count / max;
                      const isNow = isToday && hour === currentHour;
                      return (
                        <div
                          key={`${row.name}-${hour}`}
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
                            animation: `cell-pop 0.3s ease-out ${(rowI * 24 + hour) * 2}ms both`,
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
