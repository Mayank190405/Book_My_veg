import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "access_secret";

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: string;
        locationId?: string;
    };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, ACCESS_SECRET) as { userId: string; role: string; locationId?: string };
        
        let sessionValid = false;
        
        if (decoded.userId.startsWith("STORE_")) {
            // Check Location Registry for Virtual Hub Sessions
            const locationId = decoded.userId.replace("STORE_", "");
            const locationExists = await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
            sessionValid = !!locationExists;
        } else {
            // Standard User Verification
            const userExists = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true } });
            sessionValid = !!userExists;
        }
        
        if (!sessionValid) {
            return res.status(401).json({ message: "Institutional session is invalid" });
        }

        req.user = decoded;

        // Wrap next() in context for isolation & auditing
        import("../utils/context").then(({ runWithContext }) => {
            runWithContext(decoded, () => {
                next();
            });
        });
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        next();
    };
};
