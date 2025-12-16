import { API_BASE } from "./config";

type GetCommentsArgs = {
  postId: string | number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  includeReplies?: boolean;
  token?: string | null;
};

async function request(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, opts);
  let data: any = null;
  try {
    const text = await res.clone().text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  } catch {
    try { data = await res.json(); } catch { data = null; }
  }
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || res.statusText || "Request failed";
    throw new Error(message);
  }
  return data;
}

export async function getComments({ postId, page=1, limit=20, sortBy="createdAt", sortOrder="desc", includeReplies=false, token }: GetCommentsArgs) {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("limit", String(limit));
  q.set("sortBy", sortBy);
  q.set("sortOrder", sortOrder);
  q.set("includeReplies", String(Boolean(includeReplies)));
  const url = `${API_BASE}/posts/${encodeURIComponent(String(postId))}/comments?${q.toString()}`;
  const headers: Record<string,string> = { "Accept": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request(url, { method: "GET", headers, credentials: "include" });
}

export async function postComment(postId: string | number, body: string, parentCommentId?: string | null, token?: string | null) {
  const url = `${API_BASE}/posts/${encodeURIComponent(String(postId))}/comments`;
  const headers: Record<string,string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request(url, { method: "POST", body: JSON.stringify({ body, parentCommentId }), headers, credentials: "include" });
}

export async function getReplies(commentId: string, page=1, limit=10, sortBy="createdAt", sortOrder="asc", token?: string | null) {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("limit", String(limit));
  q.set("sortBy", sortBy);
  q.set("sortOrder", sortOrder);
  const url = `${API_BASE}/posts/comments/${encodeURIComponent(String(commentId))}/replies?${q.toString()}`;
  const headers: Record<string,string> = { "Accept": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request(url, { method: "GET", headers, credentials: "include" });
}

export async function updateComment(commentId: string, body: string, token?: string | null) {
  const url = `${API_BASE}/posts/comments/${encodeURIComponent(String(commentId))}`;
  const headers: Record<string,string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request(url, { method: "PATCH", body: JSON.stringify({ body }), headers, credentials: "include" });
}

export async function deleteComment(commentId: string, token?: string | null) {
  const url = `${API_BASE}/posts/comments/${encodeURIComponent(String(commentId))}`;
  const headers: Record<string,string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request(url, { method: "DELETE", headers, credentials: "include" });
}

export async function toggleLikeComment(commentId: string, token?: string | null) {
  const url = `${API_BASE}/posts/comments/${encodeURIComponent(String(commentId))}/like`;
  const headers: Record<string,string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request(url, { method: "POST", headers, credentials: "include" });
}

export async function getCommentsStats(postId: string | number, token?: string | null) {
  const url = `${API_BASE}/posts/${encodeURIComponent(String(postId))}/comments/stats`;
  const headers: Record<string,string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request(url, { method: "GET", headers, credentials: "include" });
}

export default {
  getComments,
  postComment,
  getReplies,
  updateComment,
  deleteComment,
  toggleLikeComment,
  getCommentsStats,
};
