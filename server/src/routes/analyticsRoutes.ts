import { Router, Request, Response } from "express";
import { AnalyticsService, WhatsAppBotService } from "../services/analyticsService";

const router = Router();

// ─── Real-Time Dashboard ──────────────────────────────────────────
// GET /api/v1/analytics/dashboard?locationId=&date=
router.get("/dashboard", async (req: Request, res: Response) => {
    try {
        const { locationId, date } = req.query as any;
        if (!locationId) return res.status(400).json({ error: "locationId is required." });
        const data = await AnalyticsService.getDashboard(locationId, date ? new Date(date) : undefined);
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/analytics/pnl?locationId=&startDate=&endDate=
router.get("/pnl", async (req: Request, res: Response) => {
    try {
        const { locationId, startDate, endDate } = req.query as any;
        const pnl = await AnalyticsService.getPnL(
            locationId,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
        );
        res.json(pnl);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Global Super Admin Views ─────────────────────────────────────
// GET /api/v1/analytics/global/inventory
router.get("/global/inventory", async (req: Request, res: Response) => {
    try {
        const data = await AnalyticsService.getGlobalInventoryStatus();
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/analytics/global/sales?startDate=&endDate=
router.get("/global/sales", async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query as any;
        const data = await AnalyticsService.getGlobalSalesReport(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
        );
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/analytics/global/khata
router.get("/global/khata", async (req: Request, res: Response) => {
    try {
        const data = await AnalyticsService.getKhataOversight();
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/analytics/global/costs
router.get("/global/costs", async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query as any;
        const data = await AnalyticsService.getGlobalCosts(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
        );
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Staff Leaderboard ────────────────────────────────────────────
// GET /api/v1/analytics/leaderboard?from=&to=
router.get("/leaderboard", async (req: Request, res: Response) => {
    try {
        const { from, to } = req.query as any;
        const board = await AnalyticsService.getLeaderboard(
            from ? new Date(from) : undefined,
            to ? new Date(to) : undefined
        );
        res.json(board);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/analytics/staff/log-packing
router.post("/staff/log-packing", async (req: Request, res: Response) => {
    try {
        const { staffId, packTimeMin, hasError = false } = req.body;
        if (!staffId || packTimeMin == null) {
            return res.status(400).json({ error: "staffId and packTimeMin are required." });
        }
        await AnalyticsService.logPackingPerformance(staffId, parseFloat(packTimeMin), hasError);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── WhatsApp Bot Triggers ────────────────────────────────────────
// POST /api/v1/analytics/whatsapp/morning-stock
router.post("/whatsapp/morning-stock", async (req: Request, res: Response) => {
    try {
        const { locationId, recipientPhone } = req.body;
        if (!locationId || !recipientPhone) {
            return res.status(400).json({ error: "locationId and recipientPhone required." });
        }
        const payload = await WhatsAppBotService.sendMorningStock(locationId, recipientPhone);
        // TODO: wire to actual WhatsApp send API
        res.json({ success: true, payload });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/analytics/whatsapp/evening-summary
router.post("/whatsapp/evening-summary", async (req: Request, res: Response) => {
    try {
        const { locationId, recipientPhone } = req.body;
        if (!locationId || !recipientPhone) {
            return res.status(400).json({ error: "locationId and recipientPhone required." });
        }
        const payload = await WhatsAppBotService.sendEveningSummary(locationId, recipientPhone);
        res.json({ success: true, payload });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/analytics/whatsapp/bill/:orderId
router.post("/whatsapp/bill/:orderId", async (req: Request, res: Response) => {
    try {
        const payload = await WhatsAppBotService.sendBill(req.params.orderId as string);
        res.json({ success: true, payload });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/analytics/whatsapp/refund/:orderId
router.post("/whatsapp/refund/:orderId", async (req: Request, res: Response) => {
    try {
        const { refundAmount } = req.body;
        const payload = await WhatsAppBotService.sendRefundAlert(req.params.orderId as string, parseFloat(refundAmount));
        res.json({ success: true, payload });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
