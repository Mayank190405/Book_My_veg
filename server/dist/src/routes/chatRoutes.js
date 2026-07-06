"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("../controllers/chatController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All chat routes require authentication
router.use(auth_1.authenticate);
// Customer & Admin: fetch chat history
// Admin can pass ?userId=xxx to fetch a specific customer's history
router.get("/history", chatController_1.getChatHistory);
// Customer & Admin: send a message
router.post("/send", chatController_1.sendMessage);
// Customer or Admin: end a chat session (clears session on both ends)
router.post("/end-session", chatController_1.endChatSession);
// Admin only: list all active customer conversations
router.get("/conversations", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), chatController_1.getActiveConversations);
// Admin only: mark messages as read for a given user
router.patch("/mark-read", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), chatController_1.markMessagesRead);
exports.default = router;
