import type { ReactNode } from "react";

export interface PublicCardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}

export function PublicCard({ children, className, as: Tag = "div" }: PublicCardProps) {
  return (
    <Tag
      className={`rounded-[var(--radius-nxt-lg)] border ${className ?? ""}`}
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
      }}
    >
      {children}
    </Tag>
  );
}
