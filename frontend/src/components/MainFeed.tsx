import { Heart, MessageCircle, Share2, BadgeCheck, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { formatDateRelative } from "@/lib/utils";
import { API_BASE } from "@/lib/config";

export type Category = "memes" | "news" | "other";

export type FeedPost = {
  id: number;
  remoteId?: string;    // backend _id
  uploaderId?: string;  // uploadedBy._id
  username: string;
  content: string;
  likes: number;
  comments: number;
  time: string;
  image: string;
  avatar: string;
  category: Category;
  lowDopamine: boolean;
  isVerified: boolean;
  liked?: boolean;
};

// ── Fallback helpers (used only when a field is missing) ──────────────────────
const avatarFor    = (seed: string)          => `https://i.pravatar.cc/100?u=${encodeURIComponent(seed)}`;
const postImageFor = (seed: string | number) => `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/600/400`;

// ── Props ─────────────────────────────────────────────────────────────────────
type MainFeedProps = {
  onOpenComments?: (post: FeedPost, fromRect: DOMRect) => void;
  onOpenShare?:    (post: FeedPost, fromRect: DOMRect) => void;
  selectedCategories?: Category[];
  lowDopamineOnly?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────
const MainFeed = ({ onOpenComments, onOpenShare, selectedCategories, lowDopamineOnly }: MainFeedProps) => {
  const { accessToken } = useAuth();

  // ── Feed state ─────────────────────────────────────────────────────────────
  const [posts,      setPosts]      = useState<FeedPost[]>([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Sentinel div ref for infinite-scroll IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Map a raw API document → FeedPost ─────────────────────────────────────
  const mapPost = useCallback((p: any, localIdx: number): FeedPost => {
    const username  = p.uploadedBy?.username || p.author?.username || p.username || "unknown";
    const rawCat    = String(p.category || "other").toLowerCase();
    const validCats: Category[] = ["memes", "news", "other"];
    const category  = (validCats.includes(rawCat as Category) ? rawCat : "other") as Category;
    const mediaUrl  = typeof p.media === "string"
                        ? p.media
                        : Array.isArray(p.media) ? p.media[0]?.url : undefined;

    return {
      id:          localIdx,
      remoteId:    p._id ?? (typeof p.id === "string" ? p.id : undefined),
      uploaderId:  p.uploadedBy?._id ?? p.author?._id,
      username,
      content:     p.description || p.title || p.content || "",
      likes:       p.likes        ?? 0,
      comments:    p.comments     ?? p.commentsCount ?? 0,
      time:        p.timeAgo      ?? (p.createdAt ? formatDateRelative(p.createdAt) : ""),
      image:       mediaUrl       || postImageFor(p._id || localIdx),
      avatar:      p.uploadedBy?.avatar || avatarFor(username),
      category,
      lowDopamine: Boolean(p.isLowDopamine),
      isVerified:  Boolean(p.uploadedBy?.isVerified || p.author?.isVerified),
      liked:       Boolean(p.isLikedByUser ?? p.isLiked ?? p.liked),
    };
  }, []);

  // ── Fetch one page of posts ─────────────────────────────────────────────────
  const fetchPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page:    String(pageNum),
        limit:   "10",
        sortBy:  "createdAt",
        // contentType: "image" is enforced server-side by the controller
        ...(lowDopamineOnly ? { lowDopamineOnly: "true" } : {}),
        // Only send category when exactly one is selected
        ...(selectedCategories?.length === 1 ? { category: selectedCategories[0] } : {}),
      });

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const res  = await fetch(`${API_BASE}/posts/feed?${params}`, { headers, credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Support both response shapes: { posts, pagination } or { data: { posts, pagination } }
      const payload    = data?.data ?? data;
      const rawItems: any[]  = payload?.posts ?? payload?.items ?? [];
      const pagination = payload?.pagination ?? {};
      const hasNext    = pagination?.hasNextPage ?? (rawItems.length === 10);

      // Hard filter: drop anything the backend mis-tagged as video
      const VIDEO_EXTS = /\.(mp4|mkv|mov|avi|webm|flv|wmv|m4v)(\?|$)/i;
      const imagePosts = rawItems.filter(p => {
        if (p.contentType && p.contentType !== "image") return false;
        const url = typeof p.media === "string" ? p.media : (Array.isArray(p.media) ? p.media[0]?.url : "");
        if (url && VIDEO_EXTS.test(url)) return false;
        return true;
      });

      setPosts(prev => {
        const base   = replace ? [] : prev;
        const offset = base.length;
        return [...base, ...imagePosts.map((p, i) => mapPost(p, offset + i))];
      });

      setHasMore(hasNext);
    } catch (err: any) {
      console.error("Feed fetch failed:", err);
      setError(err?.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [accessToken, lowDopamineOnly, selectedCategories, loading, mapPost]);

  // ── Reset + initial fetch whenever filters change ──────────────────────────
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowDopamineOnly, JSON.stringify(selectedCategories)]);

  // ── IntersectionObserver for infinite scroll ────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const next = page + 1;
          setPage(next);
          fetchPage(next, false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, page]);

  // ── Optimistic like toggle ─────────────────────────────────────────────────
  const toggleLike = async (id: number) => {
    // Optimistic update
    setPosts(prev =>
      prev.map(p => p.id === id
        ? { ...p, liked: !p.liked, likes: p.liked ? Math.max(0, p.likes - 1) : p.likes + 1 }
        : p
      )
    );
    try {
      const post     = posts.find(p => p.id === id);
      const targetId = post?.remoteId ?? String(id);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
      await fetch(`${API_BASE}/posts/${targetId}/like`, { method: "POST", headers, credentials: "include" });
    } catch (e) {
      console.error("Like toggle failed:", e);
      // Revert on failure
      setPosts(prev =>
        prev.map(p => p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? Math.max(0, p.likes - 1) : p.likes + 1 }
          : p
        )
      );
    }
  };

  // ── Client-side filter (on top of server filter) ───────────────────────────
  const activeCategories: Category[] =
    selectedCategories && selectedCategories.length > 0
      ? selectedCategories
      : ["memes", "news", "other"];
  const onlyLow      = Boolean(lowDopamineOnly);
  const visiblePosts = posts.filter(
    p => activeCategories.includes(p.category) && (!onlyLow || p.lowDopamine)
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollArea className="flex-1 h-screen overflow-x-hidden main-feed-scroll">
      <div className="px-0 md:px-6 py-4 md:py-6">

        {/* Initial loading skeleton */}
        {loading && posts.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 px-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => fetchPage(1, true)}
              className="text-xs text-accent hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && visiblePosts.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-muted-foreground">No posts found.</p>
          </div>
        )}

        {/* Posts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-6 pb-24 md:pb-6 md:px-0">
          {visiblePosts.map((post) => (
            <div key={post.id} data-post-card className="bg-card rounded-none md:rounded-lg overflow-hidden w-screen md:w-full mb-6 md:mb-0">

              {/* Post Header */}
              <div className="p-3 md:p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-grow">
                  {post.uploaderId ? (
                    <Link to={`/profile/${encodeURIComponent(String(post.uploaderId))}`} className="flex items-center gap-3 min-w-0">
                      <img src={post.avatar} alt={`${post.username} avatar`} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    </Link>
                  ) : (
                    <Link to="/profile" className="flex items-center gap-3 min-w-0">
                      <img src={post.avatar} alt={`${post.username} avatar`} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    </Link>
                  )}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-1">
                      {post.uploaderId ? (
                        <Link to={`/profile/${encodeURIComponent(String(post.uploaderId))}`} className="text-sm font-medium text-foreground truncate">
                          {post.username}
                        </Link>
                      ) : (
                        <Link to="/profile" className="text-sm font-medium text-foreground truncate">{post.username}</Link>
                      )}
                      {post.isVerified && <BadgeCheck className="w-4 h-4 text-accent flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{post.time}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    aria-label="Like"
                    onClick={() => toggleLike(post.id)}
                    className="p-1 hover:bg-hover-bg rounded transition-colors"
                  >
                    <Heart className={`w-5 h-5 ${post.liked ? "stroke-red-500 fill-red-500" : "text-icon-color"}`} />
                  </button>
                  <button
                    aria-label="Comment"
                    onClick={(e) => {
                      const imgEl  = document.getElementById(`post-image-${post.id}`);
                      const cardEl = (e.currentTarget as HTMLElement).closest("[data-post-card]") as HTMLElement | null;
                      const rect   = (imgEl || cardEl)?.getBoundingClientRect();
                      if (rect && onOpenComments) onOpenComments(post, rect);
                      else if (onOpenComments) onOpenComments(post, new DOMRect(0, 0, 0, 0));
                    }}
                    className="p-1 hover:bg-hover-bg rounded transition-colors"
                  >
                    <MessageCircle className="w-5 h-5 text-icon-color" />
                  </button>
                  <button
                    aria-label="Share"
                    onClick={(e) => {
                      const imgEl  = document.getElementById(`post-image-${post.id}`);
                      const cardEl = (e.currentTarget as HTMLElement).closest("[data-post-card]") as HTMLElement | null;
                      const rect   = (imgEl || cardEl)?.getBoundingClientRect();
                      if (rect && onOpenShare) onOpenShare(post, rect);
                      else if (onOpenShare) onOpenShare(post, new DOMRect(0, 0, 0, 0));
                    }}
                    className="p-1 hover:bg-hover-bg rounded transition-colors"
                  >
                    <Share2 className="w-5 h-5 text-icon-color" />
                  </button>
                </div>
              </div>

              {/* Post Image */}
              <div className="bg-post-bg w-full aspect-square md:h-auto">
                <img
                  id={`post-image-${post.id}`}
                  src={post.image}
                  alt="Post"
                  className="block w-full h-full object-cover"
                />
              </div>

              {/* Post Footer */}
              <div className="p-3 md:p-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2 overflow-x-auto no-scrollbar">
                  <span className="px-2 py-0.5 rounded bg-muted text-foreground capitalize flex-shrink-0">{post.category}</span>
                  {post.lowDopamine && <span className="px-2 py-0.5 rounded bg-muted text-foreground flex-shrink-0">Low Dopamine</span>}
                  <span className="flex-shrink-0">{post.likes} likes</span>
                  <span className="flex-shrink-0">{post.comments} comments</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{post.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Infinite-scroll sentinel + loading indicator */}
        <div ref={sentinelRef} className="flex items-center justify-center py-6">
          {loading && posts.length > 0 && (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-xs text-muted-foreground">You're all caught up ✓</p>
          )}
        </div>

      </div>
    </ScrollArea>
  );
};

export default MainFeed;