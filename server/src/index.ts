// Allow Supabase pooler's self-signed/intermediate TLS cert
// (must be set before any network module is imported)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import productRoutes from "./routes/productRoutes";
import bannerRoutes from "./routes/bannerRoutes";
import cartRoutes from "./routes/cartRoutes";
import orderRoutes from "./routes/orderRoutes";
import addressRoutes from "./routes/addressRoutes";
import adminRoutes from "./routes/adminRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import geocodingRoutes from "./routes/geocodingRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import searchRoutes from "./routes/searchRoutes";
import userRoutes from "./routes/userRoutes";
import couponRoutes from "./routes/couponRoutes";
import qrRoutes from "./routes/qrRoutes";
import inventoryOpsRoutes from "./routes/inventoryOpsRoutes";
import posRoutes from "./routes/posRoutes";
import deliveryRoutes from "./routes/deliveryRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import locationRoutes from "./routes/locationRoutes";
import hrRoutes from "./routes/hrRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import packerRoutes from "./routes/packerRoutes";
import driverRoutes from "./routes/driverRoutes";
import mortalityRoutes from "./routes/mortalityRoutes";
import userAnalyticsRoutes from "./routes/userAnalyticsRoutes";
import storeMaintenanceRoutes from "./routes/storeMaintenanceRoutes";
import { socketHandler } from "./sockets/socketHandler";
import logger from "./utils/logger";
import prisma from "./config/prisma";

// Bootstrap auto-cancel queue worker (registers Bull processor)
import "./queues/autoCancelQueue";

import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { requestLogger } from "./middleware/requestLogger";
import healthRoutes from "./routes/healthRoutes";

// ... existing imports

const app = express();
app.set("etag", false); // Disable 304 cache for clear logging & real-time discovery
const server = http.createServer(app);

// Redis Adapter for Socket.io Scaling
const pubClient = createClient({ url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}` });
const subClient = pubClient.duplicate();

export const io = new Server(server, {
    cors: {
        origin: [process.env.CLIENT_URL || "http://localhost:3000", "http://192.168.1.16:3000"],
        methods: ["GET", "POST"],
        credentials: true,
    },
});

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.io Redis Adapter connected");
}).catch(err => logger.error("Socket.io Redis Adapter failed", err));

pubClient.on("error", (err) => logger.error("Redis Pub Client Error", err));
subClient.on("error", (err) => logger.error("Redis Sub Client Error", err));


// Middleware
app.use(helmet());
app.use(cors({
    origin: [process.env.CLIENT_URL || "http://localhost:3000", "http://192.168.1.16:3000"],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger); // Request logging

// Routes
app.use("/health", healthRoutes); // Health Check
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/banners", bannerRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/addresses", addressRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/geocoding", geocodingRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/coupons", couponRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/qr", qrRoutes);
app.use("/api/v1/inventory", inventoryOpsRoutes);
app.use("/api/v1/pos", posRoutes);
app.use("/api/v1/delivery", deliveryRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/locations", locationRoutes);
app.use("/api/v1/hr", hrRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/packer", packerRoutes);
app.use("/api/v1/driver", driverRoutes);
app.use("/api/v1/mortality", mortalityRoutes);
app.use("/api/v1/user-analytics", userAnalyticsRoutes);
app.use("/api/v1/maintenance", storeMaintenanceRoutes);

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

// Socket.io
socketHandler(io);

// ── Global 5xx error handler ──────────────────────────────────────────────────
// ── Global Error Handler ──────────────────────────────────────────────────
import { errorHandler } from "./middleware/errorHandler";
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
    logger.info(`Server started on port ${PORT}`, { env: process.env.NODE_ENV });

    // Auto-seed SYSTEM-POS user if missing
    try {
        const posUser = await prisma.user.upsert({
            where: { id: "SYSTEM-POS" },
            update: {},
            create: {
                id: "SYSTEM-POS",
                name: "POS Terminal",
                phone: "0000000000",
                role: "ADMIN"
            }
        });
        logger.info(`SYSTEM-POS user verified: ${posUser.id}`);
    } catch (err: any) {
        logger.error("Failed to auto-seed SYSTEM-POS user:", err.message);
    }
});
