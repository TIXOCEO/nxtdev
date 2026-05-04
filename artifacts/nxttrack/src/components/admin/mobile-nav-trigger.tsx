"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface MobileNavTriggerProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

/**
 * Hamburger button + Sheet drawer for mobile admin nav.
 * Renders `children` (the sidebar) inside the drawer body.
 */
export function MobileNavTrigger({ children, label = "Menu", className }: MobileNavTriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 md:hidden",
            className,
          )}
          style={{ color: "var(--text-secondary)" }}
          aria-label={label}
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[260px] p-0"
        style={{ backgroundColor: "var(--bg-nav)" }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>
        <div className="h-full" onClick={() => setOpen(false)}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
