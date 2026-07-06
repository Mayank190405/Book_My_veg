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
exports.rateLimiter = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const WINDOW_SIZE_IN_SECONDS = 3600; // 1 hour
const MAX_WINDOW_REQUEST_COUNT = 8; // 8 OTPs per hour per IP/Phone
const rateLimiter = (limit = MAX_WINDOW_REQUEST_COUNT, window = WINDOW_SIZE_IN_SECONDS) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // Skip rate limiting for authenticated staff/admin
        if (req.user && (req.user.role === 'ADMIN' ||
            req.user.role === 'STORE_ADMIN' ||
            req.user.role === 'STAFF' ||
            req.user.role === 'POS_OPERATOR' ||
            req.user.role === 'MANAGER')) {
            return next();
        }
        const ip = req.ip;
        const phone = (_a = req.body) === null || _a === void 0 ? void 0 : _a.phone; // If available
        const routePath = req.baseUrl || req.path || "global";
        const key = `rate_limit:${routePath}:${phone || ip}`;
        try {
            const requests = yield redis_1.default.incr(key);
            if (requests === 1) {
                yield redis_1.default.expire(key, window);
            }
            if (requests > limit) {
                const ttl = yield redis_1.default.ttl(key);
                return res.status(429).json({
                    message: "Too many requests, please try again later.",
                    retryAfter: ttl > 0 ? ttl : window
                });
            }
            next();
        }
        catch (error) {
            next(error);
        }
    });
};
exports.rateLimiter = rateLimiter;
