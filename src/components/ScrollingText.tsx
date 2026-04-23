import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";

// Shared ResizeObserver — one instance for all ScrollingText components
const callbacks = new WeakMap<Element, () => void>();
let sharedObserver: ResizeObserver | null = null;

function getObserver(): ResizeObserver {
  if (!sharedObserver) {
    sharedObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cb = callbacks.get(entry.target);
        if (cb) cb();
      }
    });
  }
  return sharedObserver;
}

function observeElement(el: Element, callback: () => void) {
  callbacks.set(el, callback);
  getObserver().observe(el);
}

function unobserveElement(el: Element) {
  callbacks.delete(el);
  getObserver().unobserve(el);
}

interface Props {
  children: ReactNode;
  className?: string;
}

export default function ScrollingText({ children, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const check = () => {
      if (!containerRef.current || !measureRef.current) return;
      const containerW = containerRef.current.clientWidth;
      const textW = measureRef.current.getBoundingClientRect().width;
      setIsOverflowing(textW > containerW + 1);
      setContentWidth(textW);
    };

    const raf = requestAnimationFrame(check);
    const el = containerRef.current;
    if (el) observeElement(el, check);
    return () => {
      cancelAnimationFrame(raf);
      if (el) unobserveElement(el);
    };
  }, [children]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap min-w-0 relative ${className}`}
    >
      <span
        ref={measureRef}
        className="absolute left-0 top-0 invisible whitespace-nowrap pointer-events-none"
        aria-hidden
      >
        {children}
      </span>
      {isOverflowing ? (
        <div className="flex">
          <motion.div
            key={String(children)}
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
            <span className="mr-8">
              {children}
            </span>
            <span aria-hidden>{children}</span>
          </motion.div>
        </div>
      ) : (
        <span className="truncate">
          {children}
        </span>
      )}
    </div>
  );
}
