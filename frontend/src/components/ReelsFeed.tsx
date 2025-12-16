import { Heart, MessageCircle, Share2, BadgeCheck, MoreHorizontal, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Category, FeedPost } from "@/components/MainFeed";

export type Reel = {
  id: number;
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

const avatarFor = (seed: string) => `https://i.pravatar.cc/100?u=${encodeURIComponent(seed)}`;
const posterFor = (seed: string | number) => `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/600/900`;

type ReelsFeedProps = {
  onOpenComments?: (post: FeedPost, fromRect: DOMRect) => void;
  onOpenShare?: (post: FeedPost, fromRect: DOMRect) => void;
  selectedCategories?: Category[];
  lowDopamineOnly?: boolean;
  onBack?: () => void;
};

const SAMPLE_REELS: Reel[] = [
  {
    id: 101,
    username: "reels_sarah",
    description: "Mindful tech tip: set a timer before scrolling.",
    likes: 230,
    comments: 12,
    time: "2h",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    poster: posterFor("reel-sarah"),
    avatar: avatarFor("reels_sarah"),
    category: "news",
    lowDopamine: true,
    isVerified: true,
  },
  {
    id: 102,
    username: "alex_reels",
    description: "Weekend vibes and focus tips.",
    likes: 450,
    comments: 28,
    time: "4h",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    poster: posterFor("reel-alex"),
    avatar: avatarFor("alex_reels"),
    category: "other",
    lowDopamine: false,
    isVerified: false,
  },
  {
    id: 103,
    username: "jordan_reels",
    description: "Minimalist workspace tour.",
    likes: 180,
    comments: 9,
    time: "6h",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    poster: posterFor("reel-jordan"),
    avatar: avatarFor("jordan_reels"),
    category: "memes",
    lowDopamine: false,
    isVerified: false,
  },
  {
    id: 104,
    username: "emma_reels",
    description: "Intentional design = better habits.",
    likes: 310,
    comments: 18,
    time: "8h",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    poster: posterFor("reel-emma"),
    avatar: avatarFor("emma_reels"),
    category: "news",
    lowDopamine: true,
    isVerified: true,
  },
];

const ReelsFeed = ({ onOpenComments, onOpenShare, selectedCategories, lowDopamineOnly, onBack }: ReelsFeedProps) => {
  const [reels, setReels] = useState<Reel[]>(SAMPLE_REELS);
  const [mutedByDefault] = useState(true);

  const activeCategories: Category[] = selectedCategories && selectedCategories.length > 0 ? selectedCategories : ["memes", "news", "other"];
  const onlyLow = Boolean(lowDopamineOnly);
  const visibleReels = reels.filter((r) => activeCategories.includes(r.category) && (!onlyLow || r.lowDopamine));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const [visibleIndex, setVisibleIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Prefetch next N videos
  const prefetch = useCallback((index: number) => {
    for (let i = index + 1; i <= index + 2; i++) {
      const reel = visibleReels[i];
      if (!reel) continue;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "video";
      link.href = reel.video;
      document.head.appendChild(link);
    }
  }, [visibleReels]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Ensure scroll-snap
    el.style.scrollSnapType = "y mandatory";
    el.style.overflowY = "auto";

    // Intersection observer for autoplay
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const idx = Number(entry.target.getAttribute("data-index"));
        const vidId = entry.target.getAttribute("data-vid-id");
        const video = vidId ? document.getElementById(vidId) as HTMLVideoElement | null : null;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          setVisibleIndex(idx);
          // play this video
          try { video?.play(); } catch {}
          // pause others
          Object.keys(videoRefs.current).forEach((k) => {
            const n = Number(k);
            if (n !== idx) videoRefs.current[n]?.pause();
          });
          prefetch(idx);
        } else {
          // when out of view pause
          try { if (video && !entry.isIntersecting) video.pause(); } catch {}
        }
      });
    }, { threshold: [0.6] });

    const items = Array.from(el.querySelectorAll('[data-reel-item]')) as HTMLElement[];
    items.forEach((it) => observerRef.current?.observe(it));

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [visibleReels, prefetch]);

  useEffect(() => {
    // when visibleIndex changes ensure muted state default
    const vid = videoRefs.current[visibleIndex];
    if (vid) {
      vid.muted = mutedByDefault;
      vid.loop = true;
      vid.playsInline = true;
    }
  }, [visibleIndex, mutedByDefault]);

  const toggleMute = (idx: number) => {
    const v = videoRefs.current[idx];
    if (!v) return;
    v.muted = !v.muted;
  };

  const togglePlay = (idx: number) => {
    const v = videoRefs.current[idx];
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const handleClick = (e: React.MouseEvent, idx: number) => {
    // clicking anywhere toggles play/pause; clicking right action bar shouldn't toggle
    const target = e.target as HTMLElement;
    if (target.closest('[data-action]')) return;
    togglePlay(idx);
  };

  const handleComment = (e: React.MouseEvent, reel: Reel) => {
    const vidEl = videoRefs.current[visibleReels.indexOf(reel)];
    const rect = vidEl ? vidEl.getBoundingClientRect() : new DOMRect(0,0,0,0);
    if (onOpenComments) onOpenComments({ id: reel.id, username: reel.username, content: reel.description, likes: reel.likes, comments: reel.comments, time: reel.time, image: reel.poster, avatar: reel.avatar, category: reel.category, lowDopamine: reel.lowDopamine, isVerified: reel.isVerified, liked: reel.liked }, rect);
  };

  // responsive max width
  const containerClass = "w-full h-screen flex flex-col items-center justify-start bg-black text-white";

  return (
    <div className={`flex-1 relative flex items-center justify-center`}>
      <div className="absolute top-4 left-4 z-20">
        <button onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/50 text-white text-sm hover:bg-black/60">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div ref={containerRef} className={`${containerClass} snap-y snap-mandatory`} style={{ maxWidth: 600, margin: "0 auto" }}>
        {visibleReels.map((reel, idx) => {
          const isVisible = idx === visibleIndex;
          return (
            <div
              key={reel.id}
              data-reel-item
              data-index={idx}
              data-vid-id={`reel-video-${reel.id}`}
              className="snap-start w-full flex items-center justify-center"
              style={{ height: '100vh', scrollSnapAlign: 'start', padding: '12px' }}
              onClick={(e) => handleClick(e, idx)}
            >
              <div className="relative w-full max-w-[600px] h-[90vh] rounded-xl overflow-hidden bg-black shadow-lg">
                <video
                  id={`reel-video-${reel.id}`}
                  ref={(el) => (videoRefs.current[idx] = el)}
                  poster={reel.poster}
                  // don't set src until near viewport to allow lazy
                  src={isVisible ? reel.video : undefined}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  preload={isVisible ? 'auto' : 'metadata'}
                />

                {/* Right action bar */}
                <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white z-10">
                  <button data-action aria-label="Like" onClick={() => toggleLike(reel.id)} className={`flex flex-col items-center gap-1`}>
                    <Heart className={`w-8 h-8 ${reel.liked ? 'text-red-500' : 'text-white'}`} />
                    <span className="text-xs">{reel.likes}</span>
                  </button>
                  <button data-action aria-label="Comment" onClick={(e) => handleComment(e, reel)} className="flex flex-col items-center gap-1">
                    <MessageCircle className="w-8 h-8 text-white" />
                    <span className="text-xs">{reel.comments}</span>
                  </button>
                  <button data-action aria-label="Share" onClick={(e) => { const rect = (videoRefs.current[idx])?.getBoundingClientRect() ?? new DOMRect(0,0,0,0); if (onOpenShare) onOpenShare({ id: reel.id, username: reel.username, content: reel.description, likes: reel.likes, comments: reel.comments, time: reel.time, image: reel.poster, avatar: reel.avatar, category: reel.category, lowDopamine: reel.lowDopamine, isVerified: reel.isVerified, liked: reel.liked }, rect); }} className="flex flex-col items-center gap-1">
                    <Share2 className="w-8 h-8 text-white" />
                    <span className="text-xs">Share</span>
                  </button>
                  <button data-action aria-label="More" className="flex flex-col items-center gap-1">
                    <MoreHorizontal className="w-6 h-6 text-white" />
                  </button>
                </div>

                {/* Bottom overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10">
                  <div className="flex items-center gap-3">
                    <img src={reel.avatar} alt={reel.username} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{reel.username}</span>
                        {reel.isVerified && <BadgeCheck className="w-4 h-4 text-accent" />}
                        <button className="ml-2 text-sm px-2 py-1 rounded bg-white text-black">Follow</button>
                      </div>
                      <div className="text-sm text-muted-foreground truncate max-w-full">{reel.description}</div>
                    </div>
                    <div className="flex flex-col items-center ml-3">
                      <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-xs">♫</div>
                    </div>
                  </div>
                </div>

                {/* Center overlay controls (play/pause, volume) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="opacity-0 hover:opacity-100 pointer-events-auto transition-opacity">
                    <button onClick={() => togglePlay(idx)} className="bg-black/50 p-3 rounded-full text-white pointer-events-auto">Play</button>
                    <button onClick={() => toggleMute(idx)} className="ml-2 bg-black/50 p-3 rounded-full text-white pointer-events-auto">Sound</button>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReelsFeed;
