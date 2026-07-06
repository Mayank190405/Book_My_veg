import { Request, Response } from "express";
import prisma from "../config/prisma";
import logger from "../utils/logger";

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string };
}

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        res.json(notifications);
    } catch (error) {
        logger.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Error fetching notifications" });
    }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const notification = await prisma.notification.updateMany({
            where: { id, userId },
            data: { isRead: true }
        });

        if (notification.count === 0) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.json({ message: "Marked as read" });
    } catch (error) {
        logger.error("Error marking notification as read:", error);
        res.status(500).json({ message: "Error updating notification" });
    }
};

export const markAllRead = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        logger.error("Error marking all read:", error);
        res.status(500).json({ message: "Error updating notifications" });
    }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const result = await prisma.notification.deleteMany({
            where: { id, userId }
        });

        if (result.count === 0) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.json({ message: "Notification deleted" });
    } catch (error) {
        logger.error("Error deleting notification:", error);
        res.status(500).json({ message: "Error deleting notification" });
    }
};
