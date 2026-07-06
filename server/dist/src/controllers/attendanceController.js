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
exports.getUserAttendance = exports.getStoreAttendance = exports.markAttendance = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const markAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, locationId, status } = req.body;
    try {
        const attendance = yield prisma_1.default.attendance.create({
            data: {
                userId,
                locationId,
                status: status || "PRESENT"
            }
        });
        res.json(attendance);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.markAttendance = markAttendance;
const getStoreAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId } = req.params;
    const { date } = req.query; // YYYY-MM-DD
    try {
        const start = date ? new Date(date) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        const attendance = yield prisma_1.default.attendance.findMany({
            where: {
                locationId: locationId,
                checkIn: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                user: {
                    select: { name: true, phone: true }
                }
            }
        });
        res.json(attendance);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getStoreAttendance = getStoreAttendance;
const getUserAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    try {
        const attendance = yield prisma_1.default.attendance.findMany({
            where: { userId: userId },
            orderBy: { checkIn: "desc" },
            take: 31
        });
        res.json(attendance);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getUserAttendance = getUserAttendance;
