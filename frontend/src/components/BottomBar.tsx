import { Home, MessageCircle, Bell, BookOpen, Sliders, LogOut, Upload } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Drawer } from "vaul";
import type { Category } from "@/components/MainFeed";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import CreatePostDialog from "@/components/CreatePostDialog";

type BottomBarProps = {
  monochrome: boolean;
  onToggleMonochrome: (checked: boolean) => void;
  selectedCategories: Category[];
  onToggleCategory: (category: Category) => void;
  onSelectAllCategories: () => void;
  lowDopamineOnly: boolean;
  onToggleLowDopamine: (checked: boolean) => void;
};

const contentFilters: { key: Category; label: string }[] = [
  { key: "memes", label: "Memes" },
  { key: "news", label: "News" },
  { key: "other", label: "Other" },
];

const BottomBar = ({ monochrome, onToggleMonochrome, selectedCategories, onToggleCategory, onSelectAllCategories, lowDopamineOnly, onToggleLowDopamine }: BottomBarProps) => {
  const location = useLocation();
  const { signOut, loading } = useAuth();

  const NavLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link to={to} className={`flex flex-col items-center justify-center flex-1 py-2 ${location.pathname === to ? "text-accent" : "text-foreground"}`}>
      <Icon className="w-6 h-6" />
      <span className="text-[10px] mt-0.5">{label}</span>
    </Link>
  );

  return (
    <div className="md:hidden">
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
        <div className="flex items-center">
          <NavLink to="/" icon={Home} label="Home" />
          <NavLink to="/capsules" icon={BookOpen} label="Capsules" />
          <NavLink to="/messages" icon={MessageCircle} label="Messages" />
          <NavLink to="/notifications" icon={Bell} label="Alerts" />

          {/* Create Post quick action */}
          <CreatePostDialog>
            <button className="flex flex-col items-center justify-center flex-1 py-2">
              <Upload className="w-6 h-6" />
              <span className="text-[10px] mt-0.5">Create</span>
            </button>
          </CreatePostDialog>

          <Drawer.Root>
            <Drawer.Trigger className="flex flex-col items-center justify-center flex-1 py-2">
              <Sliders className="w-6 h-6" />
              <span className="text-[10px] mt-0.5">Settings</span>
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />
              <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-card">
                <Drawer.Title className="sr-only">Settings</Drawer.Title>
                <div className="p-4">
                  <div className="mx-auto h-1 w-12 rounded-full bg-muted mb-4" />
                  <h3 className="text-base font-semibold mb-3 text-foreground">Settings</h3>
                  <div className="space-y-4">
                    <button onClick={() => signOut()} disabled={loading} className="w-full flex items-center gap-2 px-3 py-2 rounded bg-input text-foreground disabled:opacity-60">
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Log out</span>
                    </button>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Content Filter</span>
                        <button onClick={onSelectAllCategories} className="text-xs text-accent hover:underline">All</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {contentFilters.map((filter) => {
                          const active = selectedCategories.includes(filter.key);
                          return (
                            <button
                              key={filter.key}
                              onClick={() => onToggleCategory(filter.key)}
                              className={`text-xs px-2 py-1 rounded ${active ? "bg-hover-bg text-foreground" : "text-muted-foreground bg-input"}`}
                            >
                              {filter.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Low Dopamine</span>
                      <Switch checked={lowDopamineOnly} onCheckedChange={onToggleLowDopamine} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Monochrome</span>
                      <Switch checked={monochrome} onCheckedChange={onToggleMonochrome} />
                    </div>
                  </div>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </div>
      </div>
      <div className="h-14" />
    </div>
  );
};

export default BottomBar;
