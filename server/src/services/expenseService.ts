import prisma from "../config/prisma";
import { Prisma, ExpenseCategory } from "@prisma/client";

export const expenseService = {
    /**
     * Record a store expense.
     */
    async recordExpense(data: {
        locationId: string;
        category: ExpenseCategory;
        amount: number;
        description?: string;
        referenceId?: string;
        date?: Date;
    }) {
        return await prisma.storeExpense.create({
            data: {
                locationId: data.locationId,
                category: data.category,
                amount: new Prisma.Decimal(data.amount),
                description: data.description,
                referenceId: data.referenceId,
                date: data.date || new Date()
            }
        });
    },

    /**
     * Get expenses for a location within a date range.
     */
    async getStoreExpenses(locationId: string, startDate: Date, endDate: Date) {
        return await prisma.storeExpense.findMany({
            where: {
                locationId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { date: "desc" }
        });
    },

    /**
     * Get global expense summary by category.
     */
    async getGlobalExpenseSummary(startDate: Date, endDate: Date) {
        const summary = await prisma.storeExpense.groupBy({
            by: ["category"],
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _sum: {
                amount: true
            }
        });
        return summary;
    }
};
