import type { ReactNode } from "react";

export interface PublicCardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}

export function PublicCard({ children, className, as: Tag = "div" }: PublicCardProps) {
  return (
    <Tag
      className={`nxt-shell-card ${className ?? ""}`}
      style={{
        borderColor: "var(--shell-border)",
      }}
    >
      {children}
    </Tag>
  );
}
