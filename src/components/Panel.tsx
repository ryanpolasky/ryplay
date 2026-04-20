import type { ReactNode } from "react";

interface PanelProps {
  id: string;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function Panel({
  id,
  children,
  className = "",
  noPadding,
}: PanelProps) {
  return (
    <section
      id={id}
      role="region"
      aria-label={id.replace(/-/g, " ")}
      className={`${noPadding ? "h-dvh overflow-hidden" : "min-h-dvh"} snap-start snap-always flex flex-col relative z-10 ${noPadding ? "" : "px-4 md:px-8 lg:px-16 pt-16 pb-16 md:pt-20 md:pb-20"} ${className}`}
    >
      {children}
    </section>
  );
}
