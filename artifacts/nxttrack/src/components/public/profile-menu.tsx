"use client";

import Link from "next/link";
import { UserRound, Settings, LogOut, LayoutDashboard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions/auth";

export interface ProfileMenuProps {
  slug: string;
  email: string | null;
  displayName?: string | null;
  /** Sprint 16: when true, render an "Admin dashboard" shortcut. */
  isAdmin?: boolean;
  /** Sprint 16: tenant id used to set the active-tenant cookie when entering admin. */
  tenantId?: string;
}

function initialsOf(name?: string | null, email?: string | null): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function ProfileMenu({ slug, email, displayName, isAdmin, tenantId }: ProfileMenuProps) {
  async function onLogout() {
    await signOutAction(`/t/${slug}`);
  }

  const initials = initialsOf(displayName, email);
  // Admin shell woont op het apex-domein, niet onder een tenant-subdomein.
  // Daarom altijd absolute URL bouwen vanaf NEXT_PUBLIC_APP_URL.
  const apex = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const adminPath = tenantId ? `/tenant?tenant=${tenantId}` : "/tenant";
  const adminHref = `${apex}${adminPath}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Mijn profiel"
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
            {displayName || "Mijn account"}
          </span>
          {email && (
            <span className="truncate text-[11px] font-normal text-muted-foreground">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href={adminHref} className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span>Admin dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem asChild>
          <Link href={`/t/${slug}/profile`} className="flex items-center gap-2">
            <UserRound className="h-4 w-4" />
            <span>Mijn profiel</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href={`/t/${slug}/instellingen`} className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Mijn instellingen</span>
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
