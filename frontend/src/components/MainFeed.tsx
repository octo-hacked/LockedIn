import { Heart, MessageCircle, Share2, BadgeCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { formatDateTime, formatDateRelative } from "@/lib/utils";

export type Category = "memes" | "news" | "other";

export type FeedPost = {
  id: number;
  remoteId?: string; // backend _id string when available (post id)
  uploaderId?: string; // uploadedBy._id when available (user id)
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

const avatarFor = (seed: string) => `https://i.pravatar.cc/100?u=${encodeURIComponent(seed)}`;
const postImageFor = (seed: string | number) => `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/600/400`;

type MainFeedProps = {
  onOpenComments?: (post: FeedPost, fromRect: DOMRect) => void;
  onOpenShare?: (post: FeedPost, fromRect: DOMRect) => void;
  selectedCategories?: Category[];
  lowDopamineOnly?: boolean;
};

const MainFeed = ({ onOpenComments, onOpenShare, selectedCategories, lowDopamineOnly }: MainFeedProps) => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const { accessToken } = useAuth();

  const defaultPosts: FeedPost[] = [
    {
      id: 1,
      username: "sarah_chen",
      content: "Just finished reading about mindful technology and how it can help us stay present in our digital lives.",
      likes: 23,
      comments: 5,
      time: "2h",
      image: postImageFor("sarah-1"),
      avatar: avatarFor("sarah_chen"),
      category: "news",
      lowDopamine: true,
      isVerified: true,
      liked: false,
    },
    {
      id: 2,
      username: "alex_m",
      content: "Our app keeps you mindful of your time with a finite feed, gentle reminders, and low-dopamine design.",
      likes: 45,
      comments: 12,
      time: "4h",
      image: postImageFor("alex-2"),
      avatar: avatarFor("alex_m"),
      category: "other",
      lowDopamine: false,
      isVerified: false,
      liked: false,
    },
  ];

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const categoryParam = (selectedCategories && selectedCategories.length === 1) ? selectedCategories[0] : undefined;
      const res = await import("@/lib/posts");
      const data = await res.fetchFeed({ page: 1, limit: 20, category: categoryParam, lowDopamineOnly: Boolean(lowDopamineOnly), sortBy: "createdAt", token: accessToken });
      const items: any[] = data?.posts || data?.items || [];
      const mapped = items.map((p: any) => {
        const username = p.uploadedBy?.username || p.author?.username || p.username || "unknown";
        const rawCategory = String(p.category || "other");
        const category = (["memes", "news", "other"].includes(rawCategory) ? rawCategory : "other") as Category;
        const mediaUrl = typeof p.media === "string" ? p.media : Array.isArray(p.media) ? p.media[0]?.url : undefined;

        return {
          id: typeof p.id === 'number' ? p.id : (Math.floor(Math.random()*1000000)),
          remoteId: p._id ?? (typeof p.id === 'string' ? p.id : undefined),
          uploaderId: p.uploadedBy?._id ?? p.author?._id ?? p.uploadedBy?._id,
          username,
          content: p.description || p.title || p.content || "",
          likes: p.likes ?? 0,
          comments: p.comments ?? p.commentsCount ?? 0,
          time: p.timeAgo ?? (p.createdAt ? formatDateRelative(p.createdAt) : ""),
          image: mediaUrl || p.image || postImageFor(p._id || p.id || Math.random()),
          avatar: p.uploadedBy?.avatar || avatarFor(username || "user"),
          category,
          lowDopamine: Boolean(p.isLowDopamine),
          isVerified: Boolean(p.uploadedBy?.isVerified || p.author?.isVerified),
          liked: Boolean(p.isLikedByUser ?? p.isLiked ?? p.liked),
        } as FeedPost;
      });

      if (mapped.length === 0) {
        // if API returned no posts, fall back to default sample posts
        setPosts(defaultPosts);
      } else {
        setPosts(mapped);
      }
    } catch (err) {
      console.error("Failed to load feed:", err);
      // On network/API failure, show default sample posts so UI stays useful during development
      setPosts(defaultPosts);
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedCategories, lowDopamineOnly]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const toggleLike = async (id: number) => {
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? Math.max(0, p.likes - 1) : p.likes + 1 } : p)),
    );
    try {
      const post = posts.find((p) => p.id === id);
      const targetId = post?.remoteId ?? post?.id ?? id;
      const res = await import("@/lib/posts");
      await res.toggleLike(targetId, accessToken ?? undefined);
    } catch (e) {
      console.error("Like toggle failed:", e);
      // On error, revert optimistic update
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? Math.max(0, p.likes - 1) : p.likes + 1 } : p)),
      );
    }
  };

  const activeCategories: Category[] = selectedCategories && selectedCategories.length > 0 ? selectedCategories : ["memes", "news", "other"];
  const onlyLow = Boolean(lowDopamineOnly);
  const visiblePosts = posts.filter((p) => activeCategories.includes(p.category) && (!onlyLow || p.lowDopamine));

  return (
    <ScrollArea className="flex-1 h-screen  overflow-x-hidden main-feed-scroll">
      <div className="px-0 md:px-6 py-4 md:py-6">
        {/* Posts Grid */}
        {/* Added px-4 for mobile padding to the grid container itself */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-6 pb-24 md:pb-6  md:px-0"> {/* Removed lg:grid-cols-3 and added px-4 */}
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    aria-label="Like"
                    onClick={() => toggleLike(post.id)}
                    className={`p-1 hover:bg-hover-bg rounded transition-colors ${post.liked ? "text-red-500" : ""}`}
                  >
                    <Heart className={`w-5 h-5 ${post.liked ? "stroke-red-500 fill-red-500" : "text-icon-color"}`} />
                  </button>
                  <button
                    aria-label="Comment"
                    onClick={(e) => {
                      const imgEl = document.getElementById(`post-image-${post.id}`);
                      const cardEl = (e.currentTarget as HTMLElement).closest('[data-post-card]') as HTMLElement | null;
                      const rect = (imgEl || cardEl)?.getBoundingClientRect();
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
                      const imgEl = document.getElementById(`post-image-${post.id}`);
                      const cardEl = (e.currentTarget as HTMLElement).closest('[data-post-card]') as HTMLElement | null;
                      const rect = (imgEl || cardEl)?.getBoundingClientRect();
                      if (rect && onOpenShare) onOpenShare(post, rect);
                      else if (onOpenShare) onOpenShare(post, new DOMRect(0, 0, 0, 0));
                    }}
                    className="p-1 hover:bg-hover-bg rounded transition-colors"
                  >
                    <Share2 className="w-5 h-5 text-icon-color" />
                  </button>
                </div>
              </div>

              {/* Post Content */}
              <div className="bg-post-bg w-full aspect-square md:h-auto">
                <img id={`post-image-${post.id}`} src={post.image} alt="Post" className="block w-full h-full object-cover" />
              </div>

              {/* Post Description & Stats */}
              <div className="p-3 md:p-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2 overflow-x-auto no-scrollbar">
                  <span className="px-2 py-0.5 rounded bg-muted text-foreground capitalize flex-shrink-0">{post.category}</span>
                  {post.lowDopamine && <span className="px-2 py-0.5 rounded bg-muted text-foreground flex-shrink-0">Low Dopamine</span>}
                  <span className="flex-shrink-0">{post.likes} likes</span>
                  <span className="flex-shrink-0">{post.comments} comments</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {post.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export default MainFeed;
