import { useAuthContext } from "@/context/auth-context";
import type { AuthContextValue } from "@/context/auth-context";

/**
 * Access the current auth state from any client component.
 *
 * @example
 * const { user, profile, memberships, loading } = useAuth();
 */
export function useAuth(): AuthContextValue {
  return useAuthContext();
}
