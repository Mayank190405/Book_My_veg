import { Request, Response, NextFunction } from "express";
import { packerService } from "../services/packerService";

export const getAssignedOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const packerId = req.params.packerId as string;
        const orders = await packerService.getAssignedOrders(packerId);
        res.json(orders);
    } catch (error) {
        next(error);
    }
};

export const completePacking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orderId = req.params.orderId as string;
        const result = await packerService.completePacking(orderId, req.body);
        res.json(result);
    } catch (error) {
        next(error);
    }
};
