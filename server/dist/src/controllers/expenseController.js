"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoreExpenses = exports.addStoreExpense = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const addStoreExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log(">>>>>>>>>> ADD EXPENSE REACHED <<<<<<<<<<");
    console.log("REQUEST BODY:", JSON.stringify(req.body));
    console.log("AUTH USER:", JSON.stringify(req.user));
    const { amount, category, description, receiptUrl, locationId: bodyLocationId, staffId: bodyStaffId, denominations } = req.body;
    // Resolve Identity: Use provided ID or fall back to authenticated user session
    const staffId = bodyStaffId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
    const locationId = bodyLocationId || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId);
    console.log(`[Expense] Adding expense: Amount=${amount}, Location=${locationId}, Staff=${staffId}`);
    if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ error: "Valid amount is required" });
    }
    if (!staffId) {
        return res.status(400).json({ error: "Staff identity required" });
    }
    if (!locationId || locationId === "ALL") {
        return res.status(400).json({ error: "A valid specific location ID is required to record expenses" });
    }
    try {
        // Verify staff exists if provided
        let verifiedStaffId = null;
        if (staffId) {
            const user = yield prisma_1.default.user.findUnique({ where: { id: String(staffId) }, select: { id: true } });
            if (user)
                verifiedStaffId = user.id;
        }
        console.log(`[Expense Debug] Attempting Prisma Create with:`, {
            locationId: String(locationId),
            staffId: verifiedStaffId,
            amount: parseFloat(amount),
            category: category || "MISC",
            description,
            receiptUrl,
            denominations
        });
        const expense = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const exp = yield tx.storeExpense.create({
                data: {
                    locationId: String(locationId),
                    staffId: verifiedStaffId,
                    amount: parseFloat(amount),
                    category: category || "MISC",
                    description,
                    receiptUrl,
                    denominations: denominations || null
                }
            });
            if (denominations) {
                const activeShift = yield tx.cashierShift.findFirst({
                    where: { locationId: String(locationId), status: "OPEN" }
                });
                if (activeShift) {
                    const shiftDenominations = activeShift.currentDenominations
                        ? (typeof activeShift.currentDenominations === "string"
                            ? JSON.parse(activeShift.currentDenominations)
                            : activeShift.currentDenominations)
                        : {};
                    const denominationsKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
                    const updatedDenominations = {};
                    for (const key of denominationsKeys) {
                        const currentCount = Number(shiftDenominations[key] || 0);
                        const expenseCount = Number(denominations[key] || 0);
                        updatedDenominations[key] = Math.max(0, currentCount - expenseCount);
                    }
                    yield tx.cashierShift.update({
                        where: { id: activeShift.id },
                        data: {
                            currentDenominations: updatedDenominations
                        }
                    });
                }
            }
            return exp;
        }));
        res.json(expense);
    }
    catch (error) {
        console.error("[Expense Critical Error]", {
            message: error.message,
            stack: error.stack,
            meta: error.meta,
            code: error.code,
            full: JSON.stringify(error, null, 2)
        });
        res.status(500).json({
            error: "Prisma Operation Failed",
            details: error.message,
            code: error.code
        });
    }
});
exports.addStoreExpense = addStoreExpense;
const getStoreExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const locationId = req.params.locationId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.locationId);
    if (!locationId) {
        return res.status(400).json({ error: "Location ID required" });
    }
    try {
        const expenses = yield prisma_1.default.storeExpense.findMany({
            where: { locationId: locationId },
            include: {
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(expenses);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getStoreExpenses = getStoreExpenses;
