import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImageIcon, PlaySquare, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { createPost } from "@/lib/posts";

// Allowed post types
export type PostType = "normal" | "reel";

// High-performance pan/zoom cropper using rAF for smoothness
function PanZoomCropper({
  fileUrl,
  mediaType,
  targetRatio = 1,
  onConfirm,
  onCancel,
}: {
  fileUrl: string;
  mediaType: "image" | "video";
  targetRatio?: number;
  onConfirm: (data: { previewUrl: string; meta: { scale: number; offsetX: number; offsetY: number; ratio: number } }) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  const posRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
  const rafRef = useRef<number | null>(null);

  const applyTransform = () => {
    const el = mediaRef.current as HTMLElement | null;
    if (!el) return;
    el.style.transform = `translate(-50%, -50%) translate(${posRef.current.x}px, ${posRef.current.y}px) scale(${scaleRef.current})`;
  };
  const schedule = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyTransform();
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerDown = (e: PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...posRef.current } };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      posRef.current = { x: dragRef.current.startPos.x + dx, y: dragRef.current.startPos.y + dy };
      schedule();
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY;
      const next = Math.min(4, Math.max(1, scaleRef.current * (1 + delta / 800)));
      scaleRef.current = next;
      setScale(next);
      schedule();
    };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove as any);
      window.removeEventListener("pointerup", onPointerUp as any);
      container.removeEventListener("wheel", onWheel as any);
    };
  }, []);

  useEffect(() => {
    scaleRef.current = scale;
    schedule();
  }, [scale]);

  const resetView = () => {
    posRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    setScale(1);
    schedule();
  };

  const doConfirm = async () => {
    const ratio = targetRatio;
    const size = 1080;
    const outW = Math.round(size);
    const outH = Math.round(size / ratio);

    if (mediaType === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = fileUrl;
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = rej;
      });
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const container = containerRef.current;
      if (!container) return;
      const { width: containerW, height: containerH } = container.getBoundingClientRect();
      const coverScale = Math.max(containerW / naturalW, containerH / naturalH);
      const totalScale = coverScale * scaleRef.current;
      const imgDisplayW = naturalW * totalScale;
      const imgDisplayH = naturalH * totalScale;
      const imgLeft = (containerW - imgDisplayW) / 2 + posRef.current.x;
      const imgTop = (containerH - imgDisplayH) / 2 + posRef.current.y;
      const srcX = Math.max(0, (0 - imgLeft) * (naturalW / imgDisplayW));
      const srcY = Math.max(0, (0 - imgTop) * (naturalH / imgDisplayH));
      const srcW = Math.min(naturalW - srcX, containerW * (naturalW / imgDisplayW));
      const srcH = Math.min(naturalH - srcY, containerH * (naturalH / imgDisplayH));
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      const url = canvas.toDataURL("image/jpeg", 0.92);
      onConfirm({ previewUrl: url, meta: { scale: scaleRef.current, offsetX: posRef.current.x, offsetY: posRef.current.y, ratio } });
      return;
    }

    const video = document.createElement("video");
    video.src = fileUrl;
    await new Promise((res) => {
      video.onloadeddata = () => res(null);
      setTimeout(res, 500);
    });
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outW, outH);
    }
    const container = containerRef.current;
    if (!ctx || !container) {
      onConfirm({ previewUrl: fileUrl, meta: { scale: scaleRef.current, offsetX: posRef.current.x, offsetY: posRef.current.y, ratio } });
      return;
    }
    const { width: containerW, height: containerH } = container.getBoundingClientRect();
    const videoW = video.videoWidth || containerW;
    const videoH = video.videoHeight || containerH;
    const coverScale = Math.max(containerW / videoW, containerH / videoH);
    const totalScale = coverScale * scaleRef.current;
    const dispW = videoW * totalScale;
    const dispH = videoH * totalScale;
    const imgLeft = (containerW - dispW) / 2 + posRef.current.x;
    const imgTop = (containerH - dispH) / 2 + posRef.current.y;
    const srcX = Math.max(0, (0 - imgLeft) * (videoW / dispW));
    const srcY = Math.max(0, (0 - imgTop) * (videoH / dispH));
    const srcW = Math.min(videoW - srcX, containerW * (videoW / dispW));
    const srcH = Math.min(videoH - srcY, containerH * (videoH / dispH));

    try {
      ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      const url = canvas.toDataURL("image/jpeg", 0.9);
      onConfirm({ previewUrl: url, meta: { scale: scaleRef.current, offsetX: posRef.current.x, offsetY: posRef.current.y, ratio } });
    } catch {
      onConfirm({ previewUrl: fileUrl, meta: { scale: scaleRef.current, offsetX: posRef.current.x, offsetY: posRef.current.y, ratio } });
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg overflow-hidden border border-border bg-black mx-auto" ref={containerRef} style={{ maxWidth: "min(100%, 65vh)" }}>
        <AspectRatio ratio={targetRatio}>
          <div className="relative w-full h-full touch-pan-y select-none cursor-grab active:cursor-grabbing">
            {mediaType === "image" ? (
              <img
                ref={mediaRef as any}
                src={fileUrl}
                alt="To crop"
                className="absolute left-1/2 top-1/2 will-change-transform"
                style={{ transform: "translate(-50%, -50%) translate(0px, 0px) scale(1)", transformOrigin: "center" }}
                draggable={false}
              />
            ) : (
              <video
                ref={mediaRef as any}
                src={fileUrl}
                className="absolute left-1/2 top-1/2 will-change-transform"
                style={{ transform: "translate(-50%, -50%) translate(0px, 0px) scale(1)", transformOrigin: "center" }}
                controls
              />
            )}
          </div>
        </AspectRatio>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-1">
        <div>
          <Label className="text-xs text-muted-foreground">Zoom</Label>
          <Slider value={[scale]} min={1} max={4} step={0.01} onValueChange={(v) => setScale(v[0] ?? 1)} />
        </div>
        <Button variant="outline" onClick={resetView}>Reset</Button>
        <Button onClick={doConfirm}>Apply</Button>
      </div>
      <p className="text-[11px] text-muted-foreground px-1">Tip: drag to pan, scroll to zoom.</p>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>Back</Button>
      </div>
    </div>
  );
}

