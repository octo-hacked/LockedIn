import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { API_BASE } from "@/lib/config";

// 1. Updated User type to match your API response
type User = {
  id: string;
  email: string;
  username: string;
  fullname: string;
  avatar?: string;
  coverImage?: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type AuthContextType = AuthState & {
  loading: boolean;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  // Changed `name` to `fullname` to match your API
  signUp: (params: { email: string; password: string; fullname: string; username: string }) => Promise<void>;
  signOut: () => Promise<void>;
  // The refresh function is kept for future implementation
  // refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "unicast.auth.state.v1";

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw);
    return {
      user: parsed.user ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function saveToStorage(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [state, setState] = useState<AuthState>(() => loadFromStorage());
  const [loading, setLoading] = useState(false);

  const persist = useCallback((next: AuthState) => {
    setState(next);
    saveToStorage(next);
  }, []);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      // Only call server logout if we have a token/cookie that may need clearing
      if (state.accessToken || state.refreshToken) {
        try {
          await axios.post(
            `${API_BASE}/users/logout`,
            {},
            {
              withCredentials: true,
              headers: state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : undefined,
            }
          );
        } catch (err) {
          // ignore server-side logout errors (e.g., 401) to avoid noisy errors
          console.warn("Logout request failed (ignored):", err);
        }
      }
    } finally {
      persist({ user: null, accessToken: null, refreshToken: null });
      toast({ title: "Logged out", description: "You have been signed out." });
      setLoading(false);
    }
  }, [persist, state.accessToken, state.refreshToken, toast]);

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setLoading(true);
      try {
        const res = await axios.post(`${API_BASE}/users/login`, { email, password }, { withCredentials: true } );

        if (res.data.success) {
          // 2. Destructure the response according to your API structure
          const { user, accessToken, refreshToken } = res.data.data;

          // Map API response to our User type
          const formattedUser: User = {
            id: user._id,
            email: user.email,
            username: user.username,
            fullname: user.fullname,
            avatar: user.avatar,
            coverImage: user.coverImage,
          };

          persist({ user: formattedUser, accessToken, refreshToken });
          toast({ title: "Login Successful", description: "Welcome back!" });
        }
      } catch (error: any) {
        console.error("Sign in failed:", error);
        toast({
          title: "Login Failed",
          description: error.response?.data?.message || "An unexpected error occurred.",
          variant: "destructive",
        });
        await signOut(); // Clear any partial state
      } finally {
        setLoading(false);
      }
    },
    [persist, signOut, toast]
  );

  const signUp = useCallback(
    async ({ email, password, fullname, username }: { email: string; password: string; fullname: string; username: string }) => {
      setLoading(true);
      try {
        const { generateAvatarFile } = await import("@/lib/avatar");
        const avatar = await generateAvatarFile(username || fullname);
        const form = new FormData();
        form.append("fullname", fullname);
        form.append("username", username);
        form.append("email", email);
        form.append("password", password);
        form.append("avatar", avatar);

        const res = await axios.post(`${API_BASE}/users/register`, form, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res.data.success) {
          toast({ title: "Registration Successful", description: "Please log in to continue." });
          await signIn({ email, password });
        }
      } catch (error: any) {
        console.error("Sign up failed:", error);
        toast({
          title: "Registration Failed",
          description: error.response?.data?.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [signIn, toast]
  );

  // On initial load, if we have a refresh token but no access token, try to refresh it
  const initialRefreshTriedRef = useRef(false);
  useEffect(() => {
    if (initialRefreshTriedRef.current) return;
    initialRefreshTriedRef.current = true;

    const local = loadFromStorage();
    if (local.accessToken) return; // already have access token
    if (!local.refreshToken) return; // nothing to refresh

    (async () => {
      try {
        const auth = await import("@/lib/auth");
        const newAccess = await auth.refreshAccessToken();
        if (newAccess) {
          const next = loadFromStorage();
          persist(next);
          toast({ title: "Session Restored", description: "Your session was refreshed." });
        }
      } catch (error: any) {
        console.error("Refresh on load failed:", error);
        await signOut();
        toast({ title: "Session Expired", description: "Please log in again.", variant: "destructive" });
      }
    })();
    // Intentionally run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for global sessionExpired events (dispatched when refresh fails during requests)
  useEffect(() => {
    const handler = () => {
      if (!state.accessToken && !state.refreshToken) return;
      (async () => {
        await signOut();
        toast({ title: "Session Expired", description: "Please log in again.", variant: "destructive" });
      })();
    };

    window.addEventListener("sessionExpired", handler);
    return () => window.removeEventListener("sessionExpired", handler);
  }, [state.accessToken, state.refreshToken, signOut, toast]);

  const value: AuthContextType = useMemo(
    () => ({
      ...state,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [state, loading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
