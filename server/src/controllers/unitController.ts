import { Request, Response } from "express";
import prisma from "../config/prisma";
import redisClient from "../config/redis";

export const getUnits = async (req: Request, res: Response) => {
    try {
        const units = await prisma.unit.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
        res.json(units);
    } catch (error) {
        res.status(500).json({ message: "Error fetching units" });
    }
};

export const createUnit = async (req: Request, res: Response) => {
    try {
        const { name, symbol } = req.body;
        const unit = await prisma.unit.create({
            data: { name, symbol }
        });
        res.status(201).json(unit);
    } catch (error) {
        res.status(500).json({ message: "Error creating unit" });
    }
};

export const updateUnit = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const unit = await prisma.unit.update({
            where: { id },
            data: req.body
        });
        res.json(unit);
    } catch (error) {
        res.status(500).json({ message: "Error updating unit" });
    }
};

export const deleteUnit = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.unit.delete({ where: { id } });
        res.json({ message: "Unit deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting unit" });
    }
};
