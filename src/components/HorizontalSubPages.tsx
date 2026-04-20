import {
  useRef,
  useEffect,
  useCallback,
  Children,
  type ReactNode,
} from "react";

interface Props {
  children: ReactNode;
  activeSubPage: number;
  onSubPageChange: (index: number) => void;
}

export default function HorizontalSubPages({
  children,
  activeSubPage,
  onSubPageChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafId = useRef(0);
  const lastEmitted = useRef(0);
  const isExternalScroll = useRef(false);

  // RAF-guarded scroll handler
  const handleScroll = useCallback(() => {
    if (isExternalScroll.current) return;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      const el = scrollRef.current;
      if (!el || el.clientWidth === 0) return;
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx !== lastEmitted.current) {
        lastEmitted.current = idx;
        onSubPageChange(idx);
      }
    });
  }, [onSubPageChange]);

  // Scroll to activeSubPage when it changes externally (keyboard nav)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.children[activeSubPage] as HTMLElement | undefined;
    if (!target) return;

    const currentIdx = Math.round(el.scrollLeft / el.clientWidth);
    if (currentIdx === activeSubPage) return;

    isExternalScroll.current = true;
    target.scrollIntoView({ behavior: "smooth", inline: "start" });

    // Allow scroll handler to resume after animation settles
    const timer = setTimeout(() => {
      isExternalScroll.current = false;
      lastEmitted.current = activeSubPage;
    }, 500);
    return () => clearTimeout(timer);
  }, [activeSubPage]);

  const items = Children.toArray(children);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      style={{
        overscrollBehaviorX: "contain",
        WebkitOverflowScrolling: "touch",
        width: "100%",
      }}
    >
      {items.map((child, i) => (
        <div
          key={i}
          className="h-full snap-start snap-always flex"
          style={{ flex: "0 0 100%", minWidth: 0 }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