function ReelAutoFitPreview({ fileUrl, mediaType }: { fileUrl: string; mediaType: "image" | "video" }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md overflow-hidden border border-border bg-black">
        <AspectRatio ratio={9 / 16}>
          <div className="relative w-full h-full bg-black">
            {mediaType === "image" ? (
              <img src={fileUrl} alt="Reel preview" className="absolute inset-0 w-full h-full object-contain bg-black" />
            ) : (
              <video src={fileUrl} className="absolute inset-0 w-full h-full object-contain bg-black" controls />
            )}
          </div>
        </AspectRatio>
      </div>
      <p className="text-xs text-muted-foreground">Content is automatically fitted into a 9:16 frame with black bars as needed.</p>
    </div>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 | 4 }) {
  const items = ["Type", "Adjust", "Details", "Review"] as const;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {items.map((label, idx) => {
        const i = (idx + 1) as 1 | 2 | 3 | 4;
        const active = i <= step;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] ${active ? "bg-accent text-accent-foreground" : "bg-muted"}`}>{idx + 1}</div>
            <span className={`${active ? "text-foreground" : ""} hidden sm:inline`}>{label}</span>
            {idx < items.length - 1 && <div className={`w-8 h-px ${active && i !== step ? "bg-accent" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function FileDropZone({ onSelect }: { onSelect: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onSelect(f); }}
      className={`group relative rounded-lg border ${dragOver ? "border-accent bg-accent/10" : "border-dashed border-border"} p-6 cursor-pointer transition-colors`}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-12 h-12 rounded-full bg-muted grid place-items-center">
          <Upload className="w-6 h-6 text-foreground" />
        </div>
        <div className="text-sm font-medium">Click to upload</div>
        <div className="text-xs text-muted-foreground">or drag and drop an image or video</div>
      </div>
      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f); }} />
    </div>
  );
}

