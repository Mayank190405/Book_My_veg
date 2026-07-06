import { Request, Response } from "express";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string };
}

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { name, email } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        // Validate email uniqueness if changing email
        if (email) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing && existing.id !== userId) {
                return res.status(409).json({ message: "Email already in use" });
            }
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                email,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
            }
        });

        res.json(user);
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Error updating profile" });
    }
};

export const getUsersAdmin = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caller = req.user;
        const where: any = {};
        
        // Institutional Sovereignty: Hub Managers only see their own regional staff
        if (caller?.role === "STORE_ADMIN") {
            let targetLocationId = null;

            if (caller.userId.startsWith("STORE_")) {
                // Virtual Institutional User
                targetLocationId = caller.userId.replace("STORE_", "");
            } else {
                // Physical Admin User
                const admin = await prisma.user.findUnique({ where: { id: caller.userId } });
                targetLocationId = admin?.locationId;
            }

            if (targetLocationId) {
                where.locationId = targetLocationId;
            } else {
                return res.json([]);
            }
        }

        const users = await prisma.user.findMany({
            where,
            include: {
                location: { select: { id: true, name: true } },
                orders: { select: { id: true } },
                addresses: { where: { isDefault: true }, take: 1 }
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createUserAdmin = async (req: AuthenticatedRequest, res: Response) => {
    const { phone, name, email, role, locationId, password, baseSalary, joiningDate } = req.body;
    const caller = req.user;

    try {
        // Validation: Hub Managers can only create staff for their own hub
        let targetLocationId = locationId;
        if (caller?.role === "STORE_ADMIN") {
            if (caller.userId.startsWith("STORE_")) {
                // Virtual Institutional User
                targetLocationId = caller.userId.replace("STORE_", "");
            } else {
                // Physical Admin User
                const admin = await prisma.user.findUnique({ where: { id: caller.userId } });
                targetLocationId = admin?.locationId;
            }
            
            // Restrict roles a Hub Manager can grant
            const allowedRoles = ["PACKING", "DELIVERY_PARTNER", "POS_OPERATOR", "USER", "MANAGER"];
            if (!allowedRoles.includes(role)) {
                return res.status(403).json({ message: "Hub Managers can only onboard Operators, Packers, and Drivers." });
            }
        }

        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        const user = await prisma.user.create({
            data: {
                phone,
                name,
                email,
                role,
                locationId: targetLocationId,
                password: hashedPassword,
                isActive: true,
                baseSalary: baseSalary ? parseFloat(baseSalary) : null,
                joiningDate: joiningDate ? new Date(joiningDate) : null
            },
            include: {
                location: { select: { id: true, name: true } }
            }
        });

        res.status(201).json(user);
    } catch (error: any) {
        if (error.code === 'P2002') return res.status(409).json({ message: "Phone number already registered in merchandise grid." });
        res.status(500).json({ error: error.message });
    }
};

export const updateUserAdmin = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { role, locationId, password, isActive, name, email, baseSalary, joiningDate } = req.body;
    const caller = req.user;

    try {
        // Institutional Sovereignty Check
        const targetUser = await prisma.user.findUnique({ where: { id: id as string } });
        if (!targetUser) return res.status(404).json({ message: "Staff record not found." });

        if (caller?.role === "STORE_ADMIN") {
            let adminLocationId = null;
            if (caller.userId.startsWith("STORE_")) {
                adminLocationId = caller.userId.replace("STORE_", "");
            } else {
                const admin = await prisma.user.findUnique({ where: { id: caller.userId } });
                adminLocationId = admin?.locationId;
            }
            
            // Managers can only edit staff assigned to their own regional hub
            if (targetUser.locationId !== adminLocationId || (locationId && locationId !== adminLocationId)) {
                return res.status(403).json({ message: "Hub managers are restricted to managing local hub staff only." });
            }

            // Restrict role elevation during update
            const restrictedRoles = ["ADMIN", "STORE_ADMIN", "CENTER_HEAD"];
            if (role && restrictedRoles.includes(role)) {
                return res.status(403).json({ message: "Access level orchestration restricted for this role profile." });
            }
        }

        let hashedPassword = undefined;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: id as string },
            data: {
                ...(role && { role }),
                locationId: (caller?.role === "STORE_ADMIN") ? targetUser.locationId : (locationId || null),
                isActive,
                name,
                email,
                joiningDate: joiningDate ? new Date(joiningDate) : undefined,
                baseSalary: baseSalary !== undefined ? (baseSalary ? parseFloat(baseSalary) : null) : undefined,
                ...(hashedPassword && { password: hashedPassword })
            },
            include: {
                location: { select: { id: true, name: true } }
            }
        });
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getDeliveryPartners = async (req: Request, res: Response) => {
    try {
        const drivers = await prisma.user.findMany({
            where: { role: "DELIVERY_PARTNER", isActive: true },
            select: { id: true, name: true, phone: true },
            orderBy: { name: "asc" }
        });
        res.json(drivers);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const bulkIngestUsers = async (req: AuthenticatedRequest, res: Response) => {
    const { users } = req.body;
    const caller = req.user;

    if (!Array.isArray(users)) return res.status(400).json({ message: "Invalid payload format." });

    try {
        let adminLocationId = null;
        if (caller?.role === "STORE_ADMIN") {
            if (caller.userId.startsWith("STORE_")) {
                adminLocationId = caller.userId.replace("STORE_", "");
            } else {
                const admin = await prisma.user.findUnique({ where: { id: caller.userId } });
                adminLocationId = admin?.locationId;
            }
        }

        const results = { success: 0, updated: 0, failed: 0 };
        
        // Use a transaction for stability but process individually for granular upsert reporting
        // For very large sets (500+), consider Promise.all or chunking
        for (const userData of users) {
            try {
                const { phone, name, email, profileAddress, totalDue, role, locationId, isActive } = userData;
                
                // Isolation constraint
                const targetLocationId = adminLocationId || locationId || null;

                const user = await prisma.user.upsert({
                    where: { phone: phone.toString() },
                    update: {
                        name,
                        email,
                        profileAddress,
                        totalDue: totalDue ? parseFloat(totalDue) : undefined,
                        isActive: isActive !== undefined ? isActive : undefined,
                        // hub managers cannot change role or location of existing users in bulk to prevent hijacking
                        ...(caller?.role === "ADMIN" && { role, locationId: targetLocationId })
                    },
                    create: {
                        phone: phone.toString(),
                        name,
                        email,
                        profileAddress,
                        totalDue: totalDue ? parseFloat(totalDue) : 0,
                        role: role || "USER",
                        locationId: targetLocationId,
                        isActive: true,
                        password: userData.password || "user123"
                    }
                });

                // Check if it was an update or create (Prisma upsert doesn't tell directly without checking timestamps)
                results.success++;
            } catch (err) {
                console.error("Bulk Item Failure:", err);
                results.failed++;
            }
        }

        res.json({ message: "Bulk Ingestion Finalized.", ...results });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
