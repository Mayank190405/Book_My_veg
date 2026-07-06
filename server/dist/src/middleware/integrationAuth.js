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
exports.requireAdminKey = exports.integrationAuthenticate = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const context_1 = require("../utils/context");
const integrationAuthenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
        return res.status(401).json({ message: "Unauthorized. API Key is missing in headers." });
    }
    try {
        const dbKey = yield prisma_1.default.apiKey.findUnique({
            where: { key: apiKey },
            include: { location: true }
        });
        if (!dbKey) {
            return res.status(401).json({ message: "Unauthorized. Invalid API Key." });
        }
        if (dbKey.isSuspended) {
            return res.status(403).json({
                message: "API connection suspended due to detected security threats.",
                suspendReason: dbKey.suspendReason
            });
        }
        if (!dbKey.isActive) {
            return res.status(403).json({ message: "API connection is currently inactive." });
        }
        // Attach integration credentials to the request
        req.integration = {
            id: dbKey.id,
            key: dbKey.key,
            name: dbKey.name,
            role: dbKey.role,
            locationId: dbKey.locationId
        };
        // Wrap execution in RequestContext for auditing and triggers
        const requestContext = {
            userId: `API_KEY_${dbKey.id}`,
            locationId: dbKey.locationId || undefined,
            role: dbKey.role
        };
        (0, context_1.runWithContext)(requestContext, () => {
            next();
        });
    }
    catch (error) {
        return res.status(500).json({ message: "Internal server error during authentication." });
    }
});
exports.integrationAuthenticate = integrationAuthenticate;
/**
 * Limits routes to ADMIN-scoped API keys only.
 */
const requireAdminKey = (req, res, next) => {
    if (!req.integration) {
        return res.status(401).json({ message: "Unauthorized." });
    }
    if (req.integration.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden. Admin API Key required." });
    }
    next();
};
exports.requireAdminKey = requireAdminKey;
