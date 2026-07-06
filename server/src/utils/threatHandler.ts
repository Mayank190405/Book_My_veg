import prisma from "../config/prisma";
import { getIo } from "../sockets/io";
import logger from "./logger";

interface SuspendParams {
    apiKeyId: string;
    keyName: string;
    threatType: string;
    reason: string;
}

export const suspendIntegrationKey = async ({ apiKeyId, keyName, threatType, reason }: SuspendParams) => {
    try {
        logger.warn(`[THREAT DETECTED] Suspending key ${keyName} (${apiKeyId}) - Reason: ${reason}`);

        // 1. Deactivate key in DB
        await prisma.apiKey.update({
            where: { id: apiKeyId },
            data: {
                isActive: false,
                isSuspended: true,
                suspendReason: `${threatType}: ${reason}`
            }
        });

        // 2. Create Security Audit Log
        await prisma.securityAuditLog.create({
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
            const io = getIo();
            if (io) {
                io.emit("admin:threat_alert", {
                    apiKeyId,
                    name: keyName,
                    threatType,
                    reason,
                    timestamp: new Date()
                });
                logger.info(`[Socket.io] Alert dispatched for key suspension: ${apiKeyId}`);
            }
        } catch (socketErr) {
            logger.error("Failed to dispatch Socket.io alert", socketErr);
        }

        // 4. Create in-app system notifications for all admins
        const admins = await prisma.user.findMany({
            where: { role: "ADMIN" },
            select: { id: true }
        });

        if (admins.length > 0) {
            await prisma.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    title: `⚠️ SECURITY ALERT: API KEY SUSPENDED`,
                    body: `Integration key "${keyName}" was auto-suspended. Threat: ${threatType}. Details: ${reason}`,
                    type: "THREAT"
                }))
            });
            logger.info(`[Notifications] DB alerts created for ${admins.length} administrators`);
        }

    } catch (err) {
        logger.error("Error during integration key auto-suspension process:", err);
    }
};
