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
exports.startMetricsFlushWorker = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const FLUSH_INTERVAL_MS = 10000; // 10 seconds
const BATCH_SIZE = 500;
const startMetricsFlushWorker = () => {
    logger_1.default.info("[Metrics Flush Worker] Daemon initialized.");
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Check connection first
            if (!redis_1.default.isOpen)
                return;
            const metrics = [];
            // Pop items up to BATCH_SIZE
            for (let i = 0; i < BATCH_SIZE; i++) {
                const rawItem = yield redis_1.default.rPop("integration_metrics_buffer");
                if (!rawItem)
                    break;
                try {
                    metrics.push(JSON.parse(rawItem));
                }
                catch (parseErr) {
                    logger_1.default.error("[Metrics Flush Worker] Error parsing buffered item:", parseErr);
                }
            }
            if (metrics.length === 0)
                return;
            logger_1.default.info(`[Metrics Flush Worker] Batch flush triggered. Saving ${metrics.length} requests metrics.`);
            // Perform batch insert to PostgreSQL
            yield prisma_1.default.apiMetric.createMany({
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
        }
        catch (error) {
            logger_1.default.error("[Metrics Flush Worker] Error flushing metrics queue to PostgreSQL:", error);
        }
    }), FLUSH_INTERVAL_MS);
};
exports.startMetricsFlushWorker = startMetricsFlushWorker;
