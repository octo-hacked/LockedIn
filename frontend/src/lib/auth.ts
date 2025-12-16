import { API_BASE } from "./config";

const STORAGE_KEY = "unicast.auth.state.v1";

type AuthState = {
  user: any | null;
  accessToken: string | null;
  refreshToken: string | null;
};

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
  } catch (e) {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function saveToStorage(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function refreshAccessToken(): Promise<string | null> {
  const state = loadFromStorage();
  const refreshToken = state.refreshToken;
  if (!refreshToken) throw new Error("No refresh token available");

  const res = await fetch(`${API_BASE}/users/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
    credentials: "include",
  });

  let data: any = null;
  try {
    data = await res.clone().json();
  } catch {
    try { const t = await res.text(); data = t ? JSON.parse(t) : null; } catch { data = null; }
  }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || res.statusText || "Failed to refresh token";
    throw new Error(msg);
  }

  // Expecting { success: true, data: { accessToken, refreshToken, user } }
  const payload = data?.data || data;
  const newAccess = payload?.accessToken ?? payload?.token ?? null;
  const newRefresh = payload?.refreshToken ?? state.refreshToken ?? null;
  const user = payload?.user ?? state.user ?? null;

  const next: AuthState = { user, accessToken: newAccess, refreshToken: newRefresh };
  saveToStorage(next);
  return newAccess;
}

export function clearAuthStorage() {
  saveToStorage({ user: null, accessToken: null, refreshToken: null });
}
