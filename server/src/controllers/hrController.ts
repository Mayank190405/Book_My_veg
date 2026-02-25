import { Request, Response, NextFunction } from "express";
import { hrService } from "../services/hrService";
import logger from "../utils/logger";

export const checkIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId, locationId } = req.body;
        const attendance = await hrService.checkIn(userId, locationId);
        res.status(201).json(attendance);
    } catch (error) {
        next(error);
    }
};

export const checkOut = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { attendanceId } = req.body;
        const attendance = await hrService.checkOut(attendanceId);
        res.json(attendance);
    } catch (error) {
        next(error);
    }
};

export const recordSalary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payment = await hrService.recordSalaryPayment({
            ...req.body,
            periodStart: new Date(req.body.periodStart),
            periodEnd: new Date(req.body.periodEnd)
        });
        res.status(201).json(payment);
    } catch (error) {
        next(error);
    }
};

export const getAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = req.params;
        const records = await hrService.getAttendance(
            userId as string,
            new Date(req.query.startDate as string),
            new Date(req.query.endDate as string)
        );
        res.json(records);
    } catch (error) {
        next(error);
    }
};

export const listStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const locationId = req.query.locationId as string | undefined;
        const staff = await hrService.getAllStaff(locationId);
        res.json(staff);
    } catch (error) {
        next(error);
    }
};

export const updateStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.userId as string;
        const staff = await hrService.updateStaff(userId, {
            ...req.body,
            joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : undefined,
            leavingDate: req.body.leavingDate ? new Date(req.body.leavingDate) : undefined,
        });
        res.json(staff);
    } catch (error) {
        next(error);
    }
};
