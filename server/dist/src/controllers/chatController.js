"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markMessagesRead = exports.getActiveConversations = exports.endChatSession = exports.sendMessage = exports.getChatHistory = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const io_1 = require("../sockets/io");
// ─── GET /api/v1/chat/history ────────────────────────────────────────────────
// Customer: fetches own chat history
// Admin: fetches history for a specific userId passed as query param
const getChatHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { userId: targetUserId } = req.query;
        const isAdmin = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "ADMIN" || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "STORE_ADMIN";
        // Determine whose history to fetch
        const senderId = isAdmin && targetUserId
            ? targetUserId
            : req.user.userId;
        const messages = yield prisma_1.default.chatMessage.findMany({
            where: { senderId },
            orderBy: { createdAt: "asc" },
            take: 200,
        });
        return res.json({ messages });
    }
    catch (error) {
        console.error("getChatHistory error:", error);
        return res.status(500).json({ message: "Failed to fetch chat history" });
    }
});
exports.getChatHistory = getChatHistory;
// ─── POST /api/v1/chat/send ──────────────────────────────────────────────────
// Saves message metadata to DB, then broadcasts via Socket.io
// Binary media (base64) is passed in body but NOT saved to DB — only relayed via socket
const sendMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { message, orderId, hasAttachment, attachmentType, attachment, // base64 data URL — relay only, not persisted
        targetUserId, // admin sends to a specific user's room
         } = req.body;
        const isAdmin = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "ADMIN" || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "STORE_ADMIN";
        const senderId = isAdmin ? (targetUserId || "admin") : req.user.userId;
        const senderName = req.user ? undefined : "Admin";
        // Persist text/metadata only
        const saved = yield prisma_1.default.chatMessage.create({
            data: {
                senderId,
                isAdmin,
                message: message || "",
                orderId: orderId || null,
                hasAttachment: !!hasAttachment,
                attachmentType: attachmentType || null,
            },
        });
        // Build real-time payload (includes base64 if provided)
        const payload = Object.assign(Object.assign({}, saved), { attachment: attachment || null, senderName: isAdmin ? "BookMyVeg Support" : req.body.senderName });
        const io = (0, io_1.getIo)();
        if (isAdmin) {
            // Admin replies to a specific customer room AND admin room
            io.to(targetUserId).emit("chat_message", payload);
            io.to("admin_support").emit("chat_message", payload);
        }
        else {
            // Customer sends — broadcast to their room AND admin support room
            io.to(req.user.userId).emit("chat_message", payload);
            io.to("admin_support").emit("chat_message", payload);
        }
        return res.status(201).json({ message: saved });
    }
    catch (error) {
        console.error("sendMessage error:", error);
        return res.status(500).json({ message: "Failed to send message" });
    }
});
exports.sendMessage = sendMessage;
// ─── POST /api/v1/chat/end-session ───────────────────────────────────────────
// Marks all messages for a user as session-ended.
// Also emits `chat_session_ended` so all parties clear localStorage.
const endChatSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { targetUserId } = req.body;
        const isAdmin = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "ADMIN" || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "STORE_ADMIN";
        const userId = isAdmin && targetUserId ? targetUserId : req.user.userId;
        yield prisma_1.default.chatMessage.updateMany({
            where: { senderId: userId, sessionEnded: false },
            data: { sessionEnded: true },
        });
        const io = (0, io_1.getIo)();
        // Notify both the user's room and the admin support room
        io.to(userId).emit("chat_session_ended", { userId });
        io.to("admin_support").emit("chat_session_ended", { userId });
        return res.json({ success: true });
    }
    catch (error) {
        console.error("endChatSession error:", error);
        return res.status(500).json({ message: "Failed to end chat session" });
    }
});
exports.endChatSession = endChatSession;
// ─── GET /api/v1/chat/conversations ──────────────────────────────────────────
// Admin only: returns list of active customer conversations
const getActiveConversations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get the latest message per unique customer (non-admin senders)
        const latestMessages = yield prisma_1.default.chatMessage.findMany({
            where: { isAdmin: false, sessionEnded: false },
            orderBy: { createdAt: "desc" },
            distinct: ["senderId"],
            take: 50,
        });
        // Resolve user names from DB
        const userIds = latestMessages.map(m => m.senderId);
        const users = yield prisma_1.default.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, phone: true },
        });
        const userMap = new Map(users.map(u => [u.id, u]));
        const conversations = latestMessages.map(msg => {
            var _a, _b;
            return ({
                userId: msg.senderId,
                userName: ((_a = userMap.get(msg.senderId)) === null || _a === void 0 ? void 0 : _a.name) || "Customer",
                userPhone: ((_b = userMap.get(msg.senderId)) === null || _b === void 0 ? void 0 : _b.phone) || "",
                lastMessage: msg.message,
                lastMessageTime: msg.createdAt,
                hasAttachment: msg.hasAttachment,
                isRead: msg.isRead,
            });
        });
        return res.json({ conversations });
    }
    catch (error) {
        console.error("getActiveConversations error:", error);
        return res.status(500).json({ message: "Failed to fetch conversations" });
    }
});
exports.getActiveConversations = getActiveConversations;
// ─── PATCH /api/v1/chat/mark-read ────────────────────────────────────────────
const markMessagesRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { targetUserId } = req.body;
        yield prisma_1.default.chatMessage.updateMany({
            where: { senderId: targetUserId, isRead: false },
            data: { isRead: true },
        });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ message: "Failed to mark read" });
    }
});
exports.markMessagesRead = markMessagesRead;
