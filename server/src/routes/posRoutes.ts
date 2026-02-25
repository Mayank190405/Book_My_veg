import { Router, Request, Response } from "express";
import { QRParserService, WeightCheckService, KhataService } from "../services/posService";
import prisma from "../config/prisma";
import { suspendOrder, getSuspendedOrders, deleteSuspendedOrder } from "../controllers/suspendedOrderController";
import { openShift, closeShift, getShiftStatus } from "../controllers/shiftController";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();
router.use(authenticate);
router.use(requirePermission("pos:operate"));

// ─── QR Parser ────────────────────────────────────────────────────
router.post("/parse-qr", async (req: Request, res: Response) => {
    try {
        const { qrString, channel = "POS", mergeMode = false } = req.body;
        if (!qrString) return res.status(400).json({ error: "qrString is required." });
        const result = await QRParserService.parseQRBill(qrString.trim(), channel);
        if (mergeMode) {
            result.mergedLines = QRParserService.mergeLines(result.lines);
        }
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Weight Check ─────────────────────────────────────────────────
router.post("/weight-check", async (req: Request, res: Response) => {
    try {
        const { sessionRef, expectedWeight, actualWeight, staffId } = req.body;
        if (!sessionRef || expectedWeight == null || actualWeight == null) {
            return res.status(400).json({ error: "sessionRef, expectedWeight, actualWeight are required." });
        }
        const result = await WeightCheckService.verifyWeight({
            sessionRef,
            expectedWeight: parseFloat(expectedWeight),
            actualWeight: parseFloat(actualWeight),
            staffId
        });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Khata (Credit) ───────────────────────────────────────────────
router.get("/khata/:userId", async (req: Request, res: Response) => {
    try {
        const userId = req.params["userId"] as string;
        const khata = await KhataService.getOrCreate(userId);
        const full = await KhataService.getKhata(userId);
        res.json(full || khata);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/khata/:userId/check", async (req: Request, res: Response) => {
    try {
        const userId = req.params["userId"] as string;
        const amount = parseFloat(req.query.amount as string);
        if (!amount) return res.status(400).json({ error: "amount query param required." });
        const result = await KhataService.canMakePurchase(userId, amount);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/khata/:userId/purchase", async (req: Request, res: Response) => {
    try {
        const userId = req.params["userId"] as string;
        const { amount, orderId, staffId } = req.body;
        const result = await KhataService.addPurchase(userId, parseFloat(amount), orderId, staffId);
        res.status(201).json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/khata/:userId/payment", async (req: Request, res: Response) => {
    try {
        const userId = req.params["userId"] as string;
        const { amount, staffId, notes } = req.body;
        const result = await KhataService.recordPayment(userId, parseFloat(amount), staffId, notes);
        res.status(201).json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.patch("/khata/:userId/limit", async (req: Request, res: Response) => {
    try {
        const userId = req.params["userId"] as string;
        const { creditLimit, staffId } = req.body;
        const result = await KhataService.updateCreditLimit(userId, parseFloat(creditLimit), staffId);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Live Price ───────────────────────────────────────────────────
router.get("/products/:id/live-price", async (req: Request, res: Response) => {
    try {
        const productId = req.params["id"] as string;
        const channel = (req.query.channel as string | undefined) || "POS";
        const pricing = await prisma.pricing.findFirst({
            where: { productId, channel: channel as any, isActive: true },
            orderBy: { startDate: "desc" }
        });
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { basePrice: true, name: true }
        });
        res.json({
            productId,
            channel,
            livePrice: pricing?.price ?? product?.basePrice ?? 0,
            source: pricing ? "PRICING_TABLE" : "BASE_PRICE"
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Shift Management ─────────────────────────────────────────────
router.post("/shifts/open", openShift);
router.post("/shifts/:id/close", closeShift);
router.get("/shifts/status/:userId", getShiftStatus);

// ─── Suspended Orders ─────────────────────────────────────────────
router.post("/suspend", suspendOrder);
router.get("/suspended", getSuspendedOrders);
router.delete("/suspended/:id", deleteSuspendedOrder);

// ─── Customer Search & Quick Add ──────────────────────────────────
router.get("/customers/search", async (req: Request, res: Response) => {
    const { query } = req.query;
    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { phone: { contains: query as string } },
                    { name: { contains: query as string, mode: "insensitive" } }
                ]
            },
            take: 10
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Error searching customers" });
    }
});

router.post("/customers", async (req: Request, res: Response) => {
    const { name, phone, email } = req.body;
    try {
        const user = await prisma.user.create({
            data: { name, phone, email, role: "USER" }
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: "Error creating customer" });
    }
});

export default router;
