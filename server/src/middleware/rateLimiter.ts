import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redis";

const WINDOW_SIZE_IN_SECONDS = 3600; // 1 hour
const MAX_WINDOW_REQUEST_COUNT = 8; // 8 OTPs per hour per IP/Phone

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip;
    const phone = req.body.phone; // If available

    const key = `rate_limit:${phone || ip}`;

    try {
        const requests = await redisClient.incr(key);

        if (requests === 1) {
            await redisClient.expire(key, WINDOW_SIZE_IN_SECONDS);
        }

        if (requests > MAX_WINDOW_REQUEST_COUNT) {
            return res.status(429).json({ message: "Too many requests, please try again later." });
        }

        next();
    } catch (error) {
        next(error);
    }
};
