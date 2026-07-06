import { Response, NextFunction } from "express";
import { metricsBuffer } from "../services/metricsBuffer";

export const apiMetricTracker = (req: any, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();

    // 1. Calculate Request Size
    const requestBytes = Number(req.headers["content-length"]) || JSON.stringify(req.body || {}).length || 0;

    // 2. Intercept Response Size
    let responseBytes = 0;
    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function (chunk: any, ...args: any[]) {
        if (chunk) {
            responseBytes += Buffer.isBuffer(chunk) 
                ? chunk.length 
                : typeof chunk === "string" 
                    ? Buffer.byteLength(chunk) 
                    : 0;
        }
        return (originalWrite as any).apply(res, [chunk, ...args]);
    };

    res.end = function (chunk: any, ...args: any[]) {
        if (chunk) {
            responseBytes += Buffer.isBuffer(chunk) 
                ? chunk.length 
                : typeof chunk === "string" 
                    ? Buffer.byteLength(chunk) 
                    : 0;
        }
        return (originalEnd as any).apply(res, [chunk, ...args]);
    };

    // 3. Track request completion
    res.on("finish", () => {
        // Only track requests that have an integration key associated
        if (!req.integration) return;

        const hrDuration = process.hrtime(startTime);
        const responseTime = Math.round(hrDuration[0] * 1000 + hrDuration[1] / 1e6); // in ms

        const apiKeyId = req.integration.id;
        const endpoint = req.baseUrl + req.path;
        const method = req.method;
        const status = res.statusCode;
        const ipAddress = req.ip || req.connection.remoteAddress || "127.0.0.1";
        const userAgent = req.headers["user-agent"] || null;

        metricsBuffer.pushMetric({
            apiKeyId,
            endpoint,
            method,
            status,
            responseTime,
            requestBytes,
            responseBytes,
            ipAddress,
            userAgent
        });
    });

    next();
};
