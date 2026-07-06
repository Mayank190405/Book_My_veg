"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Secure notification endpoints
router.get("/", auth_1.authenticate, notificationController_1.getNotifications); // GET /api/v1/notifications
router.patch("/:id/read", auth_1.authenticate, notificationController_1.markAsRead); // PATCH /api/v1/notifications/:id/read
router.patch("/read-all", auth_1.authenticate, notificationController_1.markAllRead); // PATCH /api/v1/notifications/read-all
router.delete("/:id", auth_1.authenticate, notificationController_1.deleteNotification); // DELETE /api/v1/notifications/:id
exports.default = router;
