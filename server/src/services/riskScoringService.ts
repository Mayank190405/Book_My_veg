import prisma from "../config/prisma";
import { getIo } from "../sockets/io";
import logger from "../utils/logger";
import { IncidentSeverity } from "@prisma/client";
import { scheduleSlaMonitor } from "../queues/slaMonitorQueue";
import axios from "axios";

interface ThreatParams {
    apiKeyId: string;
    keyName: string;
    threatType: string;
    severity: IncidentSeverity;
    sourceIp: string;
    userAgent: string | null;
    country: string | null;
    proof: any;
}

export const riskScoringService = {
    /**
     * Registers a detected threat, executes active mitigations (auto-suspension),
     * creates a DB incident with SLA timer, and triggers WebSocket alerts.
     */
    async registerThreat({
        apiKeyId,
        keyName,
        threatType,
        severity,
        sourceIp,
        userAgent,
        country,
        proof
    }: ThreatParams) {
        try {
            logger.warn(`[Threat Engine] Threat registered. Type: ${threatType}, Severity: ${severity}, Key: ${keyName}`);

            // 1. Calculate SLA Deadline based on severity
            let slaDurationMs = 24 * 60 * 60 * 1000; // default P3 (24h)
            if (severity === "P0") slaDurationMs = 15 * 60 * 1000; // P0: 15 mins
            else if (severity === "P1") slaDurationMs = 60 * 60 * 1000; // P1: 1 hour
            else if (severity === "P2") slaDurationMs = 4 * 60 * 60 * 1000; // P2: 4 hours

            const slaDeadline = new Date(Date.now() + slaDurationMs);

            // 2. Execute active mitigation: Auto-suspend API Key for critical (P0/P1) breaches
            const requiresSuspension = severity === "P0" || severity === "P1";
            if (requiresSuspension) {
                await prisma.apiKey.update({
                    where: { id: apiKeyId },
                    data: {
                        isActive: false,
                        isSuspended: true,
                        suspendReason: `Threat Engine Auto-Suspended: [${severity}] ${threatType}. Details: ${JSON.stringify(proof)}`
                    }
                });
                logger.info(`[Threat Engine] API Key "${keyName}" auto-suspended successfully.`);
            }

            // 3. Create Security Incident record
            const incident = await prisma.securityIncident.create({
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
            await scheduleSlaMonitor(incident.id, slaDurationMs);

            // 4. Create Security Audit Log
            await prisma.securityAuditLog.create({
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
                const io = getIo();
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
                    logger.info(`[Socket.io] Real-time Dashboard Pop-up overlay alert dispatched for incident: ${incident.id}`);
                }
            } catch (socketErr) {
                logger.error("Failed to broadcast real-time socket popup alert:", socketErr);
            }

            // 6. Push DB in-app notifications for all admins
            const admins = await prisma.user.findMany({
                where: { role: "ADMIN" },
                select: { id: true }
            });

            if (admins.length > 0) {
                await prisma.notification.createMany({
                    data: admins.map(admin => ({
                        userId: admin.id,
                        title: `⚠️ DANGER: [${severity}] API INTRUSION DETECTED`,
                        body: `Dynamic alarm triggered for "${keyName}". Incident ID: ${incident.id}. Actions: investigate instantly.`,
                        type: "THREAT"
                    }))
                });
                logger.info(`[Notifications] DB in-app alert cards registered for ${admins.length} administrators.`);
            }

            // 7. Dispatch to Slack Webhook integration if configured
            const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
            if (slackWebhookUrl && (severity === "P0" || severity === "P1")) {
                axios.post(slackWebhookUrl, {
                    text: `🚨 *SECURITY INCIDENT DETECTED* 🚨\n*ID:* \`${incident.id}\`\n*Severity:* \`${severity}\`\n*Threat Type:* ${threatType}\n*Integration Key:* ${keyName}\n*Source IP:* ${sourceIp}\n*Country:* ${country || "Unknown"}\n*Proof details:* \`\`\`${JSON.stringify(proof)}\`\`\``
                }).then(() => {
                    logger.info(`[Slack Alerts] Dispatch completed successfully for incident: ${incident.id}`);
                }).catch(err => {
                    logger.error("[Slack Alerts] Failed to dispatch incident webhook:", err.message);
                });
            }

            return incident;
        } catch (error) {
            logger.error("Error registering security threat:", error);
            throw error;
        }
    }
};
