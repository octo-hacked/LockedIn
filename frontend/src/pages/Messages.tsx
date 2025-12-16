// ==================== UPDATED MESSAGES COMPONENT ====================

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Paperclip, Smile, Phone, Video, MoreVertical, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import BottomBar from "@/components/BottomBar";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Category } from "@/components/MainFeed";
import { useChat } from "../context/ChatContext"; // You'll need to create this
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/config";
import { formatDistanceToNow } from "date-fns";

const avatarFor = (seed: string) => `https://i.pravatar.cc/100?u=${encodeURIComponent(seed)}`;

const Messages = () => {
  const isMobile = useIsMobile();

  // Mobile-friendly defaults and BottomBar state
  const [monochrome, setMonochrome] = useState(false);
  const allCategories: Category[] = ["memes", "news", "other"];
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(allCategories);
  const [lowDopamineOnly, setLowDopamineOnly] = useState(false);

  // Chat state
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user, accessToken } = useAuth();

  // Create Chat dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState("direct");
  const [directUserId, setDirectUserId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupParticipants, setGroupParticipants] = useState("");

  // User search & suggestions state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);


  // Get chat context
  const {
    chats,
    messages,
    activeChat,
    setActiveChat,
    sendMessage,
    fetchChats,
    initializeSocket,
    startTyping,
    stopTyping,
    loading,
    onlineUsers,
    typingUsers,
    createDirectChat,
    createGroupChat,
  } = useChat();

  // Initialize chat system
  useEffect(() => {
    if (accessToken && user) {
      initializeSocket(accessToken);
      fetchChats();
    }
  }, [user, accessToken, initializeSocket, fetchChats]);

  // Helper functions
  const getChatDisplayName = (chat: any) => {
    if (chat.isGroupChat) {
      return chat.name;
    }
    const otherParticipant = chat.participants.find((p: any) => p._id !== user?.id);
    return otherParticipant?.username || 'Unknown User';
  };

  const getChatAvatar = (chat: any) => {
    if (chat.isGroupChat) {
      return avatarFor(chat.name);
    }
    const otherParticipant = chat.participants.find((p: any) => p._id !== user?.id);
    return otherParticipant?.avatar || avatarFor(otherParticipant?.username || 'unknown');
  };

  const isUserOnline = (chat: any) => {
    if (chat.isGroupChat) return false;
    const otherParticipant = chat.participants.find((p: any) => p._id !== user?.id);
    return otherParticipant && onlineUsers.has(otherParticipant._id);
  };

  const getLastMessagePreview = (chat: any) => {
    if (!chat.lastMessage) return 'No messages yet';
    const content = chat.lastMessage.content;
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  };

  const getLastMessageTime = (chat: any) => {
    if (!chat.lastMessage) return '';
    return formatDistanceToNow(new Date(chat.lastMessage.createdAt), { addSuffix: true });
  };

  const hasUnreadMessages = (chat: any) => {
    // You can implement unread logic here based on your requirements
    return false; // Placeholder
  };

  const isSomeoneTyping = () => {
    if (!activeChat) return false;
    const currentChatTyping = typingUsers[activeChat._id] || {};
    const typingUserIds = Object.keys(currentChatTyping).filter(userId => userId !== user?.id);
    return typingUserIds.length > 0;
  };

  const getTypingText = () => {
    if (!activeChat) return '';
    const currentChatTyping = typingUsers[activeChat._id] || {};
    const typingUserIds = Object.keys(currentChatTyping).filter(userId => userId !== user?.id);
    
    if (typingUserIds.length === 0) return '';
    if (typingUserIds.length === 1) return 'Someone is typing...';
    return 'Multiple people are typing...';
  };

  // Get current messages
  const currentMessages = activeChat ? messages[activeChat._id] || [] : [];

  // Handle message input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!activeChat) return;

    if (!isTyping) {
      setIsTyping(true);
      startTyping(activeChat._id);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping(activeChat._id);
    }, 1000);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    // Stop typing immediately when sending
    if (isTyping) {
      setIsTyping(false);
      stopTyping(activeChat._id);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    await sendMessage(activeChat._id, messageContent);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleChatSelect = (chat: any) => {
    setActiveChat(chat);
  };

  const handleBackToList = () => {
    setActiveChat(null);
  };

  const handleCreateDirect = async () => {
    
    const userId = directUserId.trim();
    if (!userId) return;
    try {
      const chat = await createDirectChat(userId);
      if (chat) {
        setActiveChat(chat);
        setIsCreateOpen(false);
        setDirectUserId("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    const participants = groupParticipants
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name || participants.length === 0) return;
    try {
      const chat = await createGroupChat(name, participants);
      if (chat) {
        setActiveChat(chat);
        setIsCreateOpen(false);
        setGroupName("");
        setGroupParticipants("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // API helpers for search/suggestions and creating direct chat using v1 routes
  const searchUsers = async (query: string, page = 1) => {
    try {
      const response = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}&page=${page}&limit=20`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        return { users: data.data.users as any[], pagination: data.data.pagination };
      }
      throw new Error(data.message || 'Search failed');
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  };

  const getUserSuggestions = async () => {
    try {
      const response = await fetch(`${API_BASE}/users/suggestions?limit=10`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        return data.data as any[];
      }
      throw new Error(data.message || 'Suggestion fetch failed');
    } catch (error) {
      console.error('Error getting user suggestions:', error);
      throw error;
    }
  };

  const createChatWithUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/chats/direct/${userId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      throw new Error(data.message || 'Failed to create chat');
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  };

  function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function(this: any, ...args: Parameters<T>) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        fn.apply(this, args);
      }, wait);
    } as T;
  }

  const debouncedSearch = useRef(
    debounce(async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const { users } = await searchUsers(trimmed);
        setSearchResults(users);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300)
  ).current;

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    getUserSuggestions()
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, []);

  const handleUserSelect = async (u: any) => {
    try {
      const chat = await createChatWithUser(u._id);
      await fetchChats();
      if (chat) {
        setActiveChat(chat);
        setIsCreateOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const currentChat = activeChat;

  return (
    <div className={`flex h-screen bg-background ${monochrome ? "grayscale" : ""}`}>
      {/* Conversations List */}
      {!(isMobile && currentChat !== null) && (
        <div className="w-full md:w-80 bg-card border-r border-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link to="/" className="p-1 hover:bg-hover-bg rounded transition-colors">
                  <ArrowLeft className="w-5 h-5 text-icon-color" />
                </Link>
                <h2 className="text-lg font-semibold text-foreground">Messages</h2>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="default">
                    <Plus className="w-4 h-4" />
                    Create
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Chat</DialogTitle>
                    <DialogDescription>Create a direct message or a group chat.</DialogDescription>
                  </DialogHeader>
                  <Tabs value={createTab} onValueChange={setCreateTab}>
                    <TabsList className="mb-4">
                      <TabsTrigger value="direct">Direct</TabsTrigger>
                      <TabsTrigger value="group">Group</TabsTrigger>
                    </TabsList>
                    <TabsContent value="direct">
                      <div className="grid gap-3">
                        <Label htmlFor="userSearch">Search users</Label>
                        <Input
                          id="userSearch"
                          placeholder="Type a name or @username"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchLoading && (
                          <div className="text-sm text-muted-foreground">Searching...</div>
                        )}
                        {searchQuery.trim() ? (
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-foreground">Search Results</h3>
                            <div className="space-y-2 max-h-64 overflow-auto pr-1">
                              {searchResults.map((u) => (
                                <button
                                  key={u._id}
                                  onClick={() => handleUserSelect(u)}
                                  className="w-full flex items-center gap-3 p-2 rounded hover:bg-hover-bg text-left"
                                >
                                  <img src={u.avatar} alt={u.username} className="w-10 h-10 rounded-full object-cover" />
                                  <div>
                                    <div className="text-sm text-foreground">{u.fullname}</div>
                                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                                  </div>
                                </button>
                              ))}
                              {searchResults.length === 0 && !searchLoading && (
                                <div className="text-sm text-muted-foreground">No users found.</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-foreground">Suggestions</h3>
                            <div className="space-y-2 max-h-64 overflow-auto pr-1">
                              {suggestions.map((u) => (
                                <button
                                  key={u._id}
                                  onClick={() => handleUserSelect(u)}
                                  className="w-full flex items-center gap-3 p-2 rounded hover:bg-hover-bg text-left"
                                >
                                  <img src={u.avatar} alt={u.username} className="w-10 h-10 rounded-full object-cover" />
                                  <div>
                                    <div className="text-sm text-foreground">{u.fullname}</div>
                                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                                  </div>
                                </button>
                              ))}
                              {suggestions.length === 0 && (
                                <div className="text-sm text-muted-foreground">No suggestions available.</div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end gap-2 mt-2">
                          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Close</Button>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="group">
                      <div className="grid gap-2">
                        <Label htmlFor="groupName">Group name</Label>
                        <Input id="groupName" placeholder="e.g., Weekend Plans" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                        <Label htmlFor="participants">Participants (comma-separated IDs)</Label>
                        <Input id="participants" placeholder="id1, id2, id3" value={groupParticipants} onChange={(e) => setGroupParticipants(e.target.value)} />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                          <Button onClick={handleCreateGroup} disabled={!groupName.trim() || groupParticipants.split(',').map(s => s.trim()).filter(Boolean).length === 0}>Create</Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Conversations */}
          <ScrollArea className="flex-1 inbox-scroll">
            <div className="pb-16 md:pb-0">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : chats.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="mb-2">No conversations yet</p>
                  <p className="text-sm">Start a new chat to get started!</p>
                </div>
              ) : (
                chats.map((chat: any) => (
                  <div
                    key={chat._id}
                    onClick={() => handleChatSelect(chat)}
                    className={`p-4 border-b border-border hover:bg-hover-bg cursor-pointer transition-colors ${
                      currentChat?._id === chat._id ? 'bg-hover-bg' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <img 
                          src={getChatAvatar(chat)} 
                          alt={getChatDisplayName(chat)} 
                          className="w-12 h-12 rounded-full object-cover" 
                        />
                        {isUserOnline(chat) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                        {hasUnreadMessages(chat) && (
                          <div className="absolute -top-1 -left-1 w-3 h-3 bg-accent rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className={`text-sm ${hasUnreadMessages(chat) ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                            {getChatDisplayName(chat)}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {getLastMessageTime(chat)}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${hasUnreadMessages(chat) ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {getLastMessagePreview(chat)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${isMobile && currentChat === null ? 'hidden' : ''}`}>
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    className="p-1 hover:bg-hover-bg rounded transition-colors md:hidden"
                    onClick={handleBackToList}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-5 h-5 text-icon-color" />
                  </button>
                  <div className="relative">
                    <img 
                      src={getChatAvatar(currentChat)} 
                      alt={getChatDisplayName(currentChat)} 
                      className="w-10 h-10 rounded-full object-cover" 
                    />
                    {isUserOnline(currentChat) && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-white rounded-full"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{getChatDisplayName(currentChat)}</h3>
                    <p className="text-xs text-muted-foreground">
                      {isSomeoneTyping() ? getTypingText() : 
                       isUserOnline(currentChat) ? "Active now" : "Last seen recently"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-hover-bg rounded transition-colors">
                    <Phone className="w-5 h-5 text-icon-color" />
                  </button>
                  <button className="p-2 hover:bg-hover-bg rounded transition-colors">
                    <Video className="w-5 h-5 text-icon-color" />
                  </button>
                  <button className="p-2 hover:bg-hover-bg rounded transition-colors">
                    <MoreVertical className="w-5 h-5 text-icon-color" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 main-feed-scroll">
              <div className="p-4 space-y-4 pb-20 md:pb-4">
                {currentMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  // Show messages in reverse order (newest at bottom)
                  [...currentMessages].reverse().map((message: any) => {
                    const isOwn = message.sender._id === user?.id;
                    return (
                      <div
                        key={message._id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] md:max-w-xs rounded-lg p-3 ${
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}>
                          {!isOwn && currentChat.isGroupChat && (
                            <p className="text-xs font-medium mb-1 opacity-75">
                              {message.sender.username}
                            </p>
                          )}
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            isOwn
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          }`}>
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Typing Indicator */}
                {isSomeoneTyping() && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground rounded-lg p-3 max-w-xs">
                      <div className="flex items-center space-x-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-3 md:p-4 border-t border-border bg-card">
              <div className="flex items-center gap-2 md:gap-3">
                <button className="p-2 hover:bg-hover-bg rounded transition-colors">
                  <Paperclip className="w-5 h-5 text-icon-color" />
                </button>
                <div className="flex-1 flex items-center gap-2 bg-input rounded-lg px-3 py-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyPress}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button className="p-1 hover:bg-hover-bg rounded transition-colors">
                    <Smile className="w-4 h-4 text-icon-color" />
                  </button>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center">
                <Send className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">Select a conversation</h3>
              <p className="text-muted-foreground">Choose a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation on mobile */}
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

export default Messages;
