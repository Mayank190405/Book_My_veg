import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { runWithContext } from "../utils/context";

export interface IntegrationRequest extends Request {
    integration?: {
        id: string;
        key: string;
        name: string;
        role: "ADMIN" | "STORE_ADMIN";
        locationId: string | null;
    };
}

export const integrationAuthenticate = async (req: IntegrationRequest, res: Response, next: NextFunction) => {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
        return res.status(401).json({ message: "Unauthorized. API Key is missing in headers." });
    }

    try {
        const dbKey = await prisma.apiKey.findUnique({
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
            role: dbKey.role as "ADMIN" | "STORE_ADMIN",
            locationId: dbKey.locationId
        };

        // Wrap execution in RequestContext for auditing and triggers
        const requestContext = {
            userId: `API_KEY_${dbKey.id}`,
            locationId: dbKey.locationId || undefined,
            role: dbKey.role
        };

        runWithContext(requestContext, () => {
            next();
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error during authentication." });
    }
};

/**
 * Limits routes to ADMIN-scoped API keys only.
 */
export const requireAdminKey = (req: IntegrationRequest, res: Response, next: NextFunction) => {
    if (!req.integration) {
        return res.status(401).json({ message: "Unauthorized." });
    }

    if (req.integration.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden. Admin API Key required." });
    }

    next();
};
