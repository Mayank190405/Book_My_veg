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
exports.getSecurityMetrics = exports.getTopApis = exports.getApiUsageOverview = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const getApiUsageOverview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const totalRequests = yield prisma_1.default.apiMetric.count();
        // Calculate volumes
        const volumes = yield prisma_1.default.apiMetric.aggregate({
            _sum: {
                requestBytes: true,
                responseBytes: true
            },
            _avg: {
                responseTime: true
            }
        });
        // Calculate success/failure counts
        const successCount = yield prisma_1.default.apiMetric.count({
            where: {
                status: {
                    gte: 200,
                    lt: 300
                }
            }
        });
        const failureCount = totalRequests - successCount;
        const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 100) : 100;
        // Group metrics by day for historical usage trends
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const historicalMetrics = yield prisma_1.default.apiMetric.findMany({
            where: {
                timestamp: {
                    gte: thirtyDaysAgo
                }
            },
            select: {
                timestamp: true,
                status: true
            }
        });
        // Simple aggregation by date
        const dailyTrends = {};
        historicalMetrics.forEach(metric => {
            const dateStr = metric.timestamp.toISOString().split("T")[0];
            if (!dailyTrends[dateStr]) {
                dailyTrends[dateStr] = { total: 0, success: 0, failure: 0 };
            }
            dailyTrends[dateStr].total++;
            if (metric.status >= 200 && metric.status < 300) {
                dailyTrends[dateStr].success++;
            }
            else {
                dailyTrends[dateStr].failure++;
            }
        });
        const trendsArray = Object.keys(dailyTrends).map(date => (Object.assign({ date }, dailyTrends[date]))).sort((a, b) => a.date.localeCompare(b.date));
        res.json({
            summary: {
                totalRequests,
                totalUploadBytes: volumes._sum.requestBytes || 0,
                totalDownloadBytes: volumes._sum.responseBytes || 0,
                averageResponseTimeMs: Math.round(volumes._avg.responseTime || 0),
                successCount,
                failureCount,
                successRate
            },
            trends: trendsArray
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getApiUsageOverview = getApiUsageOverview;
const getTopApis = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Group by endpoint
        const topEndpoints = yield prisma_1.default.apiMetric.groupBy({
            by: ["endpoint", "method"],
            _count: {
                _all: true
            },
            _avg: {
                responseTime: true
            },
            orderBy: {
                _count: {
                    endpoint: "desc"
                }
            },
            take: 10
        });
        const formatted = topEndpoints.map(item => ({
            endpoint: item.endpoint,
            method: item.method,
            requestCount: item._count._all,
            averageResponseTimeMs: Math.round(item._avg.responseTime || 0)
        }));
        res.json(formatted);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getTopApis = getTopApis;
const getSecurityMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const totalIncidents = yield prisma_1.default.securityIncident.count();
        // Incidents by severity
        const p0Count = yield prisma_1.default.securityIncident.count({ where: { severity: "P0" } });
        const p1Count = yield prisma_1.default.securityIncident.count({ where: { severity: "P1" } });
        const p2Count = yield prisma_1.default.securityIncident.count({ where: { severity: "P2" } });
        const p3Count = yield prisma_1.default.securityIncident.count({ where: { severity: "P3" } });
        // Incidents by status
        const openCount = yield prisma_1.default.securityIncident.count({ where: { status: "OPEN" } });
        const ackCount = yield prisma_1.default.securityIncident.count({ where: { status: "ACKNOWLEDGED" } });
        const invCount = yield prisma_1.default.securityIncident.count({ where: { status: "INVESTIGATING" } });
        const mitCount = yield prisma_1.default.securityIncident.count({ where: { status: "MITIGATED" } });
        const resCount = yield prisma_1.default.securityIncident.count({ where: { status: "RESOLVED" } });
        const closedCount = yield prisma_1.default.securityIncident.count({ where: { status: "CLOSED" } });
        // Calculate MTTD & MTTR
        // MTTD in this system is instantaneous because security checks run inline in middleware!
        // We will return a standard MTTD of < 1 second.
        const meanTimeToDetectSeconds = 0.5;
        // Calculate MTTR in minutes (average time from creation to resolution)
        const resolvedIncidents = yield prisma_1.default.securityIncident.findMany({
            where: {
                resolvedAt: { not: null }
            },
            select: {
                createdAt: true,
                resolvedAt: true
            }
        });
        let totalMttrMs = 0;
        resolvedIncidents.forEach(inc => {
            if (inc.resolvedAt) {
                totalMttrMs += new Date(inc.resolvedAt).getTime() - new Date(inc.createdAt).getTime();
            }
        });
        const meanTimeToResolveMinutes = resolvedIncidents.length > 0
            ? Math.round((totalMttrMs / resolvedIncidents.length) / (60 * 1000))
            : 0;
        res.json({
            incidentCounts: {
                total: totalIncidents,
                bySeverity: { P0: p0Count, P1: p1Count, P2: p2Count, P3: p3Count },
                byStatus: {
                    OPEN: openCount,
                    ACKNOWLEDGED: ackCount,
                    INVESTIGATING: invCount,
                    MITIGATED: mitCount,
                    RESOLVED: resCount,
                    CLOSED: closedCount
                }
            },
            kpis: {
                mttdSeconds: meanTimeToDetectSeconds,
                mttrMinutes: meanTimeToResolveMinutes,
                resolvedIncidentCount: resolvedIncidents.length
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getSecurityMetrics = getSecurityMetrics;
