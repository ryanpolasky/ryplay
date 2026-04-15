import { memo } from "react";
import { motion } from "framer-motion";

interface Props {
  animate: boolean;
}

const EqBars = memo(function EqBars({ animate }: Props) {
  return (
    <div className="flex h-4 items-end gap-1">
      {[0.4, 0.8, 0.5, 0.9].map((scale, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-current opacity-80"
          initial={{ height: 4 }}
          animate={{
            height: animate ? ["20%", `${scale * 100}%`, "20%"] : 4,
          }}
          transition={{
            duration: animate ? 0.6 + i * 0.1 : 0.5,
            repeat: animate ? Infinity : 0,
            ease: "easeInOut",
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
});

export default EqBars;
