import express from "express";
import {
  getUserChats,
  createOrGetDirectChat,
  createGroupChat,
  deleteChat,
} from "../controllers/chat.controller.js";
import {
  getChatMessages,
  sendMessage,
  deleteMessage,
} from "../controllers/message.controller.js";



const router = express.Router();

// Chat routes
router.get("/", getUserChats);
router.post("/direct/:userId", createOrGetDirectChat);
router.post("/group", createGroupChat);
router.delete("/:chatId", deleteChat);

// Message routes
router.get("/:chatId/messages", getChatMessages);
router.post("/:chatId/messages", sendMessage);
router.delete("/:chatId/messages/:messageId", deleteMessage);

export default router;
