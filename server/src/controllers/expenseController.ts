import { Request, Response, NextFunction } from "express";
import { expenseService } from "../services/expenseService";
import { ExpenseCategory } from "@prisma/client";

export const recordExpense = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const expense = await expenseService.recordExpense({
            ...req.body,
            date: req.body.date ? new Date(req.body.date) : undefined
        });
        res.status(201).json(expense);
    } catch (error) {
        next(error);
    }
};

export const getStoreExpenses = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { locationId } = req.params;
        const { startDate, endDate } = req.query;
        const expenses = await expenseService.getStoreExpenses(
            locationId as string,
            new Date(req.query.startDate as string),
            new Date(req.query.endDate as string)
        );
        res.json(expenses);
    } catch (error) {
        next(error);
    }
};

export const getGlobalSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { startDate, endDate } = req.query;
        const summary = await expenseService.getGlobalExpenseSummary(
            new Date(req.query.startDate as string),
            new Date(req.query.endDate as string)
        );
        res.json(summary);
    } catch (error) {
        next(error);
    }
};
