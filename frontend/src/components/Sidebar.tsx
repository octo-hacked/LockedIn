import { Home, MessageCircle, Bell, BookOpen, Settings, User, Filter, Sliders, LogOut, Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Category } from "@/components/MainFeed";
import { useAuth } from "@/context/AuthContext";
import CreatePostDialog from "@/components/CreatePostDialog";

type SidebarProps = {
  monochrome: boolean;
  onToggleMonochrome: (checked: boolean) => void;
  selectedCategories: Category[];
  onToggleCategory: (category: Category) => void;
  onSelectAllCategories: () => void;
  lowDopamineOnly: boolean;
  onToggleLowDopamine: (checked: boolean) => void;
};

const Sidebar = ({ monochrome, onToggleMonochrome, selectedCategories, onToggleCategory, onSelectAllCategories, lowDopamineOnly, onToggleLowDopamine }: SidebarProps) => {
  const location = useLocation();
  const { signOut, loading } = useAuth();
  
  const navigationItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: MessageCircle, label: "Messages", path: "/messages" },
    { icon: Bell, label: "Notifications", path: "/notifications" },
    { icon: BookOpen, label: "Capsules", path: "/capsules" },
  ];

  const contentFilters: { key: Category; label: string }[] = [
    { key: "memes", label: "Memes" },
    { key: "news", label: "News" },
    { key: "other", label: "Other" },
  ];

  return (
    <div className="hidden md:flex h-screen bg-sidebar-bg border-r border-border p-4 flex-col md:w-16 lg:w-64 transition-[width]">
      {/* Logo */}
      <div className="mb-8 flex items-center justify-center lg:justify-start">
        <h1 className="text-xl font-semibold text-foreground hidden lg:block">LockedIn</h1>
        <div className="w-6 h-6 rounded bg-accent lg:hidden" aria-hidden="true"></div>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 mb-8">
        {navigationItems.map((item) => (
          <Link
            key={item.label}
            to={item.path}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              location.pathname === item.path
                ? "text-accent font-medium"
                : "text-foreground hover:bg-hover-bg"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="hidden lg:inline">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Content Filter (full) */}
      <div className="mb-6 hidden lg:block">
        <div className="flex items-center justify-between mb-4">
          <span className="text-foreground font-medium">Content Filter</span>
          <button
            onClick={onSelectAllCategories}
            className="text-xs text-accent hover:underline"
          >
            All
          </button>
        </div>
        <div className="space-y-2">
          {contentFilters.map((filter) => {
            const active = selectedCategories.includes(filter.key);
            return (
              <button
                key={filter.key}
                onClick={() => onToggleCategory(filter.key)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded ${active ? "bg-hover-bg text-foreground" : "text-muted-foreground hover:bg-hover-bg"}`}
              >
                <div className={`w-3 h-3 rounded-full ${active ? "bg-accent" : "bg-muted"}`}></div>
                <span className="text-sm">{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsed controls (md-only) */}
      <div className="mb-6 lg:hidden">
        <div className="flex flex-col items-center gap-3">
          <Popover>
            <PopoverTrigger className="w-full">
              <div className="w-full flex items-center justify-center md:justify-center lg:justify-start gap-3 px-3 py-2 rounded-lg hover:bg-hover-bg text-foreground">
                <Filter className="w-5 h-5" />
                <span className="hidden lg:inline">Filters</span>
              </div>
            </PopoverTrigger>
            <PopoverContent side="right" align="start">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Content Filter</span>
                <button onClick={onSelectAllCategories} className="text-xs text-accent hover:underline">All</button>
              </div>
              <div className="space-y-2">
                {contentFilters.map((filter) => {
                  const active = selectedCategories.includes(filter.key);
                  return (
                    <button
                      key={filter.key}
                      onClick={() => onToggleCategory(filter.key)}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded ${active ? "bg-hover-bg text-foreground" : "text-muted-foreground hover:bg-hover-bg"}`}
                    >
                      <div className={`w-3 h-3 rounded-full ${active ? "bg-accent" : "bg-muted"}`}></div>
                      <span className="text-sm">{filter.label}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger className="w-full">
              <div className="w-full flex items-center justify-center md:justify-center lg:justify-start gap-3 px-3 py-2 rounded-lg hover:bg-hover-bg text-foreground">
                <Sliders className="w-5 h-5" />
                <span className="hidden lg:inline">Modes</span>
              </div>
            </PopoverTrigger>
            <PopoverContent side="right" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Low Dopamine</span>
                  <Switch checked={lowDopamineOnly} onCheckedChange={onToggleLowDopamine} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Monochrome</span>
                  <Switch checked={monochrome} onCheckedChange={onToggleMonochrome} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Additional Toggles (full) */}
      <div className="space-y-4 mb-auto hidden lg:block">
        <div className="flex items-center justify-between">
          <span className="text-foreground font-medium">Low Dopamine</span>
          <Switch checked={lowDopamineOnly} onCheckedChange={onToggleLowDopamine} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground font-medium">Monochrome</span>
          <Switch checked={monochrome} onCheckedChange={onToggleMonochrome} />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="space-y-2 mt-auto">
        <div className="w-full">
          <CreatePostDialog>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-foreground hover:bg-hover-bg transition-colors">
              <Upload className="w-5 h-5" />
              <span className="hidden lg:inline">Create Post</span>
            </button>
          </CreatePostDialog>
        </div>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-foreground hover:bg-hover-bg transition-colors">
          <Settings className="w-5 h-5" />
          <span className="hidden lg:inline">Settings</span>
        </button>
        <Link to="/profile" className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${location.pathname === "/profile" ? "text-accent font-medium" : "text-foreground hover:bg-hover-bg"}`}>
          <User className="w-5 h-5" />
          <span className="hidden lg:inline">Profile</span>
        </Link>
        <button onClick={() => signOut()} disabled={loading} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-foreground hover:bg-hover-bg transition-colors disabled:opacity-60">
          <LogOut className="w-5 h-5" />
          <span className="hidden lg:inline">Log out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
