import { Router, Request, Response } from "express";
import { updateProfile, getUsersAdmin, updateUserAdmin, getDeliveryPartners, createUserAdmin, bulkIngestUsers } from "../controllers/userController";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateProfileSchema } from "../schemas/authSchemas";
import prisma from "../config/prisma";

const router = Router();

router.put("/profile", authenticate, validate(updateProfileSchema), updateProfile);

// Admin Identity Management
router.get("/admin/all", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), getUsersAdmin);
router.post("/admin/create", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), createUserAdmin);
router.get("/admin/drivers", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), getDeliveryPartners);
router.get("/admin/packers", authenticate, async (req: Request, res: Response) => {
    try {
        const packers = await prisma.user.findMany({
            where: { role: "PACKING", isActive: true },
            select: { id: true, name: true, phone: true }
        });
        res.json(packers);
    } catch (err: any) {
        res.status(500).json({ message: "Failed to fetch packers" });
    }
});
router.patch("/admin/update/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), updateUserAdmin);

// PATCH /api/v1/users/:id — Update any user's basic info (for POS customer edit)
router.patch("/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const { name, phone, email } = req.body;
        const updated = await prisma.user.update({
            where: { id: String(req.params.id) },
            data: {
                ...(name && { name: String(name) }),
                ...(phone && { phone: String(phone) }),
                ...(email && { email: String(email) })
            },
            select: { id: true, name: true, phone: true, email: true, role: true }
        });
        res.json(updated);
    } catch (err: any) {
        if (err.code === 'P2025') return res.status(404).json({ message: "User not found" });
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/v1/users/:id — Delete a user (for POS customer delete)
router.delete("/:id", authenticate, async (req: Request, res: Response) => {
    try {
        await prisma.user.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    } catch (err: any) {
        if (err.code === 'P2025') return res.status(404).json({ message: "User not found" });
        res.status(500).json({ message: err.message });
    }
});

export default router;
