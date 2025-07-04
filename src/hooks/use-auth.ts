"use client";

import { authClient } from "@/lib/auth-client";

export function useAuth() {
  const session = authClient.useSession();
  
  return {
    session: session.data,
    user: session.data?.user || null,
    isLoading: session.isPending,
  };
}

export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return { user: null, isLoading: true };
  }
  
  if (!user) {
    throw new Error("User must be authenticated to access this resource");
  }
  
  return { user, isLoading: false };
}

export { authClient };