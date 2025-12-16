import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import BottomBar from "@/components/BottomBar";
import MainFeed, { type FeedPost, type Category } from "@/components/MainFeed";
import InboxSidebar from "@/components/InboxSidebar";
import CommentsSheet from "@/components/CommentsSheet";

const Index = () => {
  const [monochrome, setMonochrome] = useState(false);
  const [postPreview, setPostPreview] = useState<FeedPost | null>(null);
  const [postToShare, setPostToShare] = useState<FeedPost | null>(null);
  const [mobileComments, setMobileComments] = useState<FeedPost | null>(null);
  const allCategories: Category[] = ["memes", "news", "other"];
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(allCategories);
  const [lowDopamineOnly, setLowDopamineOnly] = useState(false);

  const inboxRef = useRef<HTMLDivElement | null>(null);
  const [fly, setFly] = useState<
    | null
    | {
        img: string;
        from: { left: number; top: number; width: number; height: number };
        to: { left: number; top: number; width: number; height: number };
      }
  >(null);
  const [phase, setPhase] = useState<"start" | "end" | null>(null);

  const handleOpenComments = (post: FeedPost, fromRect: DOMRect) => {
    if (window.innerWidth < 1280) { // xl breakpoint: inbox hidden
      setMobileComments(post);
      return;
    }
    const inboxRect = inboxRef.current?.getBoundingClientRect();
    if (!inboxRect || !fromRect || (fromRect.width === 0 && fromRect.height === 0)) {
      setPostPreview(post);
      return;
    }

    const from = { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height };

    const padding = 16;
    const targetWidth = Math.min(Math.max(140, Math.min(inboxRect.width - padding * 2, from.width)), 220);
    const aspect = from.width / Math.max(1, from.height);
    const targetHeight = Math.max(100, Math.min(inboxRect.height - 140, targetWidth / Math.max(0.25, Math.min(2.5, aspect))))

    const to = {
      left: inboxRect.left + padding,
      top: inboxRect.top + 72,
      width: targetWidth,
      height: targetHeight,
    };

    setFly({ img: post.image, from, to });
    setPhase("start");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("end"));
    });

    // After animation, open preview
    const totalMs = 450;
    window.setTimeout(() => {
      setFly(null);
      setPhase(null);
      setPostPreview(post);
    }, totalMs);
  };

  const handleOpenShare = (post: FeedPost, fromRect: DOMRect) => {
    const inboxRect = inboxRef.current?.getBoundingClientRect();
    if (!inboxRect || !fromRect || (fromRect.width === 0 && fromRect.height === 0)) {
      setPostToShare(post);
      return;
    }

    const from = { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height };

    const padding = 16;
    const targetWidth = Math.min(Math.max(140, Math.min(inboxRect.width - padding * 2, from.width)), 220);
    const aspect = from.width / Math.max(1, from.height);
    const targetHeight = Math.max(100, Math.min(inboxRect.height - 140, targetWidth / Math.max(0.25, Math.min(2.5, aspect))))

    const to = {
      left: inboxRect.left + padding,
      top: inboxRect.top + 72,
      width: targetWidth,
      height: targetHeight,
    };

    setFly({ img: post.image, from, to });
    setPhase("start");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("end"));
    });

    const totalMs = 450;
    window.setTimeout(() => {
      setFly(null);
      setPhase(null);
      setPostToShare(post);
    }, totalMs);
  };

  return (
    <div className={`flex min-h-screen bg-background ${monochrome ? "grayscale" : ""}`}>
      {/* Animation overlay */}
      {fly && (
        <div className="pointer-events-none fixed inset-0 z-[9999]">
          <img
            src={fly.img}
            alt="flying"
            onAnimationEnd={() => {}}
            style={{
              position: "fixed",
              left: phase === "start" ? fly.from.left : fly.to.left,
              top: phase === "start" ? fly.from.top : fly.to.top,
              width: phase === "start" ? fly.from.width : fly.to.width,
              height: phase === "start" ? fly.from.height : fly.to.height,
              borderRadius: 8,
              objectFit: "cover",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              transition: "left 450ms cubic-bezier(0.2, 0.8, 0.2, 1), top 450ms cubic-bezier(0.2, 0.8, 0.2, 1), width 450ms cubic-bezier(0.2, 0.8, 0.2, 1), height 450ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 450ms ease",
              opacity: phase === "start" ? 1 : 0.9,
              transform: phase === "start" ? "scale(1)" : "scale(0.98)",
            }}
          />
        </div>
      )}

      <div className="hidden md:block">
        <Sidebar
          monochrome={monochrome}
          onToggleMonochrome={setMonochrome}
          selectedCategories={selectedCategories}
          onToggleCategory={(c) => setSelectedCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))}
          onSelectAllCategories={() => setSelectedCategories(allCategories)}
          lowDopamineOnly={lowDopamineOnly}
          onToggleLowDopamine={setLowDopamineOnly}
        />
      </div>
      <MainFeed onOpenComments={handleOpenComments} onOpenShare={handleOpenShare} selectedCategories={selectedCategories} lowDopamineOnly={lowDopamineOnly} />
      <div ref={inboxRef} className="relative hidden xl:block">
        <InboxSidebar postPreview={postPreview} onBackFromPost={() => setPostPreview(null)} postToShare={postToShare} onBackFromShare={() => setPostToShare(null)} />
      </div>
      <CommentsSheet open={!!mobileComments} post={mobileComments} onClose={() => setMobileComments(null)} />
      <BottomBar
        monochrome={monochrome}
        onToggleMonochrome={setMonochrome}
        selectedCategories={selectedCategories}
        onToggleCategory={(c) => setSelectedCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))}
        onSelectAllCategories={() => setSelectedCategories(allCategories)}
        lowDopamineOnly={lowDopamineOnly}
        onToggleLowDopamine={setLowDopamineOnly}
      />
    </div>
  );
};

export default Index;
