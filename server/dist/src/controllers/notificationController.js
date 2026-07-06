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
exports.deleteNotification = exports.markAllRead = exports.markAsRead = exports.getNotifications = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const getNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const notifications = yield prisma_1.default.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        res.json(notifications);
    }
    catch (error) {
        logger_1.default.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Error fetching notifications" });
    }
});
exports.getNotifications = getNotifications;
const markAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const id = req.params.id;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const notification = yield prisma_1.default.notification.updateMany({
            where: { id, userId },
            data: { isRead: true }
        });
        if (notification.count === 0) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.json({ message: "Marked as read" });
    }
    catch (error) {
        logger_1.default.error("Error marking notification as read:", error);
        res.status(500).json({ message: "Error updating notification" });
    }
});
exports.markAsRead = markAsRead;
const markAllRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        yield prisma_1.default.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
        res.json({ message: "All notifications marked as read" });
    }
    catch (error) {
        logger_1.default.error("Error marking all read:", error);
        res.status(500).json({ message: "Error updating notifications" });
    }
});
exports.markAllRead = markAllRead;
const deleteNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const id = req.params.id;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const result = yield prisma_1.default.notification.deleteMany({
            where: { id, userId }
        });
        if (result.count === 0) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.json({ message: "Notification deleted" });
    }
    catch (error) {
        logger_1.default.error("Error deleting notification:", error);
        res.status(500).json({ message: "Error deleting notification" });
    }
});
exports.deleteNotification = deleteNotification;
