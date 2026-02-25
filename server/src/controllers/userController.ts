import { Request, Response } from "express";
import prisma from "../config/prisma";

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

export const searchUsers = async (req: Request, res: Response) => {
    const term = req.query.search as string || "";
    if (term.length < 3) return res.json([]);
    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: term, mode: "insensitive" } },
                    { phone: { contains: term } },
                ]
            },
            take: 10,
            select: { id: true, name: true, phone: true }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Error searching users" });
    }
};
