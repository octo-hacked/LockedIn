import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { io, Socket,  } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Types
interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
}

interface ChatParticipant extends User {}

interface Chat {
  _id: string;
  name: string;
  isGroupChat: boolean;
  participants: ChatParticipant[];
  admin: string;
  lastMessage?: Message;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  _id: string;
  content: string;
  sender: {
    _id: string;
    username: string;
    avatar?: string;
    email: string;
  };
  chat: string;
  attachments: Array<{
    url: string;
    localPath: string;
  }>;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  activeChat: Chat | null;
  onlineUsers: Set<string>;
  typingUsers: Record<string, Record<string, boolean>>;
  loading: boolean;
  socket: Socket | null;
}

interface ChatContextType extends ChatState {
  initializeSocket: (token: string) => void;
  fetchChats: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string) => Promise<Message | undefined>;
  createDirectChat: (userId: string) => Promise<Chat | undefined>;
  createGroupChat: (name: string, participants: string[]) => Promise<Chat | undefined>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  setActiveChat: (chat: Chat | null) => void;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Actions
type ChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SOCKET'; payload: Socket | null }
  | { type: 'SET_CHATS'; payload: Chat[] }
  | { type: 'ADD_CHAT'; payload: Chat }
  | { type: 'UPDATE_CHAT'; payload: Chat }
  | { type: 'REMOVE_CHAT'; payload: string }
  | { type: 'SET_ACTIVE_CHAT'; payload: Chat | null }
  | { type: 'SET_MESSAGES'; payload: { chatId: string; messages: Message[] } }
  | { type: 'ADD_MESSAGE'; payload: { chatId: string; message: Message } }
  | { type: 'REMOVE_MESSAGE'; payload: { chatId: string; messageId: string } }
  | { type: 'SET_USER_ONLINE'; payload: string }
  | { type: 'SET_USER_OFFLINE'; payload: string }
  | { type: 'SET_TYPING'; payload: { chatId: string; userId: string } }
  | { type: 'UNSET_TYPING'; payload: { chatId: string; userId: string } };

const initialState: ChatState = {
  chats: [],
  messages: {},
  activeChat: null,
  onlineUsers: new Set(),
  typingUsers: {},
  loading: false,
  socket: null,
};

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_SOCKET':
      return { ...state, socket: action.payload };
    
    case 'SET_CHATS':
      return { ...state, chats: action.payload };
    
    case 'ADD_CHAT':
      return { 
        ...state, 
        chats: [action.payload, ...state.chats.filter(c => c._id !== action.payload._id)] 
      };
    
    case 'UPDATE_CHAT':
      return {
        ...state,
        chats: state.chats.map(chat => 
          chat._id === action.payload._id ? action.payload : chat
        ),
      };
    
    case 'REMOVE_CHAT':
      return {
        ...state,
        chats: state.chats.filter(chat => chat._id !== action.payload),
        activeChat: state.activeChat?._id === action.payload ? null : state.activeChat,
      };
    
    case 'SET_ACTIVE_CHAT':
      return { ...state, activeChat: action.payload };
    
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: action.payload.messages,
        },
      };
    
    case 'ADD_MESSAGE':
      const { chatId, message } = action.payload;
      const existingMessages = state.messages[chatId] || [];
      const messageExists = existingMessages.some(m => m._id === message._id);
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: messageExists ? existingMessages : [message, ...existingMessages],
        },
      };
    
    case 'REMOVE_MESSAGE':
      const { chatId: removeChatId, messageId } = action.payload;
      return {
        ...state,
        messages: {
          ...state.messages,
          [removeChatId]: (state.messages[removeChatId] || []).filter(
            msg => msg._id !== messageId
          ),
        },
      };
    
    case 'SET_USER_ONLINE':
      return {
        ...state,
        onlineUsers: new Set([...state.onlineUsers, action.payload]),
      };
    
    case 'SET_USER_OFFLINE':
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.delete(action.payload);
      return { ...state, onlineUsers: newOnlineUsers };
    
    case 'SET_TYPING':
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.payload.chatId]: {
            ...state.typingUsers[action.payload.chatId],
            [action.payload.userId]: true,
          },
        },
      };
    
    case 'UNSET_TYPING':
      const newTypingUsers = { ...state.typingUsers };
      if (newTypingUsers[action.payload.chatId]) {
        delete newTypingUsers[action.payload.chatId][action.payload.userId];
        if (Object.keys(newTypingUsers[action.payload.chatId]).length === 0) {
          delete newTypingUsers[action.payload.chatId];
        }
      }
      return { ...state, typingUsers: newTypingUsers };
    
    default:
      return state;
  }
};

