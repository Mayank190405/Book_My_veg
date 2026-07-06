import { Request, Response } from "express";
import prisma from "../config/prisma";
import { getIo } from "../sockets/io";
import { AuthRequest } from "../middleware/auth";

// ─── GET /api/v1/chat/history ────────────────────────────────────────────────
// Customer: fetches own chat history
// Admin: fetches history for a specific userId passed as query param
export const getChatHistory = async (req: AuthRequest, res: Response) => {
    try {
        const { userId: targetUserId } = req.query;
        const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "STORE_ADMIN";

        // Determine whose history to fetch
        const senderId = isAdmin && targetUserId
            ? (targetUserId as string)
            : req.user!.userId;

        const messages = await prisma.chatMessage.findMany({
            where: { senderId },
            orderBy: { createdAt: "asc" },
            take: 200,
        });

        return res.json({ messages });
    } catch (error) {
        console.error("getChatHistory error:", error);
        return res.status(500).json({ message: "Failed to fetch chat history" });
    }
};

// ─── POST /api/v1/chat/send ──────────────────────────────────────────────────
// Saves message metadata to DB, then broadcasts via Socket.io
// Binary media (base64) is passed in body but NOT saved to DB — only relayed via socket
export const sendMessage = async (req: AuthRequest, res: Response) => {
    try {
        const {
            message,
            orderId,
            hasAttachment,
            attachmentType,
            attachment,     // base64 data URL — relay only, not persisted
            targetUserId,   // admin sends to a specific user's room
        } = req.body;

        const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "STORE_ADMIN";
        const senderId = isAdmin ? (targetUserId || "admin") : req.user!.userId;
        const senderName = req.user ? undefined : "Admin";

        // Persist text/metadata only
        const saved = await prisma.chatMessage.create({
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
        const payload = {
            ...saved,
            attachment: attachment || null,
            senderName: isAdmin ? "BookMyVeg Support" : req.body.senderName,
        };

        const io = getIo();

        if (isAdmin) {
            // Admin replies to a specific customer room AND admin room
            io.to(targetUserId).emit("chat_message", payload);
            io.to("admin_support").emit("chat_message", payload);
        } else {
            // Customer sends — broadcast to their room AND admin support room
            io.to(req.user!.userId).emit("chat_message", payload);
            io.to("admin_support").emit("chat_message", payload);
        }

        return res.status(201).json({ message: saved });
    } catch (error) {
        console.error("sendMessage error:", error);
        return res.status(500).json({ message: "Failed to send message" });
    }
};

// ─── POST /api/v1/chat/end-session ───────────────────────────────────────────
// Marks all messages for a user as session-ended.
// Also emits `chat_session_ended` so all parties clear localStorage.
export const endChatSession = async (req: AuthRequest, res: Response) => {
    try {
        const { targetUserId } = req.body;
        const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "STORE_ADMIN";
        const userId = isAdmin && targetUserId ? targetUserId : req.user!.userId;

        await prisma.chatMessage.updateMany({
            where: { senderId: userId, sessionEnded: false },
            data: { sessionEnded: true },
        });

        const io = getIo();
        // Notify both the user's room and the admin support room
        io.to(userId).emit("chat_session_ended", { userId });
        io.to("admin_support").emit("chat_session_ended", { userId });

        return res.json({ success: true });
    } catch (error) {
        console.error("endChatSession error:", error);
        return res.status(500).json({ message: "Failed to end chat session" });
    }
};

// ─── GET /api/v1/chat/conversations ──────────────────────────────────────────
// Admin only: returns list of active customer conversations
export const getActiveConversations = async (req: AuthRequest, res: Response) => {
    try {
        // Get the latest message per unique customer (non-admin senders)
        const latestMessages = await prisma.chatMessage.findMany({
            where: { isAdmin: false, sessionEnded: false },
            orderBy: { createdAt: "desc" },
            distinct: ["senderId"],
            take: 50,
        });

        // Resolve user names from DB
        const userIds = latestMessages.map(m => m.senderId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, phone: true },
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        const conversations = latestMessages.map(msg => ({
            userId: msg.senderId,
            userName: userMap.get(msg.senderId)?.name || "Customer",
            userPhone: userMap.get(msg.senderId)?.phone || "",
            lastMessage: msg.message,
            lastMessageTime: msg.createdAt,
            hasAttachment: msg.hasAttachment,
            isRead: msg.isRead,
        }));

        return res.json({ conversations });
    } catch (error) {
        console.error("getActiveConversations error:", error);
        return res.status(500).json({ message: "Failed to fetch conversations" });
    }
};

// ─── PATCH /api/v1/chat/mark-read ────────────────────────────────────────────
export const markMessagesRead = async (req: AuthRequest, res: Response) => {
    try {
        const { targetUserId } = req.body;
        await prisma.chatMessage.updateMany({
            where: { senderId: targetUserId, isRead: false },
            data: { isRead: true },
        });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: "Failed to mark read" });
    }
};
