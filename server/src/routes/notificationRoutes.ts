import { Router } from "express";
import { 
    getNotifications, 
    markAsRead, 
    markAllRead, 
    deleteNotification 
} from "../controllers/notificationController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Secure notification endpoints
router.get("/", authenticate, getNotifications); // GET /api/v1/notifications
router.patch("/:id/read", authenticate, markAsRead); // PATCH /api/v1/notifications/:id/read
router.patch("/read-all", authenticate, markAllRead); // PATCH /api/v1/notifications/read-all
router.delete("/:id", authenticate, deleteNotification); // DELETE /api/v1/notifications/:id

export default router;
