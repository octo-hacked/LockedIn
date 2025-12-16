import mongoose from "mongoose";
import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { ChatEvents } from "../constants.js";


const messageCommonAggregation = () => [
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
];

// Get messages for a chat
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is participant of the chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found or access denied",
      });
    }

    const messages = await Message.aggregate([
      { $match: { chat: new mongoose.Types.ObjectId(chatId) } },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
      ...messageCommonAggregation(),
    ]);

    res.json({
      success: true,
      data: messages,
      message: "Messages fetched successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found or access denied",
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      content: content.trim(),
      chat: chatId,
    });

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
    });

    const populatedMessage = await Message.aggregate([
      { $match: { _id: message._id } },
      ...messageCommonAggregation(),
    ]);

    const messageData = populatedMessage[0];

    // Emit message to other participants
    const io = req.app.get("io");
    chat.participants.forEach((participantId) => {
      if (participantId.toString() !== req.user._id.toString()) {
        io.to(participantId.toString()).emit(ChatEvents.MESSAGE_RECEIVED, messageData);
      }
    });

    res.status(201).json({
      success: true,
      data: messageData,
      message: "Message sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete message
export const deleteMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;

    const message = await Message.findOne({
      _id: messageId,
      chat: chatId,
      sender: req.user._id,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found or not authorized",
      });
    }

    await Message.findByIdAndDelete(messageId);

    // Update last message if this was the last message
    const chat = await Chat.findById(chatId);
    if (chat.lastMessage?.toString() === messageId) {
      const lastMessage = await Message.findOne(
        { chat: chatId },
        {},
        { sort: { createdAt: -1 } }
      );
      
      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: lastMessage?._id || null,
      });
    }

    // Emit delete event to other participants
    const io = req.app.get("io");
    chat.participants.forEach((participantId) => {
      if (participantId.toString() !== req.user._id.toString()) {
        io.to(participantId.toString()).emit(ChatEvents.MESSAGE_DELETED, {
          messageId,
          chatId,
        });
      }
    });

    res.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};