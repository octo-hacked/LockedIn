import { Send, ArrowLeft, Phone, Video, Smile, Paperclip, Plus, MessageSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { formatDistanceToNow } from "date-fns";
import { formatDateTime, formatDateRelative } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { FeedPost } from "@/components/MainFeed";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/config";

const avatarFor = (seed: string) => `https://i.pravatar.cc/100?u=${encodeURIComponent(seed)}`;

// ── Width constants (exported so Index/Capsules can use them) ──────────────────
export const SIDEBAR_DEFAULT_WIDTH = 320;
export const SIDEBAR_MIN_WIDTH     = 56;
export const SIDEBAR_MAX_WIDTH     = 400;

/**
 * Density levels for the inbox list view, derived from current pixel width.
 *  full       >= 260 : avatar + name + lastMessage + timestamp
 *  no-time    >= 200 : avatar + name + lastMessage  (no timestamp)
 *  name-only  >= 140 : avatar + name
 *  icon-only  >=  80 : avatar only (centered)
 *  brand       <  80 : small icon centered
 */
type Density = "full" | "no-time" | "name-only" | "icon-only" | "brand";

function getDensity(w: number): Density {
  if (w >= 260) return "full";
  if (w >= 200) return "no-time";
  if (w >= 140) return "name-only";
  if (w >= 80)  return "icon-only";
  return "brand";
}

// ── Types ──────────────────────────────────────────────────────────────────────

type InboxSidebarProps = {
  postPreview?:     FeedPost | null;
  onBackFromPost?:  () => void;
  postToShare?:     FeedPost | null;
  onBackFromShare?: () => void;
  /** Current sidebar width — controlled by parent */
  width:         number;
  onWidthChange: (w: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?:   () => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

const InboxSidebar = ({
  postPreview, onBackFromPost,
  postToShare, onBackFromShare,
  width, onWidthChange,
  onResizeStart, onResizeEnd,
}: InboxSidebarProps) => {

  // ── Internal state ────────────────────────────────────────────────────────
  const [selectedChat,        setSelectedChat]        = useState<string | null>(null);
  const [newMessage,          setNewMessage]          = useState("");
  const [selectedRecipients,  setSelectedRecipients]  = useState<string[]>([]);
  const { toast }             = useToast();
  const { user, accessToken } = useAuth();

  const [commentsList,    setCommentsList]    = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment,  setPostingComment]  = useState(false);

  // Create-chat dialog
  const [isCreateOpen,      setIsCreateOpen]      = useState(false);
  const [createTab,         setCreateTab]         = useState("direct");
  const [groupName,         setGroupName]         = useState("");
  const [groupParticipants, setGroupParticipants] = useState("");
  const [searchQuery,       setSearchQuery]       = useState("");
  const [searchResults,     setSearchResults]     = useState<any[]>([]);
  const [suggestions,       setSuggestions]       = useState<any[]>([]);
  const [searchLoading,     setSearchLoading]     = useState(false);

  const {
    chats, messages, fetchChats, fetchMessages,
    sendMessage, setActiveChat, onlineUsers,
    initializeSocket, loading: chatsLoading,
    createDirectChat, createGroupChat,
  } = useChat();

  // ── Drag-to-resize ────────────────────────────────────────────────────────
  const dragRef = useRef({ active: false, startX: 0, startWidth: 0 });

  const handleDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startWidth: width };
    onResizeStart?.();

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current.active) return;
      // Moving pointer LEFT increases width (sidebar grows into feed);
      // Moving RIGHT decreases width.
      const delta = dragRef.current.startX - ev.clientX;
      const next  = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, dragRef.current.startWidth + delta));
      onWidthChange(next);
    };

    const onUp = () => {
      dragRef.current.active = false;
      onResizeEnd?.();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
  };

  // ── Auto-reset width when switching out of inbox-list mode ────────────────
  // Post/share modes need full width so their content isn't squashed.
  useEffect(() => {
    if ((postPreview || postToShare) && width < SIDEBAR_DEFAULT_WIDTH) {
      onWidthChange(SIDEBAR_DEFAULT_WIDTH);
    }
  }, [postPreview, postToShare]); // eslint-disable-line

  // Tapping a conversation while sidebar is narrow → expand so chat is readable.
  useEffect(() => {
    if (selectedChat && width < SIDEBAR_DEFAULT_WIDTH) {
      onWidthChange(SIDEBAR_DEFAULT_WIDTH);
    }
  }, [selectedChat]); // eslint-disable-line

  // ── Init socket + fetch chats ─────────────────────────────────────────────
  useEffect(() => {
    if (accessToken && user) {
      try { initializeSocket?.(accessToken); } catch {}
      fetchChats().catch(e => console.error("fetchChats failed", e));
    }
  }, [accessToken, user, fetchChats, initializeSocket]);

  // ── Load comments for postPreview ─────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!postPreview) return;
      setLoadingComments(true);
      try {
        const api = await import("@/lib/comments");
        const res = await api.getComments({ postId: postPreview.remoteId ?? postPreview.id, limit: 50, includeReplies: false, token: accessToken });
        const toArr = (v: any): any[] => {
          if (Array.isArray(v)) return v;
          if (!v) return [];
          return Array.isArray(v.comments) ? v.comments
               : Array.isArray(v.items)    ? v.items
               : Array.isArray(v.data)     ? v.data
               : Array.isArray(v.data?.comments) ? v.data.comments
               : Array.isArray(v.data?.items)     ? v.data.items
               : [];
        };
        if (!mounted) return;
        const norm = (c: any) => ({
          id:       c._id ?? c.id,
          body:     c.body ?? c.text ?? c.content ?? "",
          user: {
            username: c.commentBy?.username || c.user?.username || c.user || "unknown",
            avatar:   c.commentBy?.avatar   || c.user?.avatar   || avatarFor(c.commentBy?.username || c.user?.username || "user"),
          },
          parentId:   c.parentComment ?? c.parent ?? null,
          likes:      c.likesCount ?? c.likes ?? 0,
          liked:      Boolean(c.isLikedByUser ?? c.isLiked ?? false),
          replyCount: c.replyCount ?? c.repliesCount ?? 0,
          timeAgo:    c.timeAgo ?? (c.createdAt ? formatDateRelative(c.createdAt) : ""),
          raw: c,
        });
        setCommentsList(toArr(res).map(norm));
      } catch (err) {
        console.error("Failed to load comments:", err);
        toast({ title: "Comments", description: "Could not load comments.", variant: "destructive" });
      } finally {
        if (mounted) setLoadingComments(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [postPreview, accessToken, toast]);

  // ── Post comment ──────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (postingComment || !newMessage.trim() || !postPreview) return;
    const body = newMessage.trim();
    setPostingComment(true);
    try {
      const api = await import("@/lib/comments");
      const res = await api.postComment(postPreview.remoteId ?? postPreview.id, body, undefined, accessToken);
      const raw  = res?.comment || res?.data || res;
      const created = raw?.comment || raw?.data || raw;
      if (!created) throw new Error("Invalid response");
      const norm = (c: any) => ({
        id: c._id ?? c.id, body: c.body ?? c.text ?? c.content ?? "",
        user: { username: c.commentBy?.username || c.user?.username || c.user || "unknown", avatar: c.commentBy?.avatar || c.user?.avatar || avatarFor(c.commentBy?.username || c.user?.username || "user") },
        parentId: c.parentComment ?? c.parent ?? null, likes: c.likesCount ?? c.likes ?? 0,
        liked: Boolean(c.isLikedByUser ?? c.isLiked ?? false), replyCount: c.replyCount ?? c.repliesCount ?? 0,
        timeAgo: c.timeAgo ?? (c.createdAt ? formatDateRelative(c.createdAt) : ""), raw: c,
      });
      setCommentsList(prev => [norm(created), ...prev]);
      setNewMessage("");
    } catch (err) {
      toast({ title: "Comment Failed", description: "Could not post comment.", variant: "destructive" });
    } finally {
      setPostingComment(false);
    }
  };

  // ── Create-chat helpers ───────────────────────────────────────────────────
  const authHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const searchUsers = async (q: string) => {
    const r = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(q)}&page=1&limit=20`, { headers: authHeaders, credentials: "include" });
    const d = await r.json();
    if (d.success) return d.data.users as any[];
    throw new Error(d.message);
  };

  const getUserSuggestions = async () => {
    const r = await fetch(`${API_BASE}/users/suggestions?limit=10`, { headers: authHeaders, credentials: "include" });
    const d = await r.json();
    if (d.success) return d.data as any[];
    throw new Error(d.message);
  };

  const createChatWithUser = async (userId: string) => {
    const r = await fetch(`${API_BASE}/chats/direct/${userId}`, { method: "POST", headers: authHeaders, credentials: "include" });
    const d = await r.json();
    if (d.success) return d.data;
    throw new Error(d.message);
  };

  function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
    let t: ReturnType<typeof setTimeout> | null = null;
    return function (this: any, ...a: Parameters<T>) {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn.apply(this, a); }, ms);
    } as T;
  }

  const debouncedSearch = useRef(
    debounce(async (q: string) => {
      if (!q.trim()) { setSearchResults([]); return; }
      setSearchLoading(true);
      try { setSearchResults(await searchUsers(q.trim())); }
      catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300)
  ).current;

  useEffect(() => { debouncedSearch(searchQuery); }, [searchQuery]);
  useEffect(() => { getUserSuggestions().then(setSuggestions).catch(() => setSuggestions([])); }, []);

  const handleUserSelect = async (u: any) => {
    try {
      const chat = await createChatWithUser(u._id);
      await fetchChats();
      if (chat) {
        setActiveChat(chat); setSelectedChat(chat._id);
        setIsCreateOpen(false); setSearchQuery(""); setSearchResults([]);
      }
    } catch { toast({ title: "Error", description: "Could not start conversation.", variant: "destructive" }); }
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    const parts = groupParticipants.split(",").map(s => s.trim()).filter(Boolean);
    if (!name || parts.length === 0) return;
    try {
      const chat = await createGroupChat(name, parts);
      if (chat) { setActiveChat(chat); setSelectedChat(chat._id); setIsCreateOpen(false); setGroupName(""); setGroupParticipants(""); }
    } catch { toast({ title: "Error", description: "Could not create group.", variant: "destructive" }); }
  };

  // ── Conversations list ────────────────────────────────────────────────────
  const conversations = chats.map((c, i) => ({
    id:          c._id ?? `chat-${i}`,
    name:        c.isGroupChat ? c.name : (c.participants.find(p => p._id !== (c.admin || ""))?.username || "Unknown"),
    avatar:      c.participants[0]?.avatar || avatarFor(c.name || "chat"),
    lastMessage: c.lastMessage?.content || "",
    time:        c.updatedAt ? formatDateRelative(c.updatedAt) : "",
    unread:      false,
    online:      c.participants.some(p => onlineUsers.has(p._id)),
  }));

  // ── Chat helpers ──────────────────────────────────────────────────────────
  const currentChat     = chats.find(c => c._id === selectedChat);
  const currentMessages = selectedChat ? (messages[selectedChat] || []) : [];

  const getChatDisplayName = (chat: any) => {
    if (!chat) return "";
    if (chat.isGroupChat) return chat.name;
    const other = chat.participants?.find((p: any) => p._id !== (chat.admin || ""));
    return other?.username || other?.fullname || "Unknown User";
  };
  const getChatAvatar = (chat: any) => {
    if (!chat) return avatarFor("user");
    if (chat.isGroupChat) return avatarFor(chat.name || "group");
    const other = chat.participants?.find((p: any) => p._id !== (chat.admin || ""));
    return other?.avatar || avatarFor(other?.username || other?._id || "user");
  };
  const getChatLastSeen = (chat: any) => {
    const t = chat?.lastMessage?.createdAt || chat?.updatedAt;
    if (!t) return "";
    try { return formatDistanceToNow(new Date(t), { addSuffix: true }); } catch { return ""; }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !newMessage.trim()) return;
    try { await sendMessage(selectedChat, newMessage.trim()); setNewMessage(""); }
    catch { toast({ title: "Send failed", description: "Could not send message", variant: "destructive" }); }
  };

  // ── Create-chat Dialog (shared across modes) ──────────────────────────────
  const createChatDialog = (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>Create a direct message or a group chat.</DialogDescription>
        </DialogHeader>
        <Tabs value={createTab} onValueChange={setCreateTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="direct">Direct</TabsTrigger>
            <TabsTrigger value="group">Group</TabsTrigger>
          </TabsList>

          <TabsContent value="direct">
            <div className="grid gap-3">
              <Label htmlFor="inbox-userSearch">Search users</Label>
              <Input id="inbox-userSearch" placeholder="Type a name or @username" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchLoading && <div className="text-sm text-muted-foreground">Searching…</div>}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">{searchQuery.trim() ? "Search Results" : "Suggestions"}</h3>
                <div className="space-y-1 max-h-60 overflow-auto pr-1">
                  {(searchQuery.trim() ? searchResults : suggestions).map(u => (
                    <button key={u._id} onClick={() => handleUserSelect(u)} className="w-full flex items-center gap-3 p-2 rounded hover:bg-hover-bg text-left">
                      <img src={u.avatar} alt={u.username} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm text-foreground truncate">{u.fullname}</div>
                        <div className="text-xs text-muted-foreground">@{u.username}</div>
                      </div>
                    </button>
                  ))}
                  {searchQuery.trim() && searchResults.length === 0 && !searchLoading && <div className="text-sm text-muted-foreground py-2">No users found.</div>}
                  {!searchQuery.trim() && suggestions.length === 0 && <div className="text-sm text-muted-foreground py-2">No suggestions available.</div>}
                </div>
              </div>
              <div className="flex justify-end"><Button variant="outline" onClick={() => setIsCreateOpen(false)}>Close</Button></div>
            </div>
          </TabsContent>

          <TabsContent value="group">
            <div className="grid gap-2">
              <Label htmlFor="inbox-groupName">Group name</Label>
              <Input id="inbox-groupName" placeholder="e.g., Weekend Plans" value={groupName} onChange={e => setGroupName(e.target.value)} />
              <Label htmlFor="inbox-participants">Participants (comma-separated IDs)</Label>
              <Input id="inbox-participants" placeholder="id1, id2, id3" value={groupParticipants} onChange={e => setGroupParticipants(e.target.value)} />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateGroup} disabled={!groupName.trim() || groupParticipants.split(",").map(s => s.trim()).filter(Boolean).length === 0}>Create</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );

  // ── Drag handle (rendered in every branch) ────────────────────────────────
  const dragHandle = (
    <div
      onPointerDown={handleDragStart}
      className="absolute left-0 top-0 bottom-0 w-2 z-50 cursor-col-resize group flex items-center justify-center"
      style={{ touchAction: "none" }}
    >
      <div className="w-0.5 h-10 rounded-full bg-border/40 group-hover:bg-accent/50 group-active:bg-accent transition-colors duration-150" />
    </div>
  );

  /** Shared outer shell — all modes use w-full; parent controls actual width */
  const shell = (children: React.ReactNode) => (
    <div className="relative w-full h-screen bg-card border-l border-border flex flex-col overflow-hidden">
      {dragHandle}
      {children}
      {createChatDialog}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  //  MODE 1 — Post preview / comments
  // ─────────────────────────────────────────────────────────────────────────
  if (postPreview) {
    return shell(
      <>
        <div className="p-4 border-b border-border flex items-center gap-2 flex-shrink-0">
          <button onClick={onBackFromPost} className="p-1 hover:bg-hover-bg rounded flex-shrink-0"><ArrowLeft className="w-5 h-5 text-icon-color" /></button>
          <h2 className="text-base font-semibold text-foreground truncate">Post</h2>
        </div>

        <ScrollArea className="flex-1 inbox-scroll">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              {postPreview.uploaderId
                ? <Link to={`/profile/${encodeURIComponent(String(postPreview.uploaderId))}`}><img src={postPreview.avatar} alt={postPreview.username} className="w-8 h-8 rounded-full object-cover" /></Link>
                : <Link to="/profile"><img src={postPreview.avatar} alt={postPreview.username} className="w-8 h-8 rounded-full object-cover" /></Link>}
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {postPreview.uploaderId ? <Link to={`/profile/${encodeURIComponent(String(postPreview.uploaderId))}`}>{postPreview.username}</Link> : <Link to="/profile">{postPreview.username}</Link>}
                </div>
                <div className="text-xs text-muted-foreground">{postPreview.time}</div>
              </div>
            </div>
            <div className="w-full overflow-hidden rounded-md bg-post-bg">
              <img src={postPreview.image} alt="Post" className="w-full h-48 object-cover" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{postPreview.content}</p>
            <div className="h-px w-full bg-border" />
            <div className="space-y-3">
              {loadingComments
                ? <div className="text-sm text-muted-foreground">Loading comments…</div>
                : commentsList.length === 0
                  ? <div className="text-sm text-muted-foreground">No comments yet</div>
                  : commentsList.map((c: any, i: number) => (
                    <div key={c.id ?? `comment-${i}`} className="flex items-start gap-3">
                      {c.raw?.commentBy?._id
                        ? <Link to={`/profile/${encodeURIComponent(String(c.raw.commentBy._id))}`}><img src={c.user?.avatar || avatarFor(c.user?.username || "user")} alt="" className="w-7 h-7 rounded-full object-cover" /></Link>
                        : <img src={c.user?.avatar || avatarFor(c.user?.username || "user")} alt="" className="w-7 h-7 rounded-full object-cover" />}
                      <div>
                        <div className="text-sm text-foreground">
                          <span className="font-medium">
                            {c.user?.username
                              ? (c.raw?.commentBy?._id ? <Link to={`/profile/${encodeURIComponent(String(c.raw.commentBy._id))}`}>{c.user.username}</Link> : c.user.username)
                              : (c.user || "")}
                          </span>{" "}{c.body || c.text || c.content}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{c.timeAgo || c.createdAt}</div>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Add a comment…" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === "Enter" && handleAddComment()} className="flex-1 min-w-0 bg-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            <button onClick={handleAddComment} className="p-2 bg-primary text-primary-foreground rounded-lg active:scale-[0.98] flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MODE 2 — Share
  // ─────────────────────────────────────────────────────────────────────────
  if (postToShare) {
    const toggleRecipient = (id: string) =>
      setSelectedRecipients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handleShare = () => {
      if (selectedRecipients.length === 0) return;
      const names = conversations.filter(c => selectedRecipients.includes(c.id)).map(c => c.name);
      toast({ title: "Shared", description: `Shared with ${names.join(", ")}` });
      setSelectedRecipients([]);
      onBackFromShare?.();
    };

    return shell(
      <>
        <div className="p-4 border-b border-border flex items-center gap-2 flex-shrink-0">
          <button onClick={onBackFromShare} className="p-1 hover:bg-hover-bg rounded flex-shrink-0"><ArrowLeft className="w-5 h-5 text-icon-color" /></button>
          <h2 className="text-base font-semibold text-foreground truncate">Share</h2>
        </div>

        <ScrollArea className="flex-1 inbox-scroll">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              {postToShare.uploaderId ? <Link to={`/profile/${encodeURIComponent(String(postToShare.uploaderId))}`}><img src={postToShare.avatar} alt={postToShare.username} className="w-8 h-8 rounded-full object-cover" /></Link>
                : <Link to="/profile"><img src={postToShare.avatar} alt={postToShare.username} className="w-8 h-8 rounded-full object-cover" /></Link>}
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {postToShare.uploaderId ? <Link to={`/profile/${encodeURIComponent(String(postToShare.uploaderId))}`}>{postToShare.username}</Link> : <Link to="/profile">{postToShare.username}</Link>}
                </div>
                <div className="text-xs text-muted-foreground">{postToShare.time}</div>
              </div>
            </div>
            <div className="w-full overflow-hidden rounded-md bg-post-bg">
              <img src={postToShare.image} alt="Post" className="w-full h-36 object-cover" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{postToShare.content}</p>
            <div className="h-px w-full bg-border" />
            <div className="space-y-1">
              <div className="text-xs font-medium text-foreground mb-2">Select recipients</div>
              {conversations.map((c, i) => (
                <label key={c.id ?? `conv-${i}`} className="flex items-center gap-3 p-2 rounded hover:bg-hover-bg cursor-pointer">
                  <div className="relative flex-shrink-0">
                    <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                    {c.online && <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{c.lastMessage}</div>
                  </div>
                  <Checkbox checked={selectedRecipients.includes(c.id)} onCheckedChange={() => toggleRecipient(c.id)} />
                </label>
              ))}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border flex-shrink-0">
          <button onClick={handleShare} disabled={selectedRecipients.length === 0} className="w-full bg-primary text-primary-foreground rounded-lg py-2 px-4 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Share
          </button>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MODE 3 — Active chat
  // ─────────────────────────────────────────────────────────────────────────
  if (selectedChat) {
    return shell(
      <>
        <div className="p-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setSelectedChat(null)} className="p-1 hover:bg-hover-bg rounded flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-icon-color" />
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-shrink-0">
                <img src={getChatAvatar(currentChat)} alt="" className="w-8 h-8 rounded-full object-cover" />
                {currentChat?.participants?.some((p: any) => onlineUsers.has(p._id)) && (
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white rounded-full" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-foreground truncate">{getChatDisplayName(currentChat)}</h3>
                <p className="text-xs text-muted-foreground truncate">{getChatLastSeen(currentChat)}</p>
              </div>
            </div>
            {width >= 200 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button className="p-1 hover:bg-hover-bg rounded"><Phone className="w-4 h-4 text-icon-color" /></button>
                <button className="p-1 hover:bg-hover-bg rounded"><Video className="w-4 h-4 text-icon-color" /></button>
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 inbox-scroll">
          <div className="p-3 space-y-3">
            {currentMessages.length === 0
              ? <div className="flex items-center justify-center h-32 text-muted-foreground text-xs text-center px-2">Start the conversation!</div>
              : currentMessages.map((msg: any, i: number) => {
                  const isOwn = msg.sender?._id === undefined ? msg.sender === "me" : msg.sender._id === user?.id;
                  return (
                    <div key={msg._id ?? msg.id ?? `msg-${i}`} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg p-2.5 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        {!isOwn && currentChat?.isGroupChat && (
                          <p className="text-xs font-medium mb-1 opacity-75 truncate">
                            {msg.sender?._id ? <Link to={`/profile/${encodeURIComponent(String(msg.sender._id))}`}>{msg.sender.username}</Link> : msg.sender?.username}
                          </p>
                        )}
                        <p className="text-xs break-words">{msg.content ?? msg.text ?? ""}</p>
                        <p className={`text-[10px] mt-0.5 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : (msg.time || "")}
                        </p>
                      </div>
                    </div>
                  );
                })}
          </div>
        </ScrollArea>

        <div className="p-2.5 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {width >= 180 && <button className="p-1 hover:bg-hover-bg rounded flex-shrink-0"><Paperclip className="w-4 h-4 text-icon-color" /></button>}
            <div className="flex-1 flex items-center gap-1 bg-input rounded-lg px-2 py-1.5 min-w-0">
              <input type="text" placeholder="Type…" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === "Enter" && handleSendMessage()} className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
              {width >= 160 && <button className="p-0.5 hover:bg-hover-bg rounded flex-shrink-0"><Smile className="w-3 h-3 text-icon-color" /></button>}
            </div>
            <button onClick={handleSendMessage} className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex-shrink-0">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MODE 4 — Inbox list  (the only mode that reacts to width changes)
  // ─────────────────────────────────────────────────────────────────────────
  const density = getDensity(width);

  return (
    <div className="relative w-full h-screen bg-card border-l border-border flex flex-col overflow-hidden">
      {dragHandle}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-border flex-shrink-0">
        {density === "brand" ? (
          <div className="flex items-center justify-center p-3">
            <button
              onClick={() => { onWidthChange(SIDEBAR_DEFAULT_WIDTH); setIsCreateOpen(true); }}
              className="p-1 hover:bg-hover-bg rounded transition-colors"
              aria-label="Expand and compose"
            >
              <MessageSquare className="w-5 h-5 text-icon-color" />
            </button>
          </div>
        ) : density === "icon-only" ? (
          <div className="flex flex-col items-center gap-2 p-3">
            <Send className="w-4 h-4 text-icon-color" />
            <button
              onClick={() => setIsCreateOpen(true)}
              className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              aria-label="New message"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Send className="w-4 h-4 text-icon-color flex-shrink-0" />
              {(density === "full" || density === "no-time") && (
                <h2 className="text-base font-semibold text-foreground truncate">Inbox</h2>
              )}
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1 bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 hover:bg-primary/90 transition-colors flex-shrink-0"
              aria-label="New message"
            >
              <Plus className="w-3.5 h-3.5" />
              {(density === "full" || density === "no-time") && <span className="text-xs font-medium">New</span>}
            </button>
          </div>
        )}
      </div>

      {/* ── Conversation list ────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 inbox-scroll">
        {chatsLoading ? (
          <div className="flex items-center justify-center p-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
            {density === "brand" || density === "icon-only"
              ? <MessageSquare className="w-5 h-5 opacity-30" />
              : <p className="text-xs text-center">No conversations yet</p>}
          </div>
        ) : (
          conversations.map((conv, idx) => {
            const openChat = () => {
              setSelectedChat(conv.id);
              const chatObj = chats.find(ch => ch._id === conv.id);
              if (chatObj) { setActiveChat(chatObj); fetchMessages(conv.id as string).catch(console.error); }
            };

            if (density === "brand") return (
              <div key={conv.id} onClick={openChat} className="flex justify-center py-1.5 border-b border-border hover:bg-hover-bg cursor-pointer transition-colors">
                <div className="relative">
                  <img src={conv.avatar} alt="" className="w-6 h-6 rounded-full object-cover opacity-60" />
                  {conv.online && <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-green-500 border border-card rounded-full" />}
                </div>
              </div>
            );

            if (density === "icon-only") return (
              <div key={conv.id} onClick={openChat} className="flex justify-center py-2.5 border-b border-border hover:bg-hover-bg cursor-pointer transition-colors">
                <div className="relative">
                  <img src={conv.avatar} alt={conv.name} className="w-9 h-9 rounded-full object-cover" />
                  {conv.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />}
                  {conv.unread && <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-accent rounded-full" />}
                </div>
              </div>
            );

            if (density === "name-only") return (
              <div key={conv.id} onClick={openChat} className="flex items-center gap-2 px-3 py-2.5 border-b border-border hover:bg-hover-bg cursor-pointer transition-colors">
                <div className="relative flex-shrink-0">
                  <img src={conv.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                  {conv.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />}
                </div>
                <span className={`text-xs truncate ${conv.unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>{conv.name}</span>
              </div>
            );

            if (density === "no-time") return (
              <div key={conv.id} onClick={openChat} className="flex items-start gap-2.5 px-3 py-3 border-b border-border hover:bg-hover-bg cursor-pointer transition-colors">
                <div className="relative flex-shrink-0">
                  <img src={conv.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  {conv.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />}
                  {conv.unread && <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-accent rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-xs truncate mb-0.5 ${conv.unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>{conv.name}</h3>
                  <p className={`text-xs truncate ${conv.unread ? "text-foreground" : "text-muted-foreground"}`}>{conv.lastMessage}</p>
                </div>
              </div>
            );

            // density === "full"
            return (
              <div key={conv.id} onClick={openChat} className="flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-hover-bg cursor-pointer transition-colors">
                <div className="relative flex-shrink-0">
                  <img src={conv.avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
                  {conv.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />}
                  {conv.unread && <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-accent rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3 className={`text-sm truncate ${conv.unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>{conv.name}</h3>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{conv.time}</span>
                  </div>
                  <p className={`text-xs truncate ${conv.unread ? "text-foreground" : "text-muted-foreground"}`}>{conv.lastMessage}</p>
                </div>
              </div>
            );
          })
        )}
      </ScrollArea>

      {/* Bottom "New Message" button — only at wider sizes */}
      {(density === "full" || density === "no-time") && (
        <div className="p-3 border-t border-border flex-shrink-0">
          <button onClick={() => setIsCreateOpen(true)} className="w-full bg-primary text-primary-foreground rounded-lg py-2 px-3 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            New Message
          </button>
        </div>
      )}

      {createChatDialog}
    </div>
  );
};

export default InboxSidebar;