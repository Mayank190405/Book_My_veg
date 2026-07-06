import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redis";

const WINDOW_SIZE_IN_SECONDS = 3600; // 1 hour
const MAX_WINDOW_REQUEST_COUNT = 8; // 8 OTPs per hour per IP/Phone

export const rateLimiter = (limit = MAX_WINDOW_REQUEST_COUNT, window = WINDOW_SIZE_IN_SECONDS) => {
    return async (req: any, res: Response, next: NextFunction) => {
        // Skip rate limiting for authenticated staff/admin
        if (req.user && (
            req.user.role === 'ADMIN' || 
            req.user.role === 'STORE_ADMIN' || 
            req.user.role === 'STAFF' || 
            req.user.role === 'POS_OPERATOR' || 
            req.user.role === 'MANAGER'
        )) {
            return next();
        }

        const ip = req.ip;
        const phone = req.body?.phone; // If available
        const routePath = req.baseUrl || req.path || "global";
        const key = `rate_limit:${routePath}:${phone || ip}`;

        try {
            const requests = await redisClient.incr(key);

            if (requests === 1) {
                await redisClient.expire(key, window);
            }

            if (requests > limit) {
                const ttl = await redisClient.ttl(key);
                return res.status(429).json({ 
                    message: "Too many requests, please try again later.",
                    retryAfter: ttl > 0 ? ttl : window
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
