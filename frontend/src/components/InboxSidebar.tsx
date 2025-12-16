import { Send, ArrowLeft, Phone, Video, Smile, Paperclip } from "lucide-react";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { formatDistanceToNow } from "date-fns";
import { formatDateTime, formatDateRelative } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { FeedPost } from "@/components/MainFeed";

const avatarFor = (seed: string) => `https://i.pravatar.cc/100?u=${encodeURIComponent(seed)}`;

type InboxSidebarProps = {
  postPreview?: FeedPost | null;
  onBackFromPost?: () => void;
  postToShare?: FeedPost | null;
  onBackFromShare?: () => void;
};

const InboxSidebar = ({ postPreview, onBackFromPost, postToShare, onBackFromShare }: InboxSidebarProps) => {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const { toast } = useToast();
  const { user, accessToken } = useAuth();

  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const { chats, messages, fetchChats, fetchMessages, sendMessage, setActiveChat, onlineUsers, initializeSocket, loading: chatsLoading } = useChat();

  useEffect(() => {
    if (accessToken && user) {
      try { initializeSocket?.(accessToken); } catch (e) { /* ignore */ }
      fetchChats().catch((e) => console.error('fetchChats failed', e));
    }
  }, [accessToken, user, fetchChats, initializeSocket]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!postPreview) return;
      setLoadingComments(true);
      try {
        const commentsApi = await import("@/lib/comments");
        const res = await commentsApi.getComments({ postId: postPreview.remoteId ?? postPreview.id, limit: 50, includeReplies: false, token: accessToken });
        const parseArray = (v: any) => {
          if (Array.isArray(v)) return v;
          if (!v) return [];
          if (Array.isArray(v.comments)) return v.comments;
          if (Array.isArray(v.items)) return v.items;
          if (Array.isArray(v.data)) return v.data;
          if (Array.isArray(v.data?.comments)) return v.data.comments;
          if (Array.isArray(v.data?.items)) return v.data.items;
          return [];
        };
        const items = parseArray(res);
        if (!mounted) return;
        const normalize = (c: any) => ({
          id: c._id ?? c.id,
          body: c.body ?? c.text ?? c.content ?? "",
          user: {
            username: c.commentBy?.username || c.user?.username || c.user || "unknown",
            avatar: c.commentBy?.avatar || c.user?.avatar || avatarFor(c.commentBy?.username || c.user?.username || "user"),
            fullname: c.commentBy?.fullname || c.user?.fullname || undefined,
            email: c.commentBy?.email || c.user?.email || undefined,
          },
          parentId: c.parentComment ?? c.parent ?? null,
          likes: c.likesCount ?? c.likes ?? 0,
          liked: Boolean(c.isLikedByUser ?? c.isLiked ?? false),
          replyCount: c.replyCount ?? c.repliesCount ?? 0,
          timeAgo: c.timeAgo ?? (c.createdAt ? formatDateRelative(c.createdAt) : ""),
          raw: c,
        });
        setCommentsList(items.map(normalize));
      } catch (err) {
        console.error("Failed to load comments:", err);
        toast({ title: "Comments", description: "Could not load comments.", variant: "destructive" });
      } finally {
        if (mounted) setLoadingComments(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [postPreview, accessToken, toast]);

  const handleAddComment = async () => {
    if (postingComment) return;
    if (!newMessage.trim() || !postPreview) return;
    const body = newMessage.trim();
    setPostingComment(true);
    try {
      const commentsApi = await import("@/lib/comments");
      const res = await commentsApi.postComment(postPreview.remoteId ?? postPreview.id, body, undefined, accessToken);
      // Normalize created item
      const createdRaw = res?.comment || res?.data || res;
      const created = createdRaw?.comment || createdRaw?.data || createdRaw;
      if (!created) {
        console.warn('Unexpected comment create response:', res);
        throw new Error('Invalid response from server');
      }
      const normalize = (c: any) => ({
        id: c._id ?? c.id,
        body: c.body ?? c.text ?? c.content ?? "",
        user: {
          username: c.commentBy?.username || c.user?.username || c.user || "unknown",
          avatar: c.commentBy?.avatar || c.user?.avatar || avatarFor(c.commentBy?.username || c.user?.username || "user"),
        },
        parentId: c.parentComment ?? c.parent ?? null,
        likes: c.likesCount ?? c.likes ?? 0,
        liked: Boolean(c.isLikedByUser ?? c.isLiked ?? false),
        replyCount: c.replyCount ?? c.repliesCount ?? 0,
        timeAgo: c.timeAgo ?? (c.createdAt ? formatDateRelative(c.createdAt) : ""),
        raw: c,
      });
      setCommentsList((prev) => [normalize(created), ...prev]);
      setNewMessage("");
    } catch (err) {
      console.error("Failed to post comment:", err);
      toast({ title: "Comment Failed", description: "Could not post comment.", variant: "destructive" });
    } finally {
      setPostingComment(false);
    }
  };

  const conversations = chats.map((c, i) => ({
    id: c._id ?? `chat-${i}`,
    name: c.isGroupChat ? c.name : (c.participants.find(p => p._id !== (c.admin || ''))?.username || 'Unknown'),
    avatar: c.participants[0]?.avatar || avatarFor(c.name || 'chat'),
    lastMessage: c.lastMessage?.content || '',
    time: c.updatedAt ? formatDateRelative(c.updatedAt) : '',
    unread: false,
    online: c.participants.some(p => onlineUsers.has(p._id)),
  }));

  if (postPreview) {

    return (
      <div className="w-80 h-screen bg-card border-l border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-2">
          <button onClick={onBackFromPost} className="p-1 hover:bg-hover-bg rounded transition-colors" aria-label="Back to inbox">
            <ArrowLeft className="w-5 h-5 text-icon-color" />
          </button>
          <h2 className="text-lg font-semibold text-foreground">Post</h2>
        </div>

        {/* Post Preview */}
        <ScrollArea className="flex-1 inbox-scroll">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              {postPreview.uploaderId ? (
                <Link to={`/profile/${encodeURIComponent(String(postPreview.uploaderId))}`} className="flex items-center">
                  <img src={postPreview.avatar} alt={`${postPreview.username} avatar`} className="w-8 h-8 rounded-full object-cover" />
                </Link>
              ) : (
                <Link to="/profile" className="flex items-center">
                  <img src={postPreview.avatar} alt={`${postPreview.username} avatar`} className="w-8 h-8 rounded-full object-cover" />
                </Link>
              )}
              <div>
                <div className="text-sm font-medium text-foreground">
                  {postPreview.uploaderId ? (
                    <Link to={`/profile/${encodeURIComponent(String(postPreview.uploaderId))}`}>{postPreview.username}</Link>
                  ) : (
                    <Link to="/profile">{postPreview.username}</Link>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{postPreview.time}</div>
              </div>
            </div>
            <div className="w-full overflow-hidden rounded-md bg-post-bg">
              <img src={postPreview.image} alt="Post" className="w-full h-48 object-cover" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{postPreview.content}</p>
            <div className="h-px w-full bg-border" />
            <div className="space-y-3">
              {loadingComments ? (
                <div className="text-sm text-muted-foreground">Loading comments...</div>
              ) : commentsList.length === 0 ? (
                <div className="text-sm text-muted-foreground">No comments yet</div>
              ) : (
                commentsList.map((c: any, idx: number) => (
                  <div key={c.id ?? `comment-${idx}`} className="flex items-start gap-3">
                    {c.raw?.commentBy?._id ? (
                      <Link to={`/profile/${encodeURIComponent(String(c.raw.commentBy._id))}`}>
                        <img src={c.user?.avatar || avatarFor(c.user?.username || c.user || 'user')} alt={c.user?.username || c.user} className="w-7 h-7 rounded-full object-cover" />
                      </Link>
                    ) : (
                      <img src={c.user?.avatar || avatarFor(c.user?.username || c.user || 'user')} alt={c.user?.username || c.user} className="w-7 h-7 rounded-full object-cover" />
                    )}
                    <div>
                      <div className="text-sm text-foreground"><span className="font-medium">{c.user?.username ? (c.raw?.commentBy?._id ? <Link to={`/profile/${encodeURIComponent(String(c.raw.commentBy._id))}`}>{c.user.username}</Link> : c.user.username) : (c.user || '')}</span> {c.body || c.text || c.content}</div>
                      <div className="text-[10px] text-muted-foreground">{c.timeAgo || c.createdAt}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              className="flex-1 bg-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={() => handleAddComment()}
              className="p-2 bg-primary text-primary-foreground rounded-lg active:scale-[0.98]"
              aria-label="Send comment"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default inbox UI

  // use real chat messages from ChatContext
  const currentChat = chats.find(c => c._id === selectedChat);
  const currentMessages = selectedChat ? (messages[selectedChat] || []) : [];

  const getChatDisplayName = (chat: any) => {
    if (!chat) return "";
    if (chat.isGroupChat) return chat.name;
    const other = chat.participants?.find((p: any) => p._id !== (chat.admin || ''));
    return other?.username || other?.fullname || 'Unknown User';
  };

  const getChatAvatar = (chat: any) => {
    if (!chat) return avatarFor('user');
    if (chat.isGroupChat) return avatarFor(chat.name || 'group');
    const other = chat.participants?.find((p: any) => p._id !== (chat.admin || ''));
    return other?.avatar || avatarFor(other?.username || other?._id || 'user');
  };

  const getChatLastSeen = (chat: any) => {
    if (!chat) return '';
    const time = chat.lastMessage?.createdAt || chat.updatedAt;
    if (!time) return '';
    try { return formatDistanceToNow(new Date(time), { addSuffix: true }); } catch { return ''; }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !newMessage.trim()) return;
    try {
      await sendMessage(selectedChat, newMessage.trim());
      setNewMessage("");
    } catch (err) {
      console.error('Failed to send message:', err);
      toast({ title: 'Send failed', description: 'Could not send message', variant: 'destructive' });
    }
  };


  if (postToShare) {
    const toggleRecipient = (id: string) => {
      setSelectedRecipients((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const handleShare = () => {
      if (selectedRecipients.length === 0) return;
      const names = conversations.filter((c) => selectedRecipients.includes(c.id)).map((c) => c.name);
      toast({ title: "Shared", description: `Shared with ${names.join(", ")}` });
      setSelectedRecipients([]);
      onBackFromShare?.();
    };

    return (
      <div className="w-80 h-screen bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <button onClick={onBackFromShare} className="p-1 hover:bg-hover-bg rounded transition-colors" aria-label="Back to inbox">
            <ArrowLeft className="w-5 h-5 text-icon-color" />
          </button>
          <h2 className="text-lg font-semibold text-foreground">Share</h2>
        </div>

        <ScrollArea className="flex-1 inbox-scroll">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              {postToShare.uploaderId ? (
                <Link to={`/profile/${encodeURIComponent(String(postToShare.uploaderId))}`} className="flex items-center">
                  <img src={postToShare.avatar} alt={`${postToShare.username} avatar`} className="w-8 h-8 rounded-full object-cover" />
                </Link>
              ) : (
                <Link to="/profile" className="flex items-center">
                  <img src={postToShare.avatar} alt={`${postToShare.username} avatar`} className="w-8 h-8 rounded-full object-cover" />
                </Link>
              )}
              <div>
                <div className="text-sm font-medium text-foreground">{postToShare.uploaderId ? (
                  <Link to={`/profile/${encodeURIComponent(String(postToShare.uploaderId))}`}>{postToShare.username}</Link>
                ) : (
                  <Link to="/profile">{postToShare.username}</Link>
                )}</div>
                <div className="text-xs text-muted-foreground">{postToShare.time}</div>
              </div>
            </div>
            <div className="w-full overflow-hidden rounded-md bg-post-bg">
              <img src={postToShare.image} alt="Post" className="w-full h-36 object-cover" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{postToShare.content}</p>
            <div className="h-px w-full bg-border" />

            <div className="space-y-3">
              <div className="text-xs font-medium text-foreground">Select recipients</div>
              {conversations.map((c, idx) => (
                <label key={c.id ?? `conv-${idx}`} className="flex items-center gap-3 p-2 rounded hover:bg-hover-bg cursor-pointer">
                  <div className="relative">
                    <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                    {c.online && (
                      <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-foreground">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground">{c.lastMessage}</div>
                  </div>
                  <Checkbox
                    checked={selectedRecipients.includes(c.id)}
                    onCheckedChange={() => toggleRecipient(c.id)}
                    aria-label={`Select ${c.name}`}
                  />
                </label>
              ))}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleShare}
            disabled={selectedRecipients.length === 0}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2 px-4 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Share
          </button>
        </div>
      </div>
    );
  }

  if (selectedChat) {
    return (
      <div className="w-80 h-screen bg-card border-l border-border flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedChat(null)}
              className="p-1 hover:bg-hover-bg rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-icon-color" />
            </button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <img src={getChatAvatar(currentChat)} alt={getChatDisplayName(currentChat)} className="w-8 h-8 rounded-full object-cover" />
                {currentChat && currentChat.participants && currentChat.participants.some((p: any) => onlineUsers.has(p._id)) && (
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white rounded-full"></div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">{getChatDisplayName(currentChat)}</h3>
                <p className="text-xs text-muted-foreground">{getChatLastSeen(currentChat) || ''}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button className="p-1 hover:bg-hover-bg rounded transition-colors">
                <Phone className="w-4 h-4 text-icon-color" />
              </button>
              <button className="p-1 hover:bg-hover-bg rounded transition-colors">
                <Video className="w-4 h-4 text-icon-color" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 inbox-scroll">
          <div className="p-3 space-y-3">
            {currentMessages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              currentMessages.map((message: any, idx: number) => {
                const isOwn = message.sender?._id === undefined ? (message.sender === 'me') : (message.sender._id === user?.id);
                return (
                  <div
                    key={message._id ?? message.id ?? `msg-${idx}`}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] md:max-w-xs rounded-lg p-3 ${
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}>
                      {!isOwn && currentChat?.isGroupChat && (
                        <p className="text-xs font-medium mb-1 opacity-75">
                          {message.sender?._id ? (
                            <Link to={`/profile/${encodeURIComponent(String(message.sender._id))}`}>{message.sender.username}</Link>
                          ) : (
                            message.sender?.username
                          )}
                        </p>
                      )}
                      <p className="text-sm">{message.content ?? message.text ?? ''}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {message.createdAt ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true }) : (message.time || '')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-hover-bg rounded transition-colors">
              <Paperclip className="w-4 h-4 text-icon-color" />
            </button>
            <div className="flex-1 flex items-center gap-1 bg-input rounded-lg px-2 py-1">
              <input
                type="text"
                placeholder="Type..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button className="p-1 hover:bg-hover-bg rounded transition-colors">
                <Smile className="w-3 h-3 text-icon-color" />
              </button>
            </div>
            <button 
              onClick={handleSendMessage}
              className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-screen bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5 text-icon-color" />
          <h2 className="text-lg font-semibold text-foreground">Inbox</h2>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 inbox-scroll">
        {conversations.map((conversation, idx) => (
          <div
            key={conversation.id ?? `conv-${idx}`}
            onClick={() => {
              setSelectedChat(conversation.id);
              const chatObj = chats.find(ch => ch._id === conversation.id);
              if (chatObj) {
                setActiveChat(chatObj);
                fetchMessages(conversation.id as string).catch((e) => console.error('fetchMessages failed', e));
              }
            }}
            className="p-4 border-b border-border hover:bg-hover-bg cursor-pointer transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="relative">
                <img src={conversation.avatar} alt={conversation.name} className="w-12 h-12 rounded-full object-cover" />
                {conversation.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
                {conversation.unread && (
                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-accent rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-sm ${conversation.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                    {conversation.name}
                  </h3>
                  <span className="text-xs text-muted-foreground">{conversation.time}</span>
                </div>
                <p className={`text-sm truncate ${conversation.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {conversation.lastMessage}
                </p>
              </div>
            </div>
          </div>
        ))}
      </ScrollArea>

      {/* Compose Button */}
      <div className="p-4 border-t border-border">
        <button className="w-full bg-primary text-primary-foreground rounded-lg py-2 px-4 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          New Message
        </button>
      </div>
    </div>
  );
};

export default InboxSidebar;
