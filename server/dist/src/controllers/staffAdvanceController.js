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
exports.deleteStaffAdvance = exports.updateStaffAdvance = exports.createStaffAdvance = exports.getStaffAdvances = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const getStaffAdvances = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId, staffId, month, year } = req.query;
    try {
        const whereClause = {};
        if (staffId && staffId !== "ALL") {
            whereClause.staffId = String(staffId);
        }
        if (locationId && locationId !== "ALL") {
            whereClause.OR = [
                { locationId: String(locationId) },
                { staff: { locationId: String(locationId) } }
            ];
        }
        if (month && month !== "ALL") {
            whereClause.month = Number(month);
        }
        if (year && year !== "ALL") {
            whereClause.year = Number(year);
        }
        const advances = yield prisma_1.default.staffAdvance.findMany({
            where: whereClause,
            include: {
                staff: { select: { id: true, name: true, phone: true, role: true, baseSalary: true, locationId: true } },
                approvedBy: { select: { id: true, name: true, role: true } },
                location: { select: { id: true, name: true } }
            },
            orderBy: { date: "desc" }
        });
        const totalAdvanceAmount = advances.reduce((acc, a) => acc + Number(a.amount), 0);
        res.json({ advances, totalAdvanceAmount });
    }
    catch (error) {
        next(error);
    }
});
exports.getStaffAdvances = getStaffAdvances;
const createStaffAdvance = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { staffId, amount, date, paymentMethod, notes, month, year, locationId } = req.body;
    const approverId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!staffId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ message: "Staff member and a positive advance amount are required." });
    }
    try {
        const advanceDate = date ? new Date(date) : new Date();
        const advMonth = month ? Number(month) : (advanceDate.getMonth() + 1);
        const advYear = year ? Number(year) : advanceDate.getFullYear();
        const staffUser = yield prisma_1.default.user.findUnique({
            where: { id: String(staffId) },
            select: { locationId: true }
        });
        const targetLocationId = locationId || (staffUser === null || staffUser === void 0 ? void 0 : staffUser.locationId) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId) || null;
        const advance = yield prisma_1.default.staffAdvance.create({
            data: {
                staffId: String(staffId),
                amount: new client_1.Prisma.Decimal(amount),
                date: advanceDate,
                month: advMonth,
                year: advYear,
                paymentMethod: paymentMethod || "CASH",
                status: "PAID",
                notes: notes || null,
                approvedById: approverId || null,
                locationId: targetLocationId
            },
            include: {
                staff: { select: { id: true, name: true, phone: true } },
                approvedBy: { select: { id: true, name: true } }
            }
        });
        res.status(201).json({ message: "Staff salary advance recorded successfully.", advance });
    }
    catch (error) {
        next(error);
    }
});
exports.createStaffAdvance = createStaffAdvance;
const updateStaffAdvance = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status, notes, amount, paymentMethod } = req.body;
    try {
        const advance = yield prisma_1.default.staffAdvance.update({
            where: { id: String(id) },
            data: Object.assign(Object.assign(Object.assign(Object.assign({}, (status && { status: String(status) })), (notes !== undefined && { notes })), (amount && { amount: new client_1.Prisma.Decimal(amount) })), (paymentMethod && { paymentMethod })),
            include: {
                staff: { select: { id: true, name: true, phone: true } }
            }
        });
        res.json({ message: "Salary advance updated successfully.", advance });
    }
    catch (error) {
        next(error);
    }
});
exports.updateStaffAdvance = updateStaffAdvance;
const deleteStaffAdvance = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.staffAdvance.delete({ where: { id: String(id) } });
        res.json({ message: "Salary advance deleted successfully." });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteStaffAdvance = deleteStaffAdvance;
