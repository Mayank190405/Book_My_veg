import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

/**
 * Ensures the requesting user (if not SUPER_ADMIN) is allowed to access the target storeId.
 * Extracting storeId can depend on the route structure, so this middleware expects 
 * req.params.locationId, req.body.locationId, or req.query.locationId.
 */
export const requireStoreAccess = () => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Super Admin can access all stores
        if (req.user.role === "SUPER_ADMIN" || req.user.role === "ADMIN") {
            return next();
        }

        const requestedStoreId = req.params.locationId || req.body.locationId || req.query.locationId;

        // If the route doesn't specify a storeId, let it pass (or fail upstream logic if it was required)
        if (!requestedStoreId) {
            return next();
        }

        if (req.user.locationId !== requestedStoreId) {
            return res.status(403).json({ message: "Forbidden: Cross-tenant access denied." });
        }

        next();
    };
};
