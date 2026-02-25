import { Router, Request, Response } from "express";
import { DeliveryService } from "../services/deliveryService";

const router = Router();

// POST /api/v1/delivery/assign
router.post("/assign", async (req: Request, res: Response) => {
    try {
        const { orderId, driverId, clusterZone } = req.body;
        if (!orderId) return res.status(400).json({ error: "orderId is required." });
        const assignment = await DeliveryService.assignDriver({ orderId, driverId, clusterZone });
        res.status(201).json(assignment);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/delivery/otp/generate
router.post("/otp/generate", async (req: Request, res: Response) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ error: "orderId is required." });
        const result = await DeliveryService.generateOTP(orderId);
        res.json({ orderId, ...result });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/delivery/otp/verify
router.post("/otp/verify", async (req: Request, res: Response) => {
    try {
        const { orderId, otp, driverId } = req.body;
        if (!orderId || !otp || !driverId) {
            return res.status(400).json({ error: "orderId, otp, driverId are required." });
        }
        const result = await DeliveryService.verifyOTPAndDeliver(orderId, otp, driverId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/v1/delivery/assets?driverId=
router.get("/assets", async (req: Request, res: Response) => {
    try {
        const { driverId } = req.query as any;
        if (!driverId) return res.status(400).json({ error: "driverId is required." });
        const assets = await DeliveryService.getDriverAssets(driverId);
        res.json(assets);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/delivery/assets/assign
router.post("/assets/assign", async (req: Request, res: Response) => {
    try {
        const { assetId, driverId } = req.body;
        const result = await DeliveryService.assignAsset(assetId, driverId);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/delivery/assets/return
router.post("/assets/return", async (req: Request, res: Response) => {
    try {
        const { assetId } = req.body;
        const result = await DeliveryService.returnAsset(assetId);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/delivery/cash/eod
router.post("/cash/eod", async (req: Request, res: Response) => {
    try {
        const { driverId, deposited, notes } = req.body;
        if (!driverId || deposited == null) {
            return res.status(400).json({ error: "driverId and deposited amount are required." });
        }
        const result = await DeliveryService.submitEOD({ driverId, deposited: parseFloat(deposited), notes });
        res.status(201).json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/delivery/route?driverId=
router.get("/route", async (req: Request, res: Response) => {
    try {
        const { driverId } = req.query as any;
        if (!driverId) return res.status(400).json({ error: "driverId is required." });
        const route = await DeliveryService.getRoute(driverId);
        res.json(route);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
