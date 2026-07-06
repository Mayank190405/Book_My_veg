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
exports.deleteUnit = exports.updateUnit = exports.createUnit = exports.getUnits = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const getUnits = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const units = yield prisma_1.default.unit.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
        res.json(units);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching units" });
    }
});
exports.getUnits = getUnits;
const createUnit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, symbol } = req.body;
        const unit = yield prisma_1.default.unit.create({
            data: { name, symbol }
        });
        res.status(201).json(unit);
    }
    catch (error) {
        res.status(500).json({ message: "Error creating unit" });
    }
});
exports.createUnit = createUnit;
const updateUnit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.params.id;
    try {
        const unit = yield prisma_1.default.unit.update({
            where: { id },
            data: req.body
        });
        res.json(unit);
    }
    catch (error) {
        res.status(500).json({ message: "Error updating unit" });
    }
});
exports.updateUnit = updateUnit;
const deleteUnit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.params.id;
    try {
        yield prisma_1.default.unit.delete({ where: { id } });
        res.json({ message: "Unit deleted" });
    }
    catch (error) {
        res.status(500).json({ message: "Error deleting unit" });
    }
});
exports.deleteUnit = deleteUnit;
