import mongoose from "mongoose";
import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { ChatEvents } from "../constants.js";

const chatCommonAggregation = () => [
  {
    $lookup: {
      from: "users",
      localField: "participants",
      foreignField: "_id",
      as: "participants",
      pipeline: [
        {
          $project: {
            password: 0,
            refreshToken: 0,
          },
        },
      ],
    },
  },
  {
    $lookup: {
      from: "messages",
      localField: "lastMessage",
      foreignField: "_id",
      as: "lastMessage",
      pipeline: [
        {
          $lookup: {
            from: "users",
            localField: "sender",
            foreignField: "_id",
            as: "sender",
            pipeline: [{ $project: { username: 1, avatar: 1, email: 1 } }],
          },
        },
        { $addFields: { sender: { $first: "$sender" } } },
      ],
    },
  },
  { $addFields: { lastMessage: { $first: "$lastMessage" } } },
];

// Get all chats for current user
export const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.aggregate([
      {
        $match: {
          participants: { $elemMatch: { $eq: req.user._id } },
        },
      },
      { $sort: { updatedAt: -1 } },
      ...chatCommonAggregation(),
    ]);

    res.json({
      success: true,
      data: chats || [],
      message: "Chats fetched successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create or get one-on-one chat
export const createOrGetDirectChat = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot create chat with yourself",
      });
    }

    let chat = await Chat.aggregate([
      {
        $match: {
          isGroupChat: false,
          $and: [
            { participants: { $elemMatch: { $eq: req.user._id } } },
            { participants: { $elemMatch: { $eq: new mongoose.Types.ObjectId(userId) } } },
          ],
        },
      },
      ...chatCommonAggregation(),
    ]);

    if (chat.length) {
      return res.json({
        success: true,
        data: chat[0],
        message: "Chat retrieved successfully",
      });
    }

    // Create new chat
    const newChat = await Chat.create({
      name: "Direct Message",
      participants: [req.user._id, userId],
      admin: req.user._id,
    });

    chat = await Chat.aggregate([
      { $match: { _id: newChat._id } },
      ...chatCommonAggregation(),
    ]);

    // Emit new chat event to participants
    const io = req.app.get("io");
    chat[0].participants.forEach((participant) => {
      if (participant._id.toString() !== req.user._id.toString()) {
        io.to(participant._id.toString()).emit(ChatEvents.NEW_CHAT, chat[0]);
      }
    });

    res.status(201).json({
      success: true,
      data: chat[0],
      message: "Chat created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create group chat
export const createGroupChat = async (req, res) => {
  try {
    const { name, participants } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Group name is required",
      });
    }

    if (!participants?.length || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 participants required for group chat",
      });
    }

    const members = [...new Set([...participants, req.user._id.toString()])];

    const groupChat = await Chat.create({
      name: name.trim(),
      isGroupChat: true,
      participants: members,
      admin: req.user._id,
    });

    const chat = await Chat.aggregate([
      { $match: { _id: groupChat._id } },
      ...chatCommonAggregation(),
    ]);

    // Emit new chat event to participants
    const io = req.app.get("io");
    chat[0].participants.forEach((participant) => {
      if (participant._id.toString() !== req.user._id.toString()) {
        io.to(participant._id.toString()).emit(ChatEvents.NEW_CHAT, chat[0]);
      }
    });

    res.status(201).json({
      success: true,
      data: chat[0],
      message: "Group chat created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete chat
export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this chat",
      });
    }

    // For group chats, only admin can delete
    if (chat.isGroupChat && chat.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only group admin can delete the chat",
      });
    }

    await Chat.findByIdAndDelete(chatId);
    await Message.deleteMany({ chat: chatId });

    // Emit leave chat event
    const io = req.app.get("io");
    chat.participants.forEach((participantId) => {
      if (participantId.toString() !== req.user._id.toString()) {
        io.to(participantId.toString()).emit(ChatEvents.LEAVE_CHAT, { chatId });
      }
    });

    res.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};