export const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "http://localhost:3000/api/v1" : "/api/v1");
export const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
