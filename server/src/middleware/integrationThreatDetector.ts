import { Response, NextFunction } from "express";
import redisClient from "../config/redis";
import { suspendIntegrationKey } from "../utils/threatHandler";
import { resolveIpLocation, calculateDistanceKm } from "../utils/geoIp";
import { riskScoringService } from "../services/riskScoringService";
import logger from "../utils/logger";

const INJECTION_PATTERNS = {
    SQLI: /union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|update\s+.*\s+set|'\s*OR\s*'\d+'\s*=\s*'\d+|"\s*OR\s*"\d+"\s*=\s*"\d+|'\s*or\s*\d+\s*=\s*\d+|"\s*or\s*\d+\s*=\s*\d+|--|#|xp_cmdshell/i,
    XSS: /<script|onerror\s*=|onload\s*=|javascript:|eval\(|document\.cookie|window\.location/i,
    TRAVERSAL: /\.\.\/|\.\.\\|etc\/passwd|win\.ini|boot\.ini/i
};

// Recursively inspect any request payload values
const scanValue = (value: any): { type: string; signature: string } | null => {
    if (value === null || value === undefined) return null;

    if (typeof value === "string") {
        if (INJECTION_PATTERNS.SQLI.test(value)) {
            return { type: "SQL_INJECTION", signature: value };
        }
        if (INJECTION_PATTERNS.XSS.test(value)) {
            return { type: "XSS_ATTACK", signature: value };
        }
        if (INJECTION_PATTERNS.TRAVERSAL.test(value)) {
            return { type: "PATH_TRAVERSAL", signature: value };
        }
    } else if (typeof value === "object") {
        for (const key of Object.keys(value)) {
            const result = scanValue(value[key]);
            if (result) return result;
        }
    }
    return null;
};

export const integrationThreatDetector = async (req: any, res: Response, next: NextFunction) => {
    if (!req.integration) {
        return res.status(401).json({ message: "Unauthorized. Integration context missing." });
    }

    const { id: apiKeyId, name: keyName } = req.integration;
    const ipAddress = req.ip || req.connection.remoteAddress || "127.0.0.1";

    try {
        // 1. Scan query params, request body, and route params for Injection Attacks
        const threatBody = scanValue(req.body);
        const threatQuery = scanValue(req.query);
        const threatParams = scanValue(req.params);

        const activeThreat = threatBody || threatQuery || threatParams;

        if (activeThreat) {
            const loc = resolveIpLocation(ipAddress);
            await riskScoringService.registerThreat({
                apiKeyId,
                keyName,
                threatType: activeThreat.type,
                severity: "P0", // Injections are P0 Critical
                sourceIp: ipAddress,
                userAgent: req.headers["user-agent"] || null,
                country: loc.country,
                proof: {
                    signature: activeThreat.signature.substring(0, 150),
                    endpoint: req.baseUrl + req.path,
                    method: req.method
                }
            });

            return res.status(403).json({
                message: "API connection suspended due to detected security threats. Payload attack signature."
            });
        }

        // 2. Behavioral Anomaly Detection: Impossible Travel
        const currentLoc = resolveIpLocation(ipAddress);
        const redisKey = `integration_last_location:${apiKeyId}`;
        const lastLocJson = await redisClient.get(redisKey);

        if (lastLocJson) {
            try {
                const lastLoc = JSON.parse(lastLocJson);
                const distance = calculateDistanceKm(
                    lastLoc.latitude,
                    lastLoc.longitude,
                    currentLoc.latitude,
                    currentLoc.longitude
                );

                const timeDiffHours = (Date.now() - new Date(lastLoc.timestamp).getTime()) / (1000 * 60 * 60);

                if (timeDiffHours > 0 && distance > 50) {
                    const speed = distance / timeDiffHours;
                    
                    // Velocity threshold: 1000 km/h (speed of a commercial airliner)
                    if (speed > 1000) {
                        await riskScoringService.registerThreat({
                            apiKeyId,
                            keyName,
                            threatType: "IMPOSSIBLE_TRAVEL",
                            severity: "P1", // Impossible travel is P1 High
                            sourceIp: ipAddress,
                            userAgent: req.headers["user-agent"] || null,
                            country: currentLoc.country,
                            proof: {
                                lastIp: lastLoc.ip,
                                lastCountry: lastLoc.country,
                                lastTime: lastLoc.timestamp,
                                currentIp: ipAddress,
                                currentCountry: currentLoc.country,
                                currentTime: new Date().toISOString(),
                                distanceKm: Math.round(distance),
                                calculatedSpeedKmh: Math.round(speed)
                            }
                        });

                        return res.status(403).json({
                            message: "API connection suspended due to detected security threats. Impossible travel anomaly."
                        });
                    }
                }
            } catch (err) {
                logger.error("[Threat Engine] Failed to calculate travel velocity:", err);
            }
        }

        // Save current location details to Redis for the next travel speed analysis
        await redisClient.setEx(
            redisKey,
            86400, // 24 hours retention
            JSON.stringify({
                ip: ipAddress,
                country: currentLoc.country,
                latitude: currentLoc.latitude,
                longitude: currentLoc.longitude,
                timestamp: new Date().toISOString()
            })
        );

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Tracks failed authorization checks for Store-level keys (403 probing).
 * Suspends key if 5 boundary scans occur in 10 minutes.
 */
export const logAuthorizationFailure = async (req: any) => {
    if (!req.integration) return;

    const { id: apiKeyId, name: keyName } = req.integration;
    const ipAddress = req.ip || req.connection.remoteAddress || "127.0.0.1";
    const loc = resolveIpLocation(ipAddress);
    const redisKey = `integration_probing:${apiKeyId}`;
    const MAX_PROBING_ATTEMPTS = 5;
    const PROBING_WINDOW = 600; // 10 minutes in seconds

    try {
        const attempts = await redisClient.incr(redisKey);
        if (attempts === 1) {
            await redisClient.expire(redisKey, PROBING_WINDOW);
        }

        logger.warn(`[API KEY AUTH FAILURE] Key: ${keyName} (${apiKeyId}) - Failure count: ${attempts}/${MAX_PROBING_ATTEMPTS}`);

        if (attempts >= MAX_PROBING_ATTEMPTS) {
            await riskScoringService.registerThreat({
                apiKeyId,
                keyName,
                threatType: "AUTHORIZATION_PROBE_SCAN",
                severity: "P1", // Scan probing is P1 High
                sourceIp: ipAddress,
                userAgent: req.headers["user-agent"] || null,
                country: loc.country,
                proof: {
                    attemptsCount: attempts,
                    windowSeconds: PROBING_WINDOW,
                    endpoint: req.baseUrl + req.path
                }
            });
        }
    } catch (err) {
        logger.error("Failed to track integration authorization scanning:", err);
    }
};

/**
 * Tracks exfiltrated data record counts.
 * Automatically suspends keys harvesting 500+ records in 1 minute.
 */
export const logDataHarvest = async (req: any, recordCount: number) => {
    if (!req.integration || recordCount <= 0) return;

    const { id: apiKeyId, name: keyName } = req.integration;
    const ipAddress = req.ip || req.connection.remoteAddress || "127.0.0.1";
    const loc = resolveIpLocation(ipAddress);
    const redisKey = `integration_exfil:${apiKeyId}`;
    const EXFIL_WINDOW_SECONDS = 60;
    const EXFIL_THRESHOLD = 500;

    try {
        const currentExfil = await redisClient.incrBy(redisKey, recordCount);
        if (currentExfil === recordCount) {
            await redisClient.expire(redisKey, EXFIL_WINDOW_SECONDS);
        }

        if (currentExfil > EXFIL_THRESHOLD) {
            await riskScoringService.registerThreat({
                apiKeyId,
                keyName,
                threatType: "MASS_RECORD_HARVESTING",
                severity: "P1", // Exfiltration harvesting is P1 High
                sourceIp: ipAddress,
                userAgent: req.headers["user-agent"] || null,
                country: loc.country,
                proof: {
                    recordsHarvested: currentExfil,
                    threshold: EXFIL_THRESHOLD,
                    windowSeconds: EXFIL_WINDOW_SECONDS
                }
            });
        }
    } catch (err) {
        logger.error("Failed to track exfiltration harvesting counts:", err);
    }
};
