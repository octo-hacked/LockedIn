import { Link } from "react-router-dom";
import { Bell, ArrowLeft, CheckCircle2, MessageSquare, Heart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type NotificationItem = {
  id: number;
  type: "like" | "comment" | "system";
  title: string;
  message: string;
  time: string;
  read?: boolean;
};

const items: NotificationItem[] = [
  { id: 1, type: "system", title: "Welcome", message: "Thanks for joining!", time: "2m", read: false },
  { id: 2, type: "comment", title: "Sarah commented", message: "Loved your recent post!", time: "1h" },
  { id: 3, type: "like", title: "Alex liked", message: "Your photo was liked", time: "3h" },
  { id: 4, type: "system", title: "Update", message: "Your settings were saved", time: "1d", read: true },
];

const iconFor = (type: NotificationItem["type"]) => {
  switch (type) {
    case "like":
      return <Heart className="w-5 h-5 text-accent" />;
    case "comment":
      return <MessageSquare className="w-5 h-5 text-primary" />;
    default:
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
  }
};

export default function Notifications() {
  return (
    <div className="flex h-screen bg-background">
      <div className="w-full md:max-w-2xl mx-auto bg-card border-x md:border border-border flex flex-col">
        <div className="p-4 border-b border-border bg-card sticky top-0 z-10 flex items-center gap-3">
          <Link to="/" className="p-1 hover:bg-hover-bg rounded transition-colors md:hidden" aria-label="Back home">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-icon-color" />
            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          </div>
        </div>

        <ScrollArea className="flex-1 inbox-scroll">
          <div className="divide-y divide-border pb-16 md:pb-0">
            {items.map((n) => (
              <div key={n.id} className={`flex items-start gap-3 p-4 ${n.read ? "bg-card" : "bg-secondary"}`}>
                <div className="mt-0.5">{iconFor(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{n.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
