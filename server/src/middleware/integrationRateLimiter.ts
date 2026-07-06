import { Response, NextFunction } from "express";
import redisClient from "../config/redis";
import { suspendIntegrationKey } from "../utils/threatHandler";

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const NORMAL_LIMIT = 100;
const FLOOD_LIMIT = 200;

export const integrationRateLimiter = async (req: any, res: Response, next: NextFunction) => {
    // If request didn't pass authentication,req.integration won't exist.
    // However, this middleware should be placed AFTER integrationAuthenticate.
    if (!req.integration) {
        return res.status(401).json({ message: "Unauthorized. Integration context missing." });
    }

    const { id: apiKeyId, name: keyName } = req.integration;
    const redisKey = `integration_rate:${apiKeyId}`;

    try {
        const currentRequests = await redisClient.incr(redisKey);

        if (currentRequests === 1) {
            await redisClient.expire(redisKey, RATE_LIMIT_WINDOW);
        }

        // 1. Check for extreme flooding threat (auto-suspension)
        if (currentRequests > FLOOD_LIMIT) {
            await suspendIntegrationKey({
                apiKeyId,
                keyName,
                threatType: "RATE_LIMIT_FLOOD",
                reason: `Extreme rate violation with ${currentRequests} requests in a 60s window (limit: ${NORMAL_LIMIT})`
            });
            return res.status(403).json({
                message: "API connection suspended due to detected security threats. Rate limit flooding."
            });
        }

        // 2. Check for normal rate limit breach
        if (currentRequests > NORMAL_LIMIT) {
            return res.status(429).json({
                message: "Too many requests. Integration rate limit of 100 requests/minute exceeded."
            });
        }

        next();
    } catch (error) {
        next(error);
    }
};
