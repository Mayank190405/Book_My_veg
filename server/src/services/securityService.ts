
import prisma from "../config/prisma";
import logger from "../utils/logger";

export class SecurityService {
    /**
     * Explicitly logs high-risk security events to the SecurityAuditLog table.
     * Use this for application-level forensic tracing (e.g. override attempts, privilege escalation).
     */
    static async logAudit(params: {
        tableName: string;
        operation: string;
        staffId: string;
        severity?: "INFO" | "WARNING" | "CRITICAL";
        details: string;
    }, tx?: any) {
        const db = tx || prisma;
        try {
            await db.securityAuditLog.create({
                data: {
                    tableName: params.tableName,
                    attemptedOperation: params.operation,
                    attemptedBy: params.staffId,
                    severity: params.severity || "INFO",
                    rawQuerySnippet: params.details
                }
            });
        } catch (error) {
            logger.error("Failed to write SecurityAuditLog", { error, params });
        }
    }
}
