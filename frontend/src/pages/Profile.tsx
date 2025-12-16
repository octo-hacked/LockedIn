import { useMemo, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import BottomBar from "@/components/BottomBar";
import { useAuth } from "@/context/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useParams, Link, useNavigate } from "react-router-dom";
import { API_BASE } from "@/lib/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const avatarFor = (seed: string) => `https://i.pravatar.cc/200?u=${encodeURIComponent(seed)}`;
const coverFor = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/300`;
const postImageFor = (seed: string | number) => `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/600/600`;

export default function Profile() {
  const { user, accessToken } = useAuth();
  const { userId } = useParams<{ userId?: string }>();

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const viewedUserId = userId ?? user?.id;

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!viewedUserId) return;
      setLoading(true);
      try {
        const headers: any = {};
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const uRes = await fetch(`${API_BASE}/users/${encodeURIComponent(String(viewedUserId))}`, { headers, credentials: 'include' });
        const uJson = await uRes.json();
        if (!mounted) return;
        const userData = uJson?.data || uJson;
        setProfile(userData);

        const pRes = await fetch(`${API_BASE}/posts/user/${encodeURIComponent(String(viewedUserId))}?page=1&limit=50`, { headers, credentials: 'include' });
        const pJson = await pRes.json();
        const items = pJson?.data?.posts || pJson?.posts || pJson?.data || pJson || [];
        if (!mounted) return;
        setPosts(Array.isArray(items) ? items : []);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [viewedUserId, accessToken]);

  const display = useMemo(() => {
    if (!profile) return null;
    const name = profile.fullname || profile.name || profile.username || 'User';
    const username = profile.username || profile._id || profile.id || 'user';
    return {
      id: profile._id ?? profile.id ?? username,
      name,
      username,
      email: profile.email,
      avatar: profile.avatar || avatarFor(username),
      cover: profile.coverImage || coverFor(username),
      bio: profile.bio || profile.about || profile.description || '',
      stats: {
        posts: Array.isArray(posts) ? posts.length : (profile.postsCount ?? 0),
        followers: profile.followersCount ?? profile.followers ?? 0,
        following: profile.followingCount ?? profile.following ?? 0,
      },
    };
  }, [profile, posts]);

  const allCats = ["memes", "news", "other"] as const;

  const navigate = useNavigate();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [displayStats, setDisplayStats] = useState(display?.stats ?? { posts: 0, followers: 0, following: 0 });

  useEffect(() => {
    if (!display) return;
    setIsFollowing(Boolean(profile?.isFollowing ?? false));
    setDisplayStats(display.stats);
  }, [display, profile]);

  if (loading) {
    return <div className="flex items-center justify-center h-40">Loading...</div>;
  }

  if (!display) {
    return <div className="flex min-h-screen bg-background"><div className="m-6">No profile found.</div></div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar
          monochrome={false}
          onToggleMonochrome={() => {}}
          selectedCategories={[...allCats] as any}
          onToggleCategory={() => {}}
          onSelectAllCategories={() => {}}
          lowDopamineOnly={false}
          onToggleLowDopamine={() => {}}
        />
      </div>

      <main className="flex-1 h-screen overflow-hidden">
        <ScrollArea className="h-full">
          <div className="min-h-full pb-24">
            <div className="w-full h-40 md:h-48 bg-muted relative">
              <img src={display.cover} alt="Cover" className="w-full h-full object-cover" />
              <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2">
                <img
                  src={display.avatar}
                  alt={display.name}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full ring-4 ring-background object-cover"
                />
                <div className="text-center">
                  <div className="text-lg md:text-2xl font-semibold text-foreground leading-tight">{display.name}</div>
                  <div className="text-sm text-muted-foreground">@{display.username}</div>
                </div>
              </div>
            </div>"

            <div className="px-4 md:px-6 mt-6">
              <div className="flex flex-col items-center gap-4">
                <div className="text-sm text-muted-foreground text-center max-w-prose">{display.bio}</div>

                <div className="flex items-center gap-4">
                  {display.id === (user?.id ?? user?._id) ? (
                    <Link to="/profile/edit"><Button>Edit Profile</Button></Link>
                  ) : (
                    <>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline">Connect</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Connect with {display.name}</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">Choose how you'd like to reach out.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 mt-2">
                            <Button onClick={() => { navigate(`/messages?user=${encodeURIComponent(String(display.id))}`); }}>
                              Message
                            </Button>
                            {display.email ? (
                              <a href={`mailto:${display.email}`} className="w-full">
                                <Button variant="outline" className="w-full">Email</Button>
                              </a>
                            ) : null}
                            <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast({ title: "Link copied", description: "Profile link copied to clipboard." }); }}>
                              Copy Profile Link
                            </Button>
                          </div>
                          <DialogFooter>
                            <Button variant="outline">Close</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <div className="text-center">
                        <div className="text-lg md:text-2xl font-semibold text-foreground">{display.name}</div>
                        <div className="text-sm text-muted-foreground">@{display.username}</div>
                      </div>

                      <Button onClick={() => {
                        setIsFollowing((v) => {
                          const next = !v;
                          setDisplayStats((s) => ({ ...s, followers: s.followers + (next ? 1 : -1) }));
                          toast({ title: next ? "Followed" : "Unfollowed", description: next ? `You're now following ${display.name}` : `You unfollowed ${display.name}` });
                          return next;
                        });
                      }}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-6 mt-2 text-sm">
                  <div><span className="font-semibold text-foreground">{displayStats.posts}</span> posts</div>
                  <div><span className="font-semibold text-foreground">{displayStats.followers}</span> followers</div>
                  <div><span className="font-semibold text-foreground">{displayStats.following}</span> following</div>
                </div>

                <div className="text-sm text-muted-foreground mt-2">{display.email}</div>
              </div>

              <div className="h-px w-full bg-border my-6" />

              <h2 className="text-base font-semibold mb-3">Posts</h2>

              {posts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No posts yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {posts.map((p: any) => (
                    <div key={p._id ?? p.id} className="bg-post-bg aspect-square overflow-hidden rounded md:rounded-md">
                      <img src={p.image || p.media || p.imageUrl || p.photo || p.src || p.url || '/placeholder.svg'} alt={p.title || 'Post image'} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </main>

      <BottomBar
        monochrome={false}
        onToggleMonochrome={() => {}}
        selectedCategories={[...allCats] as any}
        onToggleCategory={() => {}}
        onSelectAllCategories={() => {}}
        lowDopamineOnly={false}
        onToggleLowDopamine={() => {}}
      />
    </div>
  );
}
