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
exports.suspendIntegrationKey = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const io_1 = require("../sockets/io");
const logger_1 = __importDefault(require("./logger"));
const suspendIntegrationKey = (_a) => __awaiter(void 0, [_a], void 0, function* ({ apiKeyId, keyName, threatType, reason }) {
    try {
        logger_1.default.warn(`[THREAT DETECTED] Suspending key ${keyName} (${apiKeyId}) - Reason: ${reason}`);
        // 1. Deactivate key in DB
        yield prisma_1.default.apiKey.update({
            where: { id: apiKeyId },
            data: {
                isActive: false,
                isSuspended: true,
                suspendReason: `${threatType}: ${reason}`
            }
        });
        // 2. Create Security Audit Log
        yield prisma_1.default.securityAuditLog.create({
            data: {
                tableName: "ApiKey",
                attemptedOperation: "API_REQUEST_SUSPEND",
                attemptedBy: apiKeyId,
                severity: "CRITICAL",
                rawQuerySnippet: `ApiKey suspended dynamically by Threat Detection. Type: ${threatType}. Reason: ${reason}`
            }
        });
        // 3. Dispatch real-time Socket.io alert to Admin dashboard
        try {
            const io = (0, io_1.getIo)();
            if (io) {
                io.emit("admin:threat_alert", {
                    apiKeyId,
                    name: keyName,
                    threatType,
                    reason,
                    timestamp: new Date()
                });
                logger_1.default.info(`[Socket.io] Alert dispatched for key suspension: ${apiKeyId}`);
            }
        }
        catch (socketErr) {
            logger_1.default.error("Failed to dispatch Socket.io alert", socketErr);
        }
        // 4. Create in-app system notifications for all admins
        const admins = yield prisma_1.default.user.findMany({
            where: { role: "ADMIN" },
            select: { id: true }
        });
        if (admins.length > 0) {
            yield prisma_1.default.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    title: `⚠️ SECURITY ALERT: API KEY SUSPENDED`,
                    body: `Integration key "${keyName}" was auto-suspended. Threat: ${threatType}. Details: ${reason}`,
                    type: "THREAT"
                }))
            });
            logger_1.default.info(`[Notifications] DB alerts created for ${admins.length} administrators`);
        }
    }
    catch (err) {
        logger_1.default.error("Error during integration key auto-suspension process:", err);
    }
});
exports.suspendIntegrationKey = suspendIntegrationKey;
