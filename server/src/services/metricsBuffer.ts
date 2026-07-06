import redisClient from "../config/redis";
import logger from "../utils/logger";

export interface MetricItem {
    apiKeyId: string | null;
    endpoint: string;
    method: string;
    status: number;
    responseTime: number;
    requestBytes: number;
    responseBytes: number;
    ipAddress: string;
    userAgent: string | null;
    timestamp: string;
}

export const metricsBuffer = {
    /**
     * Push a metric item to the high-speed Redis list buffer.
     */
    async pushMetric(item: Omit<MetricItem, "timestamp">) {
        try {
            const fullItem: MetricItem = {
                ...item,
                timestamp: new Date().toISOString()
            };
            await redisClient.lPush("integration_metrics_buffer", JSON.stringify(fullItem));
        } catch (err) {
            logger.error("Failed to buffer API metric in Redis:", err);
        }
    }
};
