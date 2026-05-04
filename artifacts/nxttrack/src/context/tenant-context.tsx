"use client";

import { createContext, useContext, ReactNode } from "react";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  logoUrl: string | null;
  primaryColor: string | null;
}

interface TenantContextValue {
  tenant: Tenant | null;
  slug: string;
  loading: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  slug: "",
  loading: false,
});

interface TenantProviderProps {
  children: ReactNode;
  slug: string;
}

/**
 * Sprint 1: mock tenant data — no real API calls yet.
 * Replace with real Supabase fetch in Sprint 2.
 */
function mockTenant(slug: string): Tenant {
  return {
    id: `mock-${slug}`,
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1) + " Workspace",
    plan: "pro",
    logoUrl: null,
    primaryColor: null,
  };
}

export function TenantProvider({ children, slug }: TenantProviderProps) {
  const tenant = mockTenant(slug);

  return (
    <TenantContext.Provider value={{ tenant, slug, loading: false }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
