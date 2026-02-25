import { Router } from "express";
import prisma from "../config/prisma";
import redis from "../config/redis";
import logger from "../utils/logger";

const router = Router();

router.get("/", async (req, res) => {
    const health = {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        status: "OK",
        checks: {
            database: "PENDING",
            redis: "PENDING"
        }
    };

    try {
        await prisma.$queryRaw`SELECT 1`;
        health.checks.database = "OK";
    } catch (e: any) {
        health.checks.database = "FAIL";
        health.status = "DEGRADED";
        logger.error("Health Check DB Failed", e);
    }

    try {
        await redis.ping();
        health.checks.redis = "OK";
    } catch (e: any) {
        health.checks.redis = "FAIL";
        health.status = "DEGRADED";
        logger.error("Health Check Redis Failed", e);
    }

    const httpStatus = health.status === "OK" ? 200 : 503;
    res.status(httpStatus).json(health);
});

export default router;
