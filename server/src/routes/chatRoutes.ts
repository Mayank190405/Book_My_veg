import { Router } from "express";
import {
    getChatHistory,
    sendMessage,
    endChatSession,
    getActiveConversations,
    markMessagesRead,
} from "../controllers/chatController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// Customer & Admin: fetch chat history
// Admin can pass ?userId=xxx to fetch a specific customer's history
router.get("/history", getChatHistory);

// Customer & Admin: send a message
router.post("/send", sendMessage);

// Customer or Admin: end a chat session (clears session on both ends)
router.post("/end-session", endChatSession);

// Admin only: list all active customer conversations
router.get("/conversations", authorize(["ADMIN", "STORE_ADMIN"]), getActiveConversations);

// Admin only: mark messages as read for a given user
router.patch("/mark-read", authorize(["ADMIN", "STORE_ADMIN"]), markMessagesRead);

export default router;
