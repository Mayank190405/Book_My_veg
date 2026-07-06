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
exports.riskScoringService = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const io_1 = require("../sockets/io");
const logger_1 = __importDefault(require("../utils/logger"));
const slaMonitorQueue_1 = require("../queues/slaMonitorQueue");
const axios_1 = __importDefault(require("axios"));
exports.riskScoringService = {
    /**
     * Registers a detected threat, executes active mitigations (auto-suspension),
     * creates a DB incident with SLA timer, and triggers WebSocket alerts.
     */
    registerThreat(_a) {
        return __awaiter(this, arguments, void 0, function* ({ apiKeyId, keyName, threatType, severity, sourceIp, userAgent, country, proof }) {
            try {
                logger_1.default.warn(`[Threat Engine] Threat registered. Type: ${threatType}, Severity: ${severity}, Key: ${keyName}`);
                // 1. Calculate SLA Deadline based on severity
                let slaDurationMs = 24 * 60 * 60 * 1000; // default P3 (24h)
                if (severity === "P0")
                    slaDurationMs = 15 * 60 * 1000; // P0: 15 mins
                else if (severity === "P1")
                    slaDurationMs = 60 * 60 * 1000; // P1: 1 hour
                else if (severity === "P2")
                    slaDurationMs = 4 * 60 * 60 * 1000; // P2: 4 hours
                const slaDeadline = new Date(Date.now() + slaDurationMs);
                // 2. Execute active mitigation: Auto-suspend API Key for critical (P0/P1) breaches
                const requiresSuspension = severity === "P0" || severity === "P1";
                if (requiresSuspension) {
                    yield prisma_1.default.apiKey.update({
                        where: { id: apiKeyId },
                        data: {
                            isActive: false,
                            isSuspended: true,
                            suspendReason: `Threat Engine Auto-Suspended: [${severity}] ${threatType}. Details: ${JSON.stringify(proof)}`
                        }
                    });
                    logger_1.default.info(`[Threat Engine] API Key "${keyName}" auto-suspended successfully.`);
                }
                // 3. Create Security Incident record
                const incident = yield prisma_1.default.securityIncident.create({
                    data: {
                        title: `⚠️ API Incident: [${severity}] ${threatType}`,
                        description: `Security warning triggered by key "${keyName}". Threat class: ${threatType}. Proof details: ${JSON.stringify(proof)}`,
                        threatType,
                        severity,
                        status: "OPEN",
                        apiKeyId,
                        sourceIp,
                        userAgent,
                        country,
                        slaDeadline,
                        detectionProof: proof
                    }
                });
                // Schedule background SLA compliance audit timer
                yield (0, slaMonitorQueue_1.scheduleSlaMonitor)(incident.id, slaDurationMs);
                // 4. Create Security Audit Log
                yield prisma_1.default.securityAuditLog.create({
                    data: {
                        tableName: "SecurityIncident",
                        attemptedOperation: `THREAT_DETECTION_${threatType}`,
                        attemptedBy: `API_KEY_${apiKeyId}`,
                        severity: severity === "P0" ? "CRITICAL" : "HIGH",
                        rawQuerySnippet: `Registered security incident ${incident.id}. Auto-mitigation applied: ${requiresSuspension}.`
                    }
                });
                // 5. Broadcast real-time Socket.io overlay alert for Admin Dashboard
                try {
                    const io = (0, io_1.getIo)();
                    if (io) {
                        io.emit("admin:threat_alert", {
                            incidentId: incident.id,
                            title: incident.title,
                            threatType,
                            severity,
                            sourceIp,
                            country,
                            proof,
                            slaDeadline,
                            timestamp: incident.createdAt
                        });
                        logger_1.default.info(`[Socket.io] Real-time Dashboard Pop-up overlay alert dispatched for incident: ${incident.id}`);
                    }
                }
                catch (socketErr) {
                    logger_1.default.error("Failed to broadcast real-time socket popup alert:", socketErr);
                }
                // 6. Push DB in-app notifications for all admins
                const admins = yield prisma_1.default.user.findMany({
                    where: { role: "ADMIN" },
                    select: { id: true }
                });
                if (admins.length > 0) {
                    yield prisma_1.default.notification.createMany({
                        data: admins.map(admin => ({
                            userId: admin.id,
                            title: `⚠️ DANGER: [${severity}] API INTRUSION DETECTED`,
                            body: `Dynamic alarm triggered for "${keyName}". Incident ID: ${incident.id}. Actions: investigate instantly.`,
                            type: "THREAT"
                        }))
                    });
                    logger_1.default.info(`[Notifications] DB in-app alert cards registered for ${admins.length} administrators.`);
                }
                // 7. Dispatch to Slack Webhook integration if configured
                const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
                if (slackWebhookUrl && (severity === "P0" || severity === "P1")) {
                    axios_1.default.post(slackWebhookUrl, {
                        text: `🚨 *SECURITY INCIDENT DETECTED* 🚨\n*ID:* \`${incident.id}\`\n*Severity:* \`${severity}\`\n*Threat Type:* ${threatType}\n*Integration Key:* ${keyName}\n*Source IP:* ${sourceIp}\n*Country:* ${country || "Unknown"}\n*Proof details:* \`\`\`${JSON.stringify(proof)}\`\`\``
                    }).then(() => {
                        logger_1.default.info(`[Slack Alerts] Dispatch completed successfully for incident: ${incident.id}`);
                    }).catch(err => {
                        logger_1.default.error("[Slack Alerts] Failed to dispatch incident webhook:", err.message);
                    });
                }
                return incident;
            }
            catch (error) {
                logger_1.default.error("Error registering security threat:", error);
                throw error;
            }
        });
    }
};
