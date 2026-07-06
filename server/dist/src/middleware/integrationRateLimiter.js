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
exports.integrationRateLimiter = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const threatHandler_1 = require("../utils/threatHandler");
const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const NORMAL_LIMIT = 100;
const FLOOD_LIMIT = 200;
const integrationRateLimiter = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // If request didn't pass authentication,req.integration won't exist.
    // However, this middleware should be placed AFTER integrationAuthenticate.
    if (!req.integration) {
        return res.status(401).json({ message: "Unauthorized. Integration context missing." });
    }
    const { id: apiKeyId, name: keyName } = req.integration;
    const redisKey = `integration_rate:${apiKeyId}`;
    try {
        const currentRequests = yield redis_1.default.incr(redisKey);
        if (currentRequests === 1) {
            yield redis_1.default.expire(redisKey, RATE_LIMIT_WINDOW);
        }
        // 1. Check for extreme flooding threat (auto-suspension)
        if (currentRequests > FLOOD_LIMIT) {
            yield (0, threatHandler_1.suspendIntegrationKey)({
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
    }
    catch (error) {
        next(error);
    }
});
exports.integrationRateLimiter = integrationRateLimiter;
