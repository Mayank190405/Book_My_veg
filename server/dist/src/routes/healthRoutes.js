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
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const redis_1 = __importDefault(require("../config/redis"));
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        yield prisma_1.default.$queryRaw `SELECT 1`;
        health.checks.database = "OK";
    }
    catch (e) {
        health.checks.database = "FAIL";
        health.status = "DEGRADED";
        logger_1.default.error("Health Check DB Failed", e);
    }
    try {
        yield redis_1.default.ping();
        health.checks.redis = "OK";
    }
    catch (e) {
        health.checks.redis = "FAIL";
        health.status = "DEGRADED";
        logger_1.default.error("Health Check Redis Failed", e);
    }
    const httpStatus = health.status === "OK" ? 200 : 503;
    res.status(httpStatus).json(health);
}));
exports.default = router;
