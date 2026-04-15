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
      className={`min-h-screen snap-start snap-always flex flex-col px-4 md:px-8 lg:px-16 pt-20 pb-12 relative z-10 ${className}`}
    >
      {children}
    </section>
  );
}
