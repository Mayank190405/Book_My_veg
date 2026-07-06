import Bull from "bull";
import prisma from "../config/prisma";
import logger from "../utils/logger";
import { getIo } from "../sockets/io";

export const slaMonitorQueue = new Bull("sla-monitor", {
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
    },
});

/**
 * Schedules an SLA compliance check for a created security incident.
 */
export async function scheduleSlaMonitor(incidentId: string, delayMs: number): Promise<void> {
    try {
        await slaMonitorQueue.add(
            { incidentId },
            {
                delay: delayMs,
                attempts: 3,
                backoff: { type: "fixed", delay: 5000 },
                jobId: `sla-monitor:${incidentId}`,
                removeOnComplete: true,
                removeOnFail: false,
            }
        );
        logger.info(`[SLA Scheduler] Scheduled compliance check for Incident: ${incidentId} (Delay: ${delayMs}ms)`);
    } catch (err) {
        logger.error(`[SLA Scheduler] Failed to schedule check for Incident: ${incidentId}`, err);
    }
}

// ── SLA Compliance Worker Processor ──────────────────────────────────────────
slaMonitorQueue.process(async (job) => {
    const { incidentId } = job.data as { incidentId: string };
    logger.info(`[SLA compliance audit] Examining Incident status for: ${incidentId}`);

    const incident = await prisma.securityIncident.findUnique({
        where: { id: incidentId },
        include: { apiKey: true }
    });

    if (!incident) {
        logger.warn(`[SLA compliance audit] Incident not found in system registers: ${incidentId}`);
        return;
    }

    const isUnresolved = incident.status === "OPEN" || incident.status === "INVESTIGATING";
    const deadlineBreached = new Date() >= new Date(incident.slaDeadline);

    if (isUnresolved && deadlineBreached) {
        logger.error(`[🔴 SLA BREACH WARNING] Incident "${incident.title}" has breached SLA guidelines.`);

        // 1. Emit live audio-visual Red SLA alert to Admin HUD
        try {
            const io = getIo();
            if (io) {
                io.emit("admin:sla_breach", {
                    incidentId,
                    title: incident.title,
                    severity: incident.severity,
                    slaDeadline: incident.slaDeadline,
                    keyName: incident.apiKey?.name || "System Integrator",
                    timestamp: new Date()
                });
                logger.info(`[Socket.io] Real-time SLA breach broadcast completed: ${incidentId}`);
            }
        } catch (socketErr) {
            logger.error("Failed to broadcast SLA breach socket event:", socketErr);
        }

        // 2. Generate critical in-app notification cards
        const admins = await prisma.user.findMany({
            where: { role: "ADMIN" },
            select: { id: true }
        });

        if (admins.length > 0) {
            await prisma.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    title: `🚨 SLA BREACH: INCIDENT DEADBAND EXCEEDED`,
                    body: `Critical escalation fired for Incident: "${incident.title}". No mitigation logged before deadline!`,
                    type: "SLA_BREACH"
                }))
            });
            logger.info(`[Notifications] SLA Breach alert cards added for ${admins.length} administrators.`);
        }
    } else {
        logger.info(`[SLA compliance audit] Incident ${incidentId} is resolved/mitigated. SLA guidelines honored.`);
    }
});

slaMonitorQueue.on("failed", (job: any, err: any) => {
    logger.error("SLA Monitor job failed", { jobId: job.id, incidentId: job.data.incidentId, err: err.message });
});

slaMonitorQueue.on("error", (err: any) => {
    logger.error("SLA Monitor queue encountered error", { err: err.message });
});
