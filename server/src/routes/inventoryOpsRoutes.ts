import { Router, Request, Response } from "express";
import { MandiRateService, MortalityService, StockTransferService, PredictiveLowStockService } from "../services/inventoryOperationsService";
import { v4 as uuidv4 } from "uuid";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { requireStoreAccess } from "../middleware/isolation";

const router = Router();
router.use(authenticate);

// ─── Mandi Rates ───────────────────────────────────────────────
// POST /api/v1/inventory/mandi-rates  → bulk save today's purchase rates
router.post("/mandi-rates", requirePermission("inventory:write"), requireStoreAccess(), async (req: Request, res: Response) => {
    try {
        const { rates, staffId } = req.body;
        if (!Array.isArray(rates) || rates.length === 0) {
            return res.status(400).json({ error: "rates[] array is required." });
        }
        const result = await MandiRateService.saveBulkRates(
            rates.map((r: any) => ({ ...r, staffId: staffId || r.staffId }))
        );
        res.json({ success: true, count: result.length, rates: result });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/inventory/mandi-rates?date=&productId=&channel=
router.get("/mandi-rates", requirePermission("inventory:read"), requireStoreAccess(), async (req: Request, res: Response) => {
    try {
        const date = req.query.date as string | undefined;
        const productId = req.query.productId as string | undefined;
        const channel = req.query.channel as string | undefined;
        const rates = await MandiRateService.getRates({
            date: date ? new Date(date) : undefined,
            productId,
            channel
        });
        res.json(rates);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Mortality / Natural Loss ───────────────────────────────────
// POST /api/v1/inventory/mortality
router.post("/mortality", requirePermission("inventory:write"), requireStoreAccess(), async (req: Request, res: Response) => {
    try {
        const { productId, variantId, locationId, batchId, quantity, reason, notes, staffId } = req.body;
        if (!productId || !locationId || !quantity || !reason) {
            return res.status(400).json({ error: "productId, locationId, quantity, reason are required." });
        }
        const log = await MortalityService.logMortality({
            productId, variantId, locationId, batchId,
            quantity: parseFloat(quantity),
            reason, notes, staffId,
            traceId: uuidv4()
        });
        res.status(201).json(log);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/inventory/mortality?locationId=&from=&to=
router.get("/mortality", requirePermission("inventory:read"), requireStoreAccess(), async (req: Request, res: Response) => {
    try {
        const locationId = req.query.locationId as string | undefined;
        const from = req.query.from as string | undefined;
        const to = req.query.to as string | undefined;
        const history = await MortalityService.getHistory({
            locationId,
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined
        });
        res.json(history);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Stock Transfers ─────────────────────────────────────────────
// POST /api/v1/inventory/transfer
router.post("/transfer", requirePermission("inventory:write"), requireStoreAccess(), async (req: Request, res: Response) => {
    try {
        const { productId, variantId, fromLocationId, toLocationId, quantity, initiatedById, notes } = req.body;
        if (!productId || !fromLocationId || !toLocationId || !quantity) {
            return res.status(400).json({ error: "productId, fromLocationId, toLocationId, quantity are required." });
        }
        const transfer = await StockTransferService.initiateTransfer({
            productId, variantId, fromLocationId, toLocationId,
            quantity: parseFloat(quantity),
            initiatedById, notes
        });
        res.status(201).json(transfer);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/v1/inventory/transfer/:id/complete
router.patch("/transfer/:id/complete", requirePermission("inventory:write"), requireStoreAccess(), async (req: Request, res: Response) => {
    try {
        const { staffId } = req.body;
        const result = await StockTransferService.completeTransfer(req.params.id as string, staffId);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/inventory/transfer?locationId=&status=
router.get("/transfer", async (req: Request, res: Response) => {
    try {
        const locationId = req.query.locationId as string | undefined;
        const status = req.query.status as string | undefined;
        const transfers = await StockTransferService.getTransfers({ locationId, status });
        res.json(transfers);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Predictive Low Stock ─────────────────────────────────────────
// GET /api/v1/inventory/low-stock-alerts?locationId=
router.get("/low-stock-alerts", async (req: Request, res: Response) => {
    try {
        const locationId = req.query.locationId as string;
        if (!locationId) return res.status(400).json({ error: "locationId is required." });
        const alerts = await PredictiveLowStockService.getLowStockAlerts(locationId);
        res.json({ count: alerts.length, alerts });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
