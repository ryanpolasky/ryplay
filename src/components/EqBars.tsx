import { memo } from "react";

interface Props {
  animate: boolean;
}

const BARS = [
  { peak: "40%", duration: "0.6s", delay: "0s" },
  { peak: "80%", duration: "0.7s", delay: "0.1s" },
  { peak: "50%", duration: "0.8s", delay: "0.2s" },
  { peak: "90%", duration: "0.9s", delay: "0.3s" },
];

const EqBars = memo(function EqBars({ animate }: Props) {
  return (
    <div
      className="flex h-4 items-end gap-1"
      role="img"
      aria-label="Equalizer bars"
    >
      {BARS.map((bar, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-current opacity-80"
          style={
            animate
              ? {
                  height: "20%",
                  animation: `eq-bar ${bar.duration} ease-in-out ${bar.delay} infinite`,
                  ["--eq-peak" as string]: bar.peak,
                }
              : { height: "4px", transition: "height 0.5s ease" }
          }
        />
      ))}
    </div>
  );
});

export default EqBars;
