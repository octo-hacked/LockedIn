// Updated src/socket/chat.socket.js

import { ChatEvents } from "../constants.js";

export const initializeChatSocket = (io) => {
  const connectedUsers = new Map(); // Track online users

  io.on("connection", (socket) => {
    try {
      console.log("User connected:", socket.userId);

      // User joins their personal room
      socket.join(socket.userId);
      connectedUsers.set(socket.userId, socket.id);

      // Send connection confirmation
      socket.emit(ChatEvents.CONNECTED, {
        message: "Connected successfully",
        userId: socket.userId
      });

      // Broadcast user online status to other users
      socket.broadcast.emit(ChatEvents.USER_ONLINE, {
        userId: socket.userId,
        user: {
          _id: socket.user._id,
          username: socket.user.username,
          fullname: socket.user.fullname,
          avatar: socket.user.avatar
        }
      });

      // Join specific chat room
      socket.on(ChatEvents.JOIN_CHAT, (data) => {
        try {
          const { chatId } = data;
          if (!chatId) {
            socket.emit("error", { message: "Chat ID is required" });
            return;
          }
          
          socket.join(chatId);
          console.log(`User ${socket.userId} joined chat: ${chatId}`);
          
          // Confirm joining
          socket.emit("chatJoined", { chatId });
        } catch (error) {
          console.error("Error joining chat:", error);
          socket.emit("error", { message: "Failed to join chat" });
        }
      });

      // Leave specific chat room
      socket.on(ChatEvents.LEAVE_CHAT, (data) => {
        try {
          const { chatId } = data;
          if (!chatId) {
            socket.emit("error", { message: "Chat ID is required" });
            return;
          }
          
          socket.leave(chatId);
          console.log(`User ${socket.userId} left chat: ${chatId}`);
          
          // Confirm leaving
          socket.emit("chatLeft", { chatId });
        } catch (error) {
          console.error("Error leaving chat:", error);
          socket.emit("error", { message: "Failed to leave chat" });
        }
      });

      // Typing events
      socket.on(ChatEvents.TYPING, (data) => {
        try {
          const { chatId } = data;
          if (!chatId) {
            socket.emit("error", { message: "Chat ID is required for typing event" });
            return;
          }
          
          socket.to(chatId).emit(ChatEvents.TYPING, {
            chatId,
            userId: socket.userId,
            user: {
              _id: socket.user._id,
              username: socket.user.username,
              fullname: socket.user.fullname
            }
          });
        } catch (error) {
          console.error("Error handling typing event:", error);
          socket.emit("error", { message: "Failed to send typing event" });
        }
      });

      socket.on(ChatEvents.STOP_TYPING, (data) => {
        try {
          const { chatId } = data;
          if (!chatId) {
            socket.emit("error", { message: "Chat ID is required for stop typing event" });
            return;
          }
          
          socket.to(chatId).emit(ChatEvents.STOP_TYPING, {
            chatId,
            userId: socket.userId,
            user: {
              _id: socket.user._id,
              username: socket.user.username,
              fullname: socket.user.fullname
            }
          });
        } catch (error) {
          console.error("Error handling stop typing event:", error);
          socket.emit("error", { message: "Failed to send stop typing event" });
        }
      });

      // Handle disconnect
      socket.on("disconnect", (reason) => {
        try {
          console.log("User disconnected:", socket.userId, "Reason:", reason);
          connectedUsers.delete(socket.userId);
          
          // Broadcast user offline status
          socket.broadcast.emit(ChatEvents.USER_OFFLINE, {
            userId: socket.userId,
            user: {
              _id: socket.user._id,
              username: socket.user.username,
              fullname: socket.user.fullname
            }
          });
        } catch (error) {
          console.error("Error handling disconnect:", error);
        }
      });

      // Handle connection errors
      socket.on("error", (error) => {
        console.error("Socket error for user", socket.userId, ":", error);
      });

    } catch (error) {
      console.error("Error in socket connection handler:", error);
      socket.emit("error", { message: "Connection error" });
      socket.disconnect();
    }
  });

  // Handle io-level errors
  io.on("error", (error) => {
    console.error("Socket.IO server error:", error);
  });
};