// server/src/index.ts


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
import paymentRoutes from "./routes/paymentRoutes";
import geocodingRoutes from "./routes/geocodingRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import searchRoutes from "./routes/searchRoutes";
import userRoutes from "./routes/userRoutes";
import couponRoutes from "./routes/couponRoutes";
import locationRoutes from "./routes/locationRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import unitRoutes from "./routes/unitRoutes";
import posRoutes from "./routes/posRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import attendanceRoutes from "./routes/attendanceRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import chatRoutes from "./routes/chatRoutes";
import chatHubRoutes from "./routes/chatHubRoutes";
import integrationKeyRoutes from "./routes/integrationKeyRoutes";
import integrationRouter from "./routes/integration/index";
import incidentRoutes from "./routes/incidentRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import pageContentRoutes from "./routes/pageContentRoutes";
import { authenticate, authorize } from "./middleware/auth";
import { socketHandler } from "./sockets/socketHandler";
import logger from "./utils/logger";
import prisma from "./config/prisma";
import { SearchService } from "./services/searchService";
import { startMetricsFlushWorker } from "./services/metricsFlushWorker";

// Bootstrap auto-cancel queue worker (registers Bull processor)
import "./queues/autoCancelQueue";

import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { requestLogger } from "./middleware/requestLogger";
import healthRoutes from "./routes/healthRoutes";
import { initIo } from "./sockets/io";
import { rateLimiter } from "./middleware/rateLimiter";

// ... existing imports

const app = express();
app.set("etag", false); // Disable 304 cache for clear logging & real-time discovery
const server = http.createServer(app);

// Initialize Socket.io (using isolated module to prevent circular deps)
export const io = initIo(server);

// Redis Adapter for Socket.io Scaling
const pubClient = createClient({ url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}` });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.io Redis Adapter connected");
}).catch(err => logger.error("Socket.io Redis Adapter failed", err));

pubClient.on("error", (err) => logger.error("Redis Pub Client Error", err));
subClient.on("error", (err) => logger.error("Redis Sub Client Error", err));


// Middleware
app.use(helmet({
    hsts: false,
}));
app.use(cors({
    origin: [
        process.env.CLIENT_URL || "http://localhost:3000", 
        "https://bookmyveg.co.in",
        "https://www.bookmyveg.co.in",
        "http://3.109.5.168:3000",
        "http://192.168.1.9:3000", 
        "http://192.168.1.13:3000"
    ],
    credentials: true,
    maxAge: 86400,
}));
import path from "path";
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads"), {
    maxAge: "365d",
    setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
}));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(requestLogger); // Request logging

// Routes
app.use("/health", healthRoutes); // Health Check
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", rateLimiter(500, 60), categoryRoutes);
app.use("/api/v1/products", rateLimiter(500, 60), productRoutes);
app.use("/api/v1/banners", bannerRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/addresses", addressRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/geocoding", geocodingRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/coupons", couponRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/locations", locationRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/units", unitRoutes);
app.use("/api/v1/pos", posRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/chathub", chatHubRoutes);
app.use("/api/v1/integration-keys", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), integrationKeyRoutes);
app.use("/api/v1/incidents", authenticate, authorize(["ADMIN"]), incidentRoutes);
app.use("/api/v1/analytics", authenticate, authorize(["ADMIN"]), analyticsRoutes);
app.use("/api/v1/page-content", pageContentRoutes);
app.use("/api/integration/v1", integrationRouter);

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

// Configure strict timeouts to prevent connection exhaustion / slow-loris attacks
server.timeout = 10000;          // 10s request execution timeout
server.headersTimeout = 8000;    // 8s headers receive timeout
server.keepAliveTimeout = 5000;  // 5s keep-alive window

server.listen(PORT, async () => {
    logger.info(`Server started on port ${PORT}`, { env: process.env.NODE_ENV });
    
    // Start background metrics flush daemon
    startMetricsFlushWorker();
    
    // Initialize Search Index Settings
    try {
        await SearchService.getInstance().init();
    } catch (e) {
        logger.error("Search Service Init Failed", e);
    }
});

