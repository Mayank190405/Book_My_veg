import { Request, Response, NextFunction } from "express";
import { driverService } from "../services/driverService";

export const getAssignedDeliveries = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const driverId = req.params.driverId as string;
        const deliveries = await driverService.getAssignedDeliveries(driverId);
        res.json(deliveries);
    } catch (error) {
        next(error);
    }
};

export const pickUpOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assignmentId = req.params.assignmentId as string;
        const result = await driverService.pickUpOrder(assignmentId);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const generateHDFCLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orderId = req.params.orderId as string;
        const result = await driverService.generateHDFCLink(orderId);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const completeDelivery = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assignmentId = req.params.assignmentId as string;
        const { otp } = req.body;
        const result = await driverService.completeDelivery(assignmentId, otp);
        res.json(result);
    } catch (error) {
        next(error);
    }
};
