import redisClient from "../config/redis";
import prisma from "../config/prisma";
import logger from "../utils/logger";
import { MetricItem } from "./metricsBuffer";

const FLUSH_INTERVAL_MS = 10000; // 10 seconds
const BATCH_SIZE = 500;

export const startMetricsFlushWorker = () => {
    logger.info("[Metrics Flush Worker] Daemon initialized.");

    setInterval(async () => {
        try {
            // Check connection first
            if (!redisClient.isOpen) return;

            const metrics: MetricItem[] = [];

            // Pop items up to BATCH_SIZE
            for (let i = 0; i < BATCH_SIZE; i++) {
                const rawItem = await redisClient.rPop("integration_metrics_buffer");
                if (!rawItem) break;
                try {
                    metrics.push(JSON.parse(rawItem));
                } catch (parseErr) {
                    logger.error("[Metrics Flush Worker] Error parsing buffered item:", parseErr);
                }
            }

            if (metrics.length === 0) return;

            logger.info(`[Metrics Flush Worker] Batch flush triggered. Saving ${metrics.length} requests metrics.`);

            // Perform batch insert to PostgreSQL
            await prisma.apiMetric.createMany({
                data: metrics.map(item => ({
                    apiKeyId: item.apiKeyId,
                    endpoint: item.endpoint,
                    method: item.method,
                    status: item.status,
                    responseTime: item.responseTime,
                    requestBytes: item.requestBytes,
                    responseBytes: item.responseBytes,
                    timestamp: new Date(item.timestamp),
                    ipAddress: item.ipAddress,
                    userAgent: item.userAgent
                }))
            });
        } catch (error) {
            logger.error("[Metrics Flush Worker] Error flushing metrics queue to PostgreSQL:", error);
        }
    }, FLUSH_INTERVAL_MS);
};
