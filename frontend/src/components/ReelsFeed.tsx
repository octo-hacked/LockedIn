import {
  Heart, MessageCircle, Share2, BadgeCheck, MoreHorizontal,
  ArrowLeft, Play, Volume2, VolumeX, Loader2, RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Category, FeedPost } from "@/components/MainFeed";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/config";
import { formatDateRelative } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Reel = {
  id: number;
  remoteId?: string;       // backend _id
  uploaderId?: string;     // uploadedBy._id
  username: string;
  description: string;
  likes: number;
  comments: number;
  time: string;
  video: string;
  poster: string;
  avatar: string;
  category: Category;
  lowDopamine: boolean;
  isVerified: boolean;
  liked?: boolean;
};

type ReelsFeedProps = {
  onOpenComments?: (post: FeedPost, fromRect: DOMRect) => void;
  onOpenShare?: (post: FeedPost, fromRect: DOMRect) => void;
  selectedCategories?: Category[];
  lowDopamineOnly?: boolean;
  onBack?: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avatarFor = (seed: string) =>
  `https://i.pravatar.cc/100?u=${encodeURIComponent(seed)}`;
const posterFor = (seed: string | number) =>
  `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/600/900`;

/** Every 5th reel (0-indexed: 4, 9, 14 …) is a mindful-break reel */
const isMindfulBreak = (idx: number) => (idx + 1) % 5 === 0;


// ─── Component ────────────────────────────────────────────────────────────────

const ReelsFeed = ({
  onOpenComments,
  onOpenShare,
  selectedCategories,
  lowDopamineOnly,
  onBack,
}: ReelsFeedProps) => {
  const { accessToken } = useAuth();

  // ── API fetch state ────────────────────────────────────────────────────
  const [reels,      setReels]      = useState<Reel[]>([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loadingAPI, setLoadingAPI] = useState(false);
  const [apiError,   setApiError]   = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  // ── State ───────────────────────────────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(0);

  /** muted: true by default (browsers require mute to autoplay) */
  const [mutedMap, setMutedMap] = useState<Record<number, boolean>>({});

  /** Whether each video is currently playing (driven by video events) */
  const [playingMap, setPlayingMap] = useState<Record<number, boolean>>({});

  /** Per-reel like state */
  const [likedMap, setLikedMap] = useState<Record<number, { liked: boolean; count: number }>>({});

  /** Set of indices where the mindful-break overlay has been dismissed */
  const [mindfulDismissed, setMindfulDismissed] = useState<Set<number>>(new Set());

  const avatarFor = (seed: string) =>
    `https://i.pravatar.cc/100?u=${encodeURIComponent(seed)}`;
  const posterFor = (seed: string | number) =>
    `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/600/900`;

  /** Map a raw API reel document into our Reel shape */
  const mapReel = useCallback((p: any, idx: number): Reel => {
    const username   = p.uploadedBy?.username || p.username || "unknown";
    const rawCat     = String(p.category || "other").toLowerCase();
    const validCats: Category[] = ["memes", "news", "other"];
    const category   = (validCats.includes(rawCat as Category) ? rawCat : "other") as Category;
    const mediaUrl   = typeof p.media === "string" ? p.media
                     : Array.isArray(p.media)       ? p.media[0]?.url
                     : undefined;

    return {
      id:         idx,                              // local numeric key for videoRefs
      remoteId:   p._id ?? (typeof p.id === "string" ? p.id : undefined),
      uploaderId: p.uploadedBy?._id,
      username,
      description: p.description || p.title || "",
      likes:       p.likes ?? 0,
      comments:    p.comments ?? 0,
      time:        p.timeAgo ?? (p.createdAt ? formatDateRelative(p.createdAt) : ""),
      video:       mediaUrl || "",
      poster:      p.uploadedBy?.avatar || posterFor(p._id || idx),
      avatar:      p.uploadedBy?.avatar || avatarFor(username),
      category,
      lowDopamine: Boolean(p.isLowDopamine),
      isVerified:  Boolean(p.uploadedBy?.isVerified),
      liked:       Boolean(p.isLikedByUser ?? false),
    };
  }, []);

  /** Fetch one page of reels from the backend */
  const fetchReels = useCallback(async (pageNum: number, replace = false) => {
    setLoadingAPI(true);
    setApiError(null);
    try {
      const params = new URLSearchParams({
        page:  String(pageNum),
        limit: "10",
        ...(lowDopamineOnly ? { lowDopamineOnly: "true" } : {}),
      });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const res  = await fetch(`${API_BASE}/posts/reels?${params}`, { headers, credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const rawItems: any[] = data?.reels || data?.posts || data?.items || data?.data?.reels || [];
      const totalCount: number = data?.totalReels ?? data?.total ?? rawItems.length;

      if (rawItems.length === 0) {
        setHasMore(false);
        if (replace) setReels([]);
        return;
      }

      setReels(prev => {
        const base   = replace ? [] : prev;
        const offset = base.length;
        const mapped = rawItems.map((p, i) => mapReel(p, offset + i));
        return [...base, ...mapped];
      });

      setHasMore((pageNum * 10) < totalCount);
    } catch (err: any) {
      console.error("Failed to fetch reels:", err);
      setApiError(err?.message || "Failed to load reels");
      setHasMore(false);
    } finally {
      setLoadingAPI(false);
    }
  }, [accessToken, lowDopamineOnly, mapReel]);

  // Initial fetch + refetch when filter changes
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchReels(1, true);
  }, [lowDopamineOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load next page when user approaches the last reel
  useEffect(() => {
    if (!hasMore || loadingAPI) return;
    if (reels.length > 0 && activeIndex >= reels.length - 3) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchReels(nextPage, false);
    }
  }, [activeIndex, reels.length, hasMore, loadingAPI]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side category filter applied on top of the fetched list
  const activeCategories: Category[] =
    selectedCategories && selectedCategories.length > 0
      ? selectedCategories
      : ["memes", "news", "other"];
  const onlyLow = Boolean(lowDopamineOnly);
  const visibleReels = reels.filter(
    (r) => activeCategories.includes(r.category) && (!onlyLow || r.lowDopamine)
  );



  // ── Scroll → detect active reel ─────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollTop / el.clientHeight);
        setActiveIndex((prev) => (prev === idx ? prev : idx));
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // ── Play / pause logic when active index changes or reels first load ───────
  useEffect(() => {
    visibleReels.forEach((_, idx) => {
      const video = videoRefs.current[idx];
      if (!video) return;

      if (idx === activeIndex) {
        // Always ensure the active video is muted (required for autoplay)
        video.muted = mutedMap[idx] !== false;

        if (isMindfulBreak(idx) && !mindfulDismissed.has(idx)) {
          video.pause();
        } else {
          // If the video has enough data, play immediately;
          // otherwise wait for canplay which will trigger playOnReady below.
          if (video.readyState >= 3) {
            video.play().catch(() => {});
          }
          // attach a one-shot canplay listener in case data isn't ready yet
          const onCanPlay = () => {
            video.removeEventListener("canplay", onCanPlay);
            // only play if this is still the active slide
            if (videoRefs.current[activeIndex] === video) {
              video.play().catch(() => {});
            }
          };
          video.addEventListener("canplay", onCanPlay);
          // clean up listener if it never fires (e.g. index changes)
          return () => video.removeEventListener("canplay", onCanPlay);
        }
      } else {
        video.pause();
        if (Math.abs(idx - activeIndex) > 2 && video.src) {
          video.load();
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, mindfulDismissed, visibleReels.length]);

  // ── Sync mute imperatively when mutedMap changes ──────────────────────────
  useEffect(() => {
    Object.entries(mutedMap).forEach(([idxStr, muted]) => {
      const video = videoRefs.current[Number(idxStr)];
      if (video) video.muted = muted;
    });
  }, [mutedMap]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const togglePlay = (idx: number) => {
    const video = videoRefs.current[idx];
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const toggleMute = (idx: number) => {
    setMutedMap((prev) => ({ ...prev, [idx]: !(prev[idx] !== false) }));
  };

  const toggleLike = (reel: Reel) => {
    setLikedMap((prev) => {
      const cur = prev[reel.id] ?? { liked: reel.liked ?? false, count: reel.likes };
      return {
        ...prev,
        [reel.id]: {
          liked: !cur.liked,
          count: cur.liked ? cur.count - 1 : cur.count + 1,
        },
      };
    });
  };

  const dismissMindful = (idx: number) => {
    setMindfulDismissed((prev) => new Set([...prev, idx]));
    const video = videoRefs.current[idx];
    if (video) video.play().catch(() => {});
  };

  const handleComment = (reel: Reel, idx: number) => {
    const video = videoRefs.current[idx];
    const rect = video?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
    onOpenComments?.(
      {
        id: reel.id,
        username: reel.username,
        content: reel.description,
        likes: reel.likes,
        comments: reel.comments,
        time: reel.time,
        image: reel.poster,
        avatar: reel.avatar,
        category: reel.category,
        lowDopamine: reel.lowDopamine,
        isVerified: reel.isVerified,
        liked: reel.liked,
      },
      rect
    );
  };

  const handleShare = (reel: Reel, idx: number) => {
    const video = videoRefs.current[idx];
    const rect = video?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
    onOpenShare?.(
      {
        id: reel.id,
        username: reel.username,
        content: reel.description,
        likes: reel.likes,
        comments: reel.comments,
        time: reel.time,
        image: reel.poster,
        avatar: reel.avatar,
        category: reel.category,
        lowDopamine: reel.lowDopamine,
        isVerified: reel.isVerified,
        liked: reel.liked,
      },
      rect
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    /**
     * Outer wrapper: full-width column. On mobile subtract the BottomBar height
     * (h-14 = 56px) so the feed never slides under it.
     */
    <div className="flex-1 relative bg-black overflow-hidden">

      {/* Back button — always on top */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm hover:bg-black/70 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Responsive height:
            Mobile  → viewport minus BottomBar (h-14 = 56px)
            Desktop → full viewport (BottomBar is md:hidden so not rendered)
      */}
      <style>{`
        .reel-scroll-container, .reel-slide {
          height: calc(100vh - 56px);
        }
        @media (min-width: 768px) {
          .reel-scroll-container, .reel-slide {
            height: 100vh;
          }
        }
      `}</style>
      <div
        ref={containerRef}
        className="reel-scroll-container w-full overflow-y-scroll"
        style={{
          scrollSnapType: "y mandatory",
          scrollBehavior: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >

        {visibleReels.map((reel, idx) => {
          const isMuted = mutedMap[idx] !== false; // default muted
          const isPlaying = playingMap[idx] ?? false;
          const likeState = likedMap[reel.id] ?? {
            liked: reel.liked ?? false,
            count: reel.likes,
          };
          const isMindful = isMindfulBreak(idx);
          const showMindfulOverlay = isMindful && !mindfulDismissed.has(idx);
          const isActive = idx === activeIndex;

          // Load src for current reel and its immediate neighbours
          const shouldLoadSrc = Math.abs(idx - activeIndex) <= 1;

          return (
            /*
             * Outer slide: full snap height, black background fills any
             * letterbox space around the 9:16 video box.
             * flex + items-center + justify-center centres the inner box.
             */
            <div
              key={reel.id}
              className="reel-slide w-full flex-shrink-0 bg-black flex items-center justify-center select-none"
              style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-action]")) return;
                if (showMindfulOverlay) return;
                togglePlay(idx);
              }}
            >
              {/*
               * Inner 9:16 box.
               * `width: auto; height: auto` lets the browser find the
               * largest 9:16 rectangle that fits inside both max-width (100%)
               * and max-height (100%) — i.e. "contain" behaviour.
               * On a portrait phone this fills the full width; on a landscape
               * desktop it fills the full height with black bars on each side.
               */}
              <div
                className="relative overflow-hidden"
                style={{
                  aspectRatio: "9 / 16",
                  maxHeight: "100%",
                  maxWidth: "100%",
                  width: "auto",
                  height: "auto",
                }}
              >
              {/* ── Video ─────────────────────────────────────────────── */}
              <video
                ref={(el) => (videoRefs.current[idx] = el)}
                src={shouldLoadSrc ? reel.video : undefined}
                poster={reel.poster}
                className="w-full h-full object-cover"
                muted={isMuted}
                autoPlay={isActive && !showMindfulOverlay}
                loop
                playsInline
                preload={isActive ? "auto" : "metadata"}
                onPlay={() =>
                  setPlayingMap((prev) => ({ ...prev, [idx]: true }))
                }
                onPause={() =>
                  setPlayingMap((prev) => ({ ...prev, [idx]: false }))
                }
                onCanPlay={() => {
                  // When video is ready, play it if it is the active non-break reel
                  if (isActive && !showMindfulOverlay) {
                    videoRefs.current[idx]?.play().catch(() => {});
                  }
                }}
              />

              {/* ── Paused indicator (shown when paused, not mindful break) ── */}
              {!isPlaying && !showMindfulOverlay && isActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                    <Play className="w-7 h-7 text-white ml-1" fill="white" />
                  </div>
                </div>
              )}

              {/* ── Mindful Break Overlay ────────────────────────────── */}
              {showMindfulOverlay && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center z-30 px-8 text-center">
                  <div className="text-5xl mb-5">🧘</div>
                  <h2 className="text-white text-2xl font-bold mb-3">
                    Mindful Moment
                  </h2>
                  <p className="text-gray-300 text-sm leading-relaxed mb-2 max-w-xs">
                    You've watched <span className="text-white font-semibold">5 reels</span> in a row.
                  </p>
                  <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xs">
                    Take a breath — are you scrolling with intention, or just on autopilot?
                  </p>
                  <button
                    data-action
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissMindful(idx);
                    }}
                    className="px-7 py-3 bg-white text-black font-semibold rounded-full text-sm hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    Continue Watching
                  </button>
                </div>
              )}

              {/* ── Mute toggle (top-right) ──────────────────────────── */}
              <div
                data-action
                className="absolute top-4 right-4 z-20"
              >
                <button
                  data-action
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute(idx);
                  }}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* ── Right action bar ─────────────────────────────────── */}
              <div
                data-action
                className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-20"
              >
                {/* Like */}
                <button
                  data-action
                  aria-label="Like"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(reel);
                  }}
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                >
                  <Heart
                    className={`w-7 h-7 transition-colors ${
                      likeState.liked
                        ? "fill-red-500 stroke-red-500"
                        : "stroke-white"
                    }`}
                  />
                  <span className="text-white text-xs font-medium drop-shadow">
                    {likeState.count}
                  </span>
                </button>

                {/* Comment */}
                <button
                  data-action
                  aria-label="Comment"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleComment(reel, idx);
                  }}
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                >
                  <MessageCircle className="w-7 h-7 stroke-white" />
                  <span className="text-white text-xs font-medium drop-shadow">
                    {reel.comments}
                  </span>
                </button>

                {/* Share */}
                <button
                  data-action
                  aria-label="Share"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(reel, idx);
                  }}
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                >
                  <Share2 className="w-7 h-7 stroke-white" />
                  <span className="text-white text-xs font-medium drop-shadow">
                    Share
                  </span>
                </button>

                {/* More */}
                <button
                  data-action
                  aria-label="More options"
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                >
                  <MoreHorizontal className="w-7 h-7 stroke-white" />
                </button>
              </div>

              {/* ── Bottom info overlay ──────────────────────────────── */}
              <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none px-4 pt-16 pb-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Username row */}
                    <div className="flex items-center gap-2 mb-1.5 pointer-events-auto" data-action>
                      <img
                        src={reel.avatar}
                        alt={reel.username}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-white/40 flex-shrink-0"
                      />
                      <span className="text-white font-semibold text-sm truncate drop-shadow">
                        {reel.username}
                      </span>
                      {reel.isVerified && (
                        <BadgeCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      )}
                      <button
                        data-action
                        onClick={(e) => e.stopPropagation()}
                        className="ml-1 text-xs px-3 py-0.5 rounded-full border border-white/80 text-white hover:bg-white/10 transition-colors flex-shrink-0"
                      >
                        Follow
                      </button>
                    </div>
                    {/* Description */}
                    <p className="text-white/90 text-sm leading-relaxed drop-shadow line-clamp-2">
                      {reel.description}
                    </p>
                  </div>
                </div>
              </div>
              </div>{/* end 9:16 box */}
            </div>
          );
        })}
        {/* Infinite-scroll: loading next page spinner */}
        {loadingAPI && reels.length > 0 && (
          <div
            className="reel-slide w-full flex-shrink-0 bg-black flex items-center justify-center"
            style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
          >
            <Loader2 className="w-8 h-8 text-white animate-spin opacity-60" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReelsFeed;