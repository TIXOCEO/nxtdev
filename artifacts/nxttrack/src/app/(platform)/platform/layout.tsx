import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { PlatformShell } from "@/components/platform/platform-shell";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requirePlatformAdmin();
  return <PlatformShell email={user.email ?? null}>{children}</PlatformShell>;
}
