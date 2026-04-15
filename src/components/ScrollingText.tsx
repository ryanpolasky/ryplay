import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";

interface Props {
  children: ReactNode;
  className?: string;
}

export default function ScrollingText({ children, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const check = () => {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text) return;
      const overflow = text.scrollWidth > container.clientWidth;
      setIsOverflowing(overflow);
      if (overflow) setContentWidth(text.scrollWidth);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [children]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden whitespace-nowrap ${className}`}
    >
      {isOverflowing ? (
        <div className="flex">
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: -(contentWidth + 32) }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: contentWidth / 20,
              delay: 2,
              repeatDelay: 3,
            }}
            className="flex items-center"
          >
            <span ref={textRef} className="mr-8">
              {children}
            </span>
            <span aria-hidden>{children}</span>
          </motion.div>
        </div>
      ) : (
        <span ref={textRef}>{children}</span>
      )}
    </div>
  );
}
