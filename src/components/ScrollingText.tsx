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
      if (containerRef.current && textRef.current) {
        const container = containerRef.current.offsetWidth;
        const text = textRef.current.offsetWidth;
        setIsOverflowing(text > container);
        setContentWidth(text);
      }
    };

    check();
    const timer = setTimeout(check, 600);
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [children]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap min-w-0 ${className}`}
    >
      {isOverflowing ? (
        <div className="flex">
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: -contentWidth - 32 }}
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
