import { Server, Socket } from "socket.io";

const rateLimitMap = new Map<string, { count: number; lastTime: number }>();

export const socketHandler = (io: Server) => {
    io.on("connection", (socket: Socket) => {
        console.log("Client connected:", socket.id);

        // 🛡️ Socket Event Rate-Limiting Protection (Max 20 events/sec)
        socket.onAny((event) => {
            const now = Date.now();
            const record = rateLimitMap.get(socket.id) || { count: 0, lastTime: now };
            
            if (now - record.lastTime < 1000) {
                record.count++;
                if (record.count > 20) {
                    console.warn(`[Socket Threat] Event flood detected on socket ${socket.id} (event: "${event}"). Disconnecting.`);
                    socket.emit("error", { message: "Protocol rate limit exceeded." });
                    socket.disconnect();
                }
            } else {
                record.count = 1;
                record.lastTime = now;
            }
            rateLimitMap.set(socket.id, record);
        });

        // ── Room Join ──────────────────────────────────────────────────────────
        socket.on("join_room", (userId: string) => {
            if (userId) {
                socket.join(userId);
                console.log(`Socket ${socket.id} joined room ${userId}`);
            }
        });

        // ── Admin joins the support hub room ───────────────────────────────────
        socket.on("join_admin_support", () => {
            socket.join("admin_support");
            console.log(`Admin socket ${socket.id} joined admin_support hub`);
        });

        // ── Real-time chat message relay ───────────────────────────────────────
        // Client emits this for instant delivery (API also emits via getIo).
        // This handles the case where the API call hasn't resolved yet.
        socket.on("chat_message_relay", (payload: {
            senderId: string;
            isAdmin: boolean;
            targetUserId?: string;
            message: string;
            attachment?: string; // base64 data URL
            attachmentType?: string;
            id?: string;
        }) => {
            if (payload.isAdmin && payload.targetUserId) {
                // Admin → customer room
                socket.to(payload.targetUserId).emit("chat_message", payload);
                socket.to("admin_support").emit("chat_message", payload);
            } else {
                // Customer → their own room (broadcast to other tabs) and admin
                socket.to(payload.senderId).emit("chat_message", payload);
                socket.to("admin_support").emit("chat_message", payload);
            }
        });

        // ── Typing indicators ──────────────────────────────────────────────────
        socket.on("chat_typing", (payload: { senderId: string; isAdmin: boolean; targetUserId?: string }) => {
            if (payload.isAdmin && payload.targetUserId) {
                socket.to(payload.targetUserId).emit("chat_typing", payload);
            } else {
                socket.to("admin_support").emit("chat_typing", payload);
            }
        });

        // ── Disconnect ─────────────────────────────────────────────────────────
        socket.on("disconnect", () => {
            rateLimitMap.delete(socket.id);
            console.log("Client disconnected:", socket.id);
        });
    });
};