import { API_BASE, SOCKET_BASE } from "@/lib/config";

export const ChatProvider: React.FC<{
  children: ReactNode;
  apiBaseUrl?: string;

}> = ({ children, apiBaseUrl = API_BASE }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user,accessToken } = useAuth(); // Use your existing auth context
  

  // Initialize socket connection
  const initializeSocket = useCallback((token: string) => {
    const socketBaseFromConfig = (typeof window !== 'undefined' ? (window as any).__VITE_SOCKET_BASE__ : undefined) as string | undefined;
    // Prefer explicit env config export
    const socketBase = socketBaseFromConfig || (import.meta.env.VITE_SOCKET_BASE as string) || SOCKET_BASE || (typeof window !== 'undefined' ? (apiBaseUrl && apiBaseUrl.startsWith('http') ? apiBaseUrl.replace(/\/api\/v\d+$/i, '') : window.location.origin) : '');

    const socket = io(socketBase, {
      auth: { token },
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('Connected to chat server');
      dispatch({ type: 'SET_SOCKET', payload: socket });
    });

    socket.on('newChat', (chat: Chat) => {
      dispatch({ type: 'ADD_CHAT', payload: chat });
    });

    socket.on('messageReceived', (message: Message) => {
      dispatch({ type: 'ADD_MESSAGE', payload: { chatId: message.chat, message } });
      
      // Update chat's lastMessage
      dispatch({ type: 'SET_CHATS', payload: state.chats.map(chat => 
        chat._id === message.chat 
          ? { ...chat, lastMessage: message, updatedAt: message.createdAt }
          : chat
      )});
    });

    socket.on('messageDeleted', ({ messageId, chatId }: { messageId: string; chatId: string }) => {
      dispatch({ type: 'REMOVE_MESSAGE', payload: { chatId, messageId } });
    });

    socket.on('userOnline', (userId: string) => {
      dispatch({ type: 'SET_USER_ONLINE', payload: userId });
    });

    socket.on('userOffline', (userId: string) => {
      dispatch({ type: 'SET_USER_OFFLINE', payload: userId });
    });

    socket.on('typing', ({ chatId, userId }: { chatId: string; userId: string }) => {
      dispatch({ type: 'SET_TYPING', payload: { chatId, userId } });
    });

    socket.on('stopTyping', ({ chatId, userId }: { chatId: string; userId: string }) => {
      dispatch({ type: 'UNSET_TYPING', payload: { chatId, userId } });
    });

    socket.on('leaveChat', ({ chatId }: { chatId: string }) => {
      dispatch({ type: 'REMOVE_CHAT', payload: chatId });
    });

    socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      dispatch({ type: 'SET_SOCKET', payload: null });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
      dispatch({ type: 'SET_SOCKET', payload: null });
    });

    return socket;
  }, [apiBaseUrl]);

  // API calls
  const fetchChats = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await fetch(`${apiBaseUrl}/chats`, {
        headers: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        try { window.dispatchEvent(new CustomEvent('sessionExpired')); } catch {}
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      const data = await response.json();

      if (data && data.success) {
        dispatch({ type: 'SET_CHATS', payload: data.data });
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [apiBaseUrl, accessToken]);

  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/chats/${chatId}/messages`, {
        headers: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        try { window.dispatchEvent(new CustomEvent('sessionExpired')); } catch {}
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();

      if (data && data.success) {
        dispatch({ type: 'SET_MESSAGES', payload: { chatId, messages: data.data } });
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [apiBaseUrl, accessToken]);

  const sendMessage = useCallback(async (chatId: string, content: string): Promise<Message | undefined> => {
    try {
      const response = await fetch(`${apiBaseUrl}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      if (response.status === 401) {
        try { window.dispatchEvent(new CustomEvent('sessionExpired')); } catch {}
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      if (data && data.success) {
        dispatch({ type: 'ADD_MESSAGE', payload: { chatId, message: data.data } });

        // Update chat's lastMessage and move to top
        const updatedChats = state.chats.map(chat =>
          chat._id === chatId
            ? { ...chat, lastMessage: data.data, updatedAt: data.data.createdAt }
            : chat
        );

        // Sort chats by updatedAt
        updatedChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        dispatch({ type: 'SET_CHATS', payload: updatedChats });

        return data.data;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [apiBaseUrl, state.chats, accessToken]);

  const createDirectChat = useCallback(async (userId: string): Promise<Chat | undefined> => {
    try {
      const response = await fetch(`${apiBaseUrl}/chats/direct/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        try { window.dispatchEvent(new CustomEvent('sessionExpired')); } catch {}
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error('Failed to create direct chat');
      }

      const data = await response.json();
      if (data && data.success) {
        const existingChat = state.chats.find(chat => chat._id === data.data._id);
        if (!existingChat) {
          dispatch({ type: 'ADD_CHAT', payload: data.data });
        }
        return data.data;
      }
    } catch (error) {
      console.error('Failed to create direct chat:', error);
      throw error;
    }
  }, [apiBaseUrl, state.chats, accessToken]);

  const createGroupChat = useCallback(async (name: string, participants: string[]): Promise<Chat | undefined> => {
    try {
      const response = await fetch(`${apiBaseUrl}/chats/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
        body: JSON.stringify({ name, participants }),
      });

      if (response.status === 401) {
        try { window.dispatchEvent(new CustomEvent('sessionExpired')); } catch {}
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error('Failed to create group chat');
      }

      const data = await response.json();
      if (data && data.success) {
        dispatch({ type: 'ADD_CHAT', payload: data.data });
        return data.data;
      }
    } catch (error) {
      console.error('Failed to create group chat:', error);
      throw error;
    }
  }, [apiBaseUrl, accessToken]);

  const deleteMessage = useCallback(async (chatId: string, messageId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/chats/${chatId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        try { window.dispatchEvent(new CustomEvent('sessionExpired')); } catch {}
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      const data = await response.json();
      if (data && data.success) {
        dispatch({ type: 'REMOVE_MESSAGE', payload: { chatId, messageId } });
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  }, [apiBaseUrl, accessToken]);

  const setActiveChat = useCallback((chat: Chat | null) => {
    dispatch({ type: 'SET_ACTIVE_CHAT', payload: chat });
    if (chat) {
      // Join chat room for real-time updates
      if (state.socket) {
        state.socket.emit('joinChat', chat._id);
      }
      // Fetch messages if not already loaded
      if (!state.messages[chat._id]) {
        fetchMessages(chat._id);
      }
    }
  }, [state.socket, state.messages, fetchMessages]);

  const startTyping = useCallback((chatId: string) => {
    if (state.socket) {
      state.socket.emit('typing', chatId);
    }
  }, [state.socket]);

  const stopTyping = useCallback((chatId: string) => {
    if (state.socket) {
      state.socket.emit('stopTyping', chatId);
    }
  }, [state.socket]);

  const value: ChatContextType = {
    ...state,
    initializeSocket,
    fetchChats,
    fetchMessages,
    sendMessage,
    createDirectChat,
    createGroupChat,
    deleteMessage,
    setActiveChat,
    startTyping,
    stopTyping,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
