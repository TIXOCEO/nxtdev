"use client";

import Link from "next/link";
import { Settings, LogOut, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions/auth";

export interface TenantProfileMenuProps {
  email: string | null;
  publicUrl?: string | null;
}

function initialsOf(email?: string | null): string {
  const src = (email || "?").trim();
  if (!src || src === "?") return "?";
  const parts = src.split(/[\s@.+_-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function TenantProfileMenu({ email, publicUrl }: TenantProfileMenuProps) {
  async function onLogout() {
    await signOutAction("/login");
  }

  const initials = initialsOf(email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Mijn account"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Mijn account
          </span>
          {email && (
            <span className="truncate text-[11px] font-normal text-muted-foreground">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {publicUrl && (
          <DropdownMenuItem asChild>
            <Link href={publicUrl} className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              <span>Publieke site</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild>
          <Link href="/tenant/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Instellingen</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <form action={onLogout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-black/5"
            style={{ color: "#b91c1c" }}
          >
            <LogOut className="h-4 w-4" />
            <span>Uitloggen</span>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