export default function CreatePostDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [postType, setPostType] = useState<PostType>("normal");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [category, setCategory] = useState<string>("other");
  const [isCreating, setIsCreating] = useState(false);

  const { accessToken } = useAuth();
  const { toast } = useToast();

  const DRAFT_KEY = "createPost.draft.v1";

  // Restore draft from localStorage so transient remounts don't lose user input
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.category) setCategory(parsed.category);
      if (parsed.postType) setPostType(parsed.postType as PostType);
      if (parsed.step) setStep(parsed.step as 1 | 2 | 3 | 4);
      if (parsed.previewUrl) setPreviewUrl(parsed.previewUrl);
    } catch (e) {
      // ignore
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft on changes
  useEffect(() => {
    try {
      const draft = { title, description, category, postType, step, previewUrl };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      // ignore
    }
  }, [title, description, category, postType, step, previewUrl]);

  useEffect(() => {
    if (!file) {
      setFileUrl("");
      setMediaType(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    const type = file.type.startsWith("video/") ? "video" : "image";
    setMediaType(type);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setStep(1);
    setPostType("normal");
    setFile(null);
    setFileUrl("");
    setMediaType(null);
    setTitle("");
    setDescription("");
    setPreviewUrl("");
    setCategory("other");
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      // ignore
    }
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      reset();
    }
  };

  const canContinueStep2 = Boolean(file && mediaType);

  const trigger = children ? (
    children
  ) : (
    <Button className="w-full justify-center" variant="default">
      <Upload className="w-4 h-4 mr-2" /> Create Post
    </Button>
  );

  const handleCreate = async () => {
    // Build FormData and submit
    try {
      setIsCreating(true);
      const form = new FormData();
      if (title) form.append("title", title);
      if (description) form.append("description", description);

      // contentType: prefer media type if present, otherwise text
      let contentType = "text";
      if (mediaType === "image") contentType = "image";
      else if (mediaType === "video") contentType = "video";
      form.append("contentType", contentType);

      // append category
      if (category) form.append("category", category);

      // isLowDopamine default false
      form.append("isLowDopamine", String(false));

      // Append media: prefer cropped preview if available (data URL), otherwise original file
      if (previewUrl && previewUrl.startsWith("data:")) {
        // convert data url to blob
        const res = await fetch(previewUrl);
        const blob = await res.blob();
        form.append("media", blob, `image.jpg`);
      } else if (file) {
        form.append("media", file, (file as File).name);
      }

      await createPost(form, accessToken ?? undefined, category);
      toast({ title: "Post created", description: "Your post was uploaded." });
      reset();
      setOpen(false);
    } catch (err: any) {
      console.error("Create post failed:", err);
      toast({ title: "Upload failed", description: err?.message || "Unable to create post.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Create Post</DialogTitle>
          <Steps step={step} />
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Choose post type</Label>
              <RadioGroup value={postType} onValueChange={(v) => setPostType(v as PostType)} className="grid grid-cols-2 gap-3">
                <div className={`border rounded-md p-3 flex items-center gap-2 ${postType === "normal" ? "border-accent" : "border-border"}`}>
                  <RadioGroupItem id="type-normal" value="normal" />
                  <Label htmlFor="type-normal" className="flex items-center gap-2 cursor-pointer">
                    <ImageIcon className="w-4 h-4" /> Normal Post
                  </Label>
                </div>
                <div className={`border rounded-md p-3 flex items-center gap-2 ${postType === "reel" ? "border-accent" : "border-border"}`}>
                  <RadioGroupItem id="type-reel" value="reel" />
                  <Label htmlFor="type-reel" className="flex items-center gap-2 cursor-pointer">
                    <PlaySquare className="w-4 h-4" /> Reel
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Upload image or video</Label>
              <FileDropZone onSelect={(f) => setFile(f)} />
            </div>

            {fileUrl && (
              <div className="rounded-xl overflow-hidden border border-border shadow-sm mx-auto" style={{ maxWidth: "min(100%, 65vh)" }}>
                <AspectRatio ratio={postType === "reel" ? 9 / 16 : 1}>
                  <div className="relative w-full h-full bg-black">
                    {mediaType === "image" ? (
                      <img src={fileUrl} alt="Preview" className={`absolute inset-0 w-full h-full ${postType === "reel" ? "object-contain" : "object-cover"}`} />
                    ) : (
                      <video src={fileUrl} className={`absolute inset-0 w-full h-full ${postType === "reel" ? "object-contain" : "object-cover"}`} controls />
                    )}
                  </div>
                </AspectRatio>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!canContinueStep2} onClick={() => setStep(2)}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && mediaType && fileUrl && (
          <div className="space-y-4">
            {postType === "normal" ? (
              <PanZoomCropper
                fileUrl={fileUrl}
                mediaType={mediaType}
                targetRatio={1}
                onCancel={() => setStep(1)}
                onConfirm={({ previewUrl }) => {
                  setPreviewUrl(previewUrl);
                  setStep(3);
                }}
              />
            ) : (
              <div className="space-y-3">
                <ReelAutoFitPreview fileUrl={fileUrl} mediaType={mediaType} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                  <Button onClick={() => {
                    setPreviewUrl(""); // we use original url for reel preview
                    setStep(3);
                  }}>Next</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden border border-border bg-black shadow-sm mx-auto" style={{ maxWidth: "min(100%, 70vh)" }}>
              <AspectRatio ratio={postType === "reel" ? 9 / 16 : 1}>
                <div className="relative w-full h-full bg-black">
                  {postType === "reel" ? (
                    mediaType === "video" ? (
                      <video src={fileUrl} className="absolute inset-0 w-full h-full object-contain bg-black" controls />
                    ) : (
                      <img src={fileUrl} alt="Reel" className="absolute inset-0 w-full h-full object-contain bg-black" />
                    )
                  ) : (
                    <img src={previewUrl || fileUrl} alt="Cropped" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </div>
              </AspectRatio>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a title" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Write a description" rows={4} />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="category">Category</Label>
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 rounded-md bg-background border border-border">
                  <option value="news">news</option>
                  <option value="memes">memes</option>
                  <option value="other">other</option>
                  <option value="tech">tech</option>
                  <option value="lifestyle">lifestyle</option>
                  <option value="entertainment">entertainment</option>
                  <option value="sports">sports</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
                <Button onClick={() => setStep(4)}>Continue</Button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden border border-border bg-black shadow-sm mx-auto" style={{ maxWidth: "min(100%, 70vh)" }}>
              <AspectRatio ratio={postType === "reel" ? 9 / 16 : 1}>
                <div className="relative w-full h-full bg-black">
                  {postType === "reel" ? (
                    mediaType === "video" ? (
                      <video src={fileUrl} className="absolute inset-0 w-full h-full object-contain bg-black" controls />
                    ) : (
                      <img src={fileUrl} alt="Reel" className="absolute inset-0 w-full h-full object-contain bg-black" />
                    )
                  ) : (
                    <img src={previewUrl || fileUrl} alt="Cropped" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </div>
              </AspectRatio>
            </div>
            <div className="grid gap-1">
              <Label>Title</Label>
              <div className="text-sm text-foreground break-words">{title || "(No title)"}</div>
            </div>
            <div className="grid gap-1">
              <Label>Description</Label>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{description || "(No description)"}</div>
            </div>
            <div className="grid gap-1">
              <Label>Category</Label>
              <div className="text-sm text-foreground break-words">{category}</div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? "Uploading..." : "Done"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
