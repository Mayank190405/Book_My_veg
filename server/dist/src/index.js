"use strict";
// server/src/index.ts
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
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const categoryRoutes_1 = __importDefault(require("./routes/categoryRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const bannerRoutes_1 = __importDefault(require("./routes/bannerRoutes"));
const cartRoutes_1 = __importDefault(require("./routes/cartRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const addressRoutes_1 = __importDefault(require("./routes/addressRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const payRoutes_1 = __importDefault(require("./routes/payRoutes"));
const geocodingRoutes_1 = __importDefault(require("./routes/geocodingRoutes"));
const reviewRoutes_1 = __importDefault(require("./routes/reviewRoutes"));
const searchRoutes_1 = __importDefault(require("./routes/searchRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const couponRoutes_1 = __importDefault(require("./routes/couponRoutes"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const inventoryRoutes_1 = __importDefault(require("./routes/inventoryRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const unitRoutes_1 = __importDefault(require("./routes/unitRoutes"));
const variantRoutes_1 = __importDefault(require("./routes/variantRoutes"));
const posRoutes_1 = __importDefault(require("./routes/posRoutes"));
const poRoutes_1 = __importDefault(require("./routes/poRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const expenseRoutes_1 = __importDefault(require("./routes/expenseRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const chatHubRoutes_1 = __importDefault(require("./routes/chatHubRoutes"));
const integrationKeyRoutes_1 = __importDefault(require("./routes/integrationKeyRoutes"));
const index_1 = __importDefault(require("./routes/integration/index"));
const incidentRoutes_1 = __importDefault(require("./routes/incidentRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const pageContentRoutes_1 = __importDefault(require("./routes/pageContentRoutes"));
const templateRoutes_1 = __importDefault(require("./routes/templateRoutes"));
const vendorRoutes_1 = __importDefault(require("./routes/vendorRoutes"));
const staffAdvanceRoutes_1 = __importDefault(require("./routes/staffAdvanceRoutes"));
const auth_1 = require("./middleware/auth");
const socketHandler_1 = require("./sockets/socketHandler");
const logger_1 = __importDefault(require("./utils/logger"));
const prisma_1 = __importDefault(require("./config/prisma"));
const searchService_1 = require("./services/searchService");
const metricsFlushWorker_1 = require("./services/metricsFlushWorker");
const paymentReminderWorker_1 = require("./services/paymentReminderWorker");
// Bootstrap auto-cancel queue worker (registers Bull processor)
require("./queues/autoCancelQueue");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
const requestLogger_1 = require("./middleware/requestLogger");
const healthRoutes_1 = __importDefault(require("./routes/healthRoutes"));
const io_1 = require("./sockets/io");
const rateLimiter_1 = require("./middleware/rateLimiter");
// ... existing imports
const app = (0, express_1.default)();
app.set("etag", false); // Disable 304 cache for clear logging & real-time discovery
const server = http_1.default.createServer(app);
// Initialize Socket.io (using isolated module to prevent circular deps)
exports.io = (0, io_1.initIo)(server);
// Redis Adapter for Socket.io Scaling
const pubClient = (0, redis_1.createClient)({ url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}` });
const subClient = pubClient.duplicate();
Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    exports.io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
    logger_1.default.info("Socket.io Redis Adapter connected");
}).catch(err => logger_1.default.error("Socket.io Redis Adapter failed", err));
pubClient.on("error", (err) => logger_1.default.error("Redis Pub Client Error", err));
subClient.on("error", (err) => logger_1.default.error("Redis Sub Client Error", err));
app.use((0, helmet_1.default)({
    hsts: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
}));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow all origins dynamically (reflecting request origin) so credentials and CORS checks pass cleanly
        callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "Cookie"],
    maxAge: 86400,
}));
const path_1 = __importDefault(require("path"));
app.use("/uploads", express_1.default.static(path_1.default.join(process.cwd(), "public/uploads"), {
    maxAge: "365d",
    setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
}));
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
app.use((0, cookie_parser_1.default)());
app.use(requestLogger_1.requestLogger); // Request logging
// Routes
app.use("/health", healthRoutes_1.default); // Health Check
app.use("/api/v1/auth", authRoutes_1.default);
app.use("/api/v1/categories", (0, rateLimiter_1.rateLimiter)(500, 60), categoryRoutes_1.default);
app.use("/api/v1/products", (0, rateLimiter_1.rateLimiter)(500, 60), productRoutes_1.default);
app.use("/api/v1/banners", bannerRoutes_1.default);
app.use("/api/v1/cart", cartRoutes_1.default);
app.use("/api/v1/orders", orderRoutes_1.default);
app.use("/api/v1/addresses", addressRoutes_1.default);
app.use("/api/v1/payments", paymentRoutes_1.default);
app.use("/api/v1/pay", payRoutes_1.default);
app.use("/api/v1/geocoding", geocodingRoutes_1.default);
app.use("/api/v1/reviews", reviewRoutes_1.default);
app.use("/api/v1/search", searchRoutes_1.default);
app.use("/api/v1/coupons", couponRoutes_1.default);
app.use("/api/v1/users", userRoutes_1.default);
app.use("/api/v1/locations", locationRoutes_1.default);
app.use("/api/v1/inventory", inventoryRoutes_1.default);
app.use("/api/v1/notifications", notificationRoutes_1.default);
app.use("/api/v1/units", unitRoutes_1.default);
app.use("/api/v1/variants", variantRoutes_1.default);
app.use("/api/v1/purchase-orders", poRoutes_1.default);
app.use("/api/v1/pos", posRoutes_1.default);
app.use("/api/v1/dashboard", dashboardRoutes_1.default);
app.use("/api/v1/attendance", attendanceRoutes_1.default);
app.use("/api/v1/expenses", expenseRoutes_1.default);
app.use("/api/v1/chat", chatRoutes_1.default);
app.use("/api/v1/chathub", chatHubRoutes_1.default);
app.use("/api/v1/integration-keys", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), integrationKeyRoutes_1.default);
app.use("/api/v1/incidents", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), incidentRoutes_1.default);
app.use("/api/v1/analytics", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), analyticsRoutes_1.default);
app.use("/api/v1/page-content", pageContentRoutes_1.default);
app.use("/api/v1/templates", templateRoutes_1.default);
app.use("/api/v1/vendors", vendorRoutes_1.default);
app.use("/api/v1/staff-advances", staffAdvanceRoutes_1.default);
app.use("/api/integration/v1", index_1.default);
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});
// Socket.io
(0, socketHandler_1.socketHandler)(exports.io);
// ── Global 5xx error handler ──────────────────────────────────────────────────
// ── Global Error Handler ──────────────────────────────────────────────────
const errorHandler_1 = require("./middleware/errorHandler");
app.use(errorHandler_1.errorHandler);
const PORT = process.env.PORT || 5000;
// Configure strict timeouts to prevent connection exhaustion / slow-loris attacks
server.timeout = 10000; // 10s request execution timeout
server.headersTimeout = 8000; // 8s headers receive timeout
server.keepAliveTimeout = 5000; // 5s keep-alive window
server.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.info(`Server started on port ${PORT}`, { env: process.env.NODE_ENV });
    // Auto-sync PostgreSQL Role enum values on database
    try {
        const roles = ["USER", "ADMIN", "MANAGER", "POS_OPERATOR", "PACKING", "DELIVERY_PARTNER", "CENTER_HEAD", "STORE_ADMIN", "PURCHASE_MANAGER"];
        for (const r of roles) {
            yield prisma_1.default.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS '${r}';`).catch(() => null);
        }
        logger_1.default.info("✅ PostgreSQL 'Role' enum synchronized with all roles including PURCHASE_MANAGER");
    }
    catch (e) {
        // Ignore if DB type is non-enum or already synced
    }
    // Auto-sync database columns for Delivery & Packer workflow
    try {
        yield prisma_1.default.$executeRawUnsafe(`
            ALTER TABLE "Order"
            ADD COLUMN IF NOT EXISTS "isDelivery" BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS "packerValidatedAt" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "packerValidatedBy" TEXT,
            ADD COLUMN IF NOT EXISTS "cashCollected" DECIMAL(10,2) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "easebuzzCollected" DECIMAL(10,2) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "returnAssignedTo" TEXT,
            ADD COLUMN IF NOT EXISTS "returnReason" TEXT,
            ADD COLUMN IF NOT EXISTS "returnStatus" TEXT;
        `);
        logger_1.default.info("✅ PostgreSQL 'Order' delivery/packer columns synchronized");
    }
    catch (e) {
        logger_1.default.warn("Order table column sync warning: " + e.message);
    }
    // Start background metrics flush daemon
    (0, metricsFlushWorker_1.startMetricsFlushWorker)();
    // Start background unpaid invoice reminders and feedback dispatch
    (0, paymentReminderWorker_1.startPaymentReminderWorker)();
    // Start background 6-hour Easebuzz transaction sync cron
    try {
        const { startEasebuzzSyncCron } = require("./services/easebuzzSyncService");
        startEasebuzzSyncCron();
    }
    catch (e) {
        logger_1.default.error("Easebuzz transaction sync cron init failed", e);
    }
    // Initialize Search Index Settings
    try {
        yield searchService_1.SearchService.getInstance().init();
    }
    catch (e) {
        logger_1.default.error("Search Service Init Failed", e);
    }
    // Sync product pricing across all channels
    try {
        const { syncAllProductPricing } = require("./controllers/productController");
        yield syncAllProductPricing();
    }
    catch (e) {
        logger_1.default.error("Product pricing sync failed", e);
    }
}));
