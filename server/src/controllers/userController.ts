import { Request, Response } from "express";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";
import logger from "../utils/logger";

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
            const allowedRoles = ["PACKING", "DELIVERY_PARTNER", "POS_OPERATOR", "USER", "MANAGER", "PURCHASE_MANAGER"];
            if (!allowedRoles.includes(role)) {
                return res.status(403).json({ message: "Hub Managers can only onboard Operators, Packers, and Drivers." });
            }
        }

        const cleanPhone = phone ? String(phone).trim().replace(/\D/g, "") : "";
        if (!cleanPhone) {
            return res.status(400).json({ message: "A valid mobile phone number is required." });
        }

        const cleanEmail = (email && String(email).trim().length > 0) ? String(email).trim().toLowerCase() : null;

        const hashedPassword = password && String(password).trim().length > 0 
            ? await bcrypt.hash(String(password).trim(), 10) 
            : undefined;

        // Check if user with phone already exists
        const existingByPhone = await prisma.user.findUnique({
            where: { phone: cleanPhone },
            include: { location: { select: { id: true, name: true } } }
        });

        if (existingByPhone) {
            // Update and elevate existing user profile
            const user = await prisma.user.update({
                where: { id: existingByPhone.id },
                data: {
                    name: name ? String(name).trim() : existingByPhone.name,
                    email: cleanEmail !== undefined ? cleanEmail : existingByPhone.email,
                    role: role || existingByPhone.role,
                    locationId: targetLocationId || existingByPhone.locationId,
                    ...(hashedPassword ? { password: hashedPassword } : {}),
                    isActive: true,
                    baseSalary: baseSalary ? parseFloat(String(baseSalary)) : existingByPhone.baseSalary,
                    joiningDate: joiningDate ? new Date(joiningDate) : existingByPhone.joiningDate
                },
                include: {
                    location: { select: { id: true, name: true } }
                }
            });

            return res.status(200).json(user);
        }

        // Check if email already used by another account
        if (cleanEmail) {
            const existingByEmail = await prisma.user.findUnique({
                where: { email: cleanEmail }
            });
            if (existingByEmail) {
                return res.status(409).json({ message: "Email address already registered with another user." });
            }
        }

        const user = await prisma.user.create({
            data: {
                phone: cleanPhone,
                name: name ? String(name).trim() : null,
                email: cleanEmail,
                role: role || "USER",
                locationId: targetLocationId,
                password: hashedPassword,
                isActive: true,
                baseSalary: baseSalary ? parseFloat(String(baseSalary)) : null,
                joiningDate: joiningDate ? new Date(joiningDate) : null
            },
            include: {
                location: { select: { id: true, name: true } }
            }
        });

        res.status(201).json(user);
    } catch (error: any) {
        if (error.code === 'P2002') {
            const targetField = error.meta?.target ? ` (${Array.isArray(error.meta.target) ? error.meta.target.join(", ") : error.meta.target})` : "";
            return res.status(409).json({ message: `Unique constraint conflict on user registry${targetField}.` });
        }
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
        if (password && String(password).trim().length > 0) {
            hashedPassword = await bcrypt.hash(String(password).trim(), 10);
        }

        // Clean email value (convert empty strings to null or omit to avoid P2002 unique error)
        const cleanEmail = (email !== undefined && String(email).trim().length > 0) ? String(email).trim() : (email === "" ? null : undefined);

        // Clean joiningDate (check for valid date string)
        let parsedJoiningDate: Date | null | undefined = undefined;
        if (joiningDate !== undefined) {
            if (!joiningDate) {
                parsedJoiningDate = null;
            } else {
                const d = new Date(joiningDate);
                if (!isNaN(d.getTime())) {
                    parsedJoiningDate = d;
                }
            }
        }

        const updateData: any = {};
        if (role) updateData.role = role;
        if (caller?.role !== "STORE_ADMIN" && locationId !== undefined) {
            updateData.locationId = locationId ? String(locationId) : null;
        }
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        if (name !== undefined && String(name).trim().length > 0) updateData.name = String(name).trim();
        if (cleanEmail !== undefined) updateData.email = cleanEmail;
        if (parsedJoiningDate !== undefined) updateData.joiningDate = parsedJoiningDate;
        if (baseSalary !== undefined) updateData.baseSalary = baseSalary ? parseFloat(String(baseSalary)) : null;
        if (hashedPassword) updateData.password = hashedPassword;

        const user = await prisma.user.update({
            where: { id: id as string },
            data: updateData,
            include: {
                location: { select: { id: true, name: true } }
            }
        });
        res.json(user);
    } catch (error: any) {
        logger.error(`[updateUserAdmin Error] User ID: ${id} -> ${error.message}`);
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Email or phone number already in use by another account." });
        }
        res.status(500).json({ error: error.message || "Failed to update user profile" });
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
