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
exports.slaMonitorQueue = void 0;
exports.scheduleSlaMonitor = scheduleSlaMonitor;
const bull_1 = __importDefault(require("bull"));
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const io_1 = require("../sockets/io");
exports.slaMonitorQueue = new bull_1.default("sla-monitor", {
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
    },
});
/**
 * Schedules an SLA compliance check for a created security incident.
 */
function scheduleSlaMonitor(incidentId, delayMs) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield exports.slaMonitorQueue.add({ incidentId }, {
                delay: delayMs,
                attempts: 3,
                backoff: { type: "fixed", delay: 5000 },
                jobId: `sla-monitor:${incidentId}`,
                removeOnComplete: true,
                removeOnFail: false,
            });
            logger_1.default.info(`[SLA Scheduler] Scheduled compliance check for Incident: ${incidentId} (Delay: ${delayMs}ms)`);
        }
        catch (err) {
            logger_1.default.error(`[SLA Scheduler] Failed to schedule check for Incident: ${incidentId}`, err);
        }
    });
}
// ── SLA Compliance Worker Processor ──────────────────────────────────────────
exports.slaMonitorQueue.process((job) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { incidentId } = job.data;
    logger_1.default.info(`[SLA compliance audit] Examining Incident status for: ${incidentId}`);
    const incident = yield prisma_1.default.securityIncident.findUnique({
        where: { id: incidentId },
        include: { apiKey: true }
    });
    if (!incident) {
        logger_1.default.warn(`[SLA compliance audit] Incident not found in system registers: ${incidentId}`);
        return;
    }
    const isUnresolved = incident.status === "OPEN" || incident.status === "INVESTIGATING";
    const deadlineBreached = new Date() >= new Date(incident.slaDeadline);
    if (isUnresolved && deadlineBreached) {
        logger_1.default.error(`[🔴 SLA BREACH WARNING] Incident "${incident.title}" has breached SLA guidelines.`);
        // 1. Emit live audio-visual Red SLA alert to Admin HUD
        try {
            const io = (0, io_1.getIo)();
            if (io) {
                io.emit("admin:sla_breach", {
                    incidentId,
                    title: incident.title,
                    severity: incident.severity,
                    slaDeadline: incident.slaDeadline,
                    keyName: ((_a = incident.apiKey) === null || _a === void 0 ? void 0 : _a.name) || "System Integrator",
                    timestamp: new Date()
                });
                logger_1.default.info(`[Socket.io] Real-time SLA breach broadcast completed: ${incidentId}`);
            }
        }
        catch (socketErr) {
            logger_1.default.error("Failed to broadcast SLA breach socket event:", socketErr);
        }
        // 2. Generate critical in-app notification cards
        const admins = yield prisma_1.default.user.findMany({
            where: { role: "ADMIN" },
            select: { id: true }
        });
        if (admins.length > 0) {
            yield prisma_1.default.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    title: `🚨 SLA BREACH: INCIDENT DEADBAND EXCEEDED`,
                    body: `Critical escalation fired for Incident: "${incident.title}". No mitigation logged before deadline!`,
                    type: "SLA_BREACH"
                }))
            });
            logger_1.default.info(`[Notifications] SLA Breach alert cards added for ${admins.length} administrators.`);
        }
    }
    else {
        logger_1.default.info(`[SLA compliance audit] Incident ${incidentId} is resolved/mitigated. SLA guidelines honored.`);
    }
}));
exports.slaMonitorQueue.on("failed", (job, err) => {
    logger_1.default.error("SLA Monitor job failed", { jobId: job.id, incidentId: job.data.incidentId, err: err.message });
});
exports.slaMonitorQueue.on("error", (err) => {
    logger_1.default.error("SLA Monitor queue encountered error", { err: err.message });
});
