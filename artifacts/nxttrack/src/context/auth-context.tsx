"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth/ensure-profile";
import type { TenantMembership as Membership } from "@/types/database";

export interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  memberships: [],
  loading: true,
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (authUser: User) => {
    const supabase = createClient();

    const [profileRes, membershipsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", authUser.id).single(),
      supabase.from("tenant_memberships").select("*").eq("user_id", authUser.id),
    ]);

    setProfile((profileRes.data as Profile | null) ?? null);
    setMemberships((membershipsRes.data as Membership[] | null) ?? []);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      setUser(authUser);

      if (authUser) {
        await loadUserData(authUser);
      }

      setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);

      if (authUser) {
        await loadUserData(authUser);
      } else {
        setProfile(null);
        setMemberships([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  return (
    <AuthContext.Provider value={{ user, profile, memberships, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
