import type { ReactNode } from "react";

interface PanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export default function Panel({ id, children, className = "" }: PanelProps) {
  return (
    <section
      id={id}
      role="region"
      aria-label={id.replace(/-/g, " ")}
      className={`min-h-dvh snap-start snap-always flex flex-col px-4 md:px-8 lg:px-16 pt-16 pb-16 md:pt-20 md:pb-20 relative z-10 ${className}`}
    >
      {children}
    </section>
  );
}
