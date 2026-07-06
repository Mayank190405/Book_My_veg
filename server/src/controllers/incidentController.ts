import { Request, Response } from "express";
import prisma from "../config/prisma";
import logger from "../utils/logger";
import { IncidentStatus, IncidentSeverity } from "@prisma/client";

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

export const listIncidents = async (req: AuthenticatedRequest, res: Response) => {
    const { status, severity, limit = 20, cursor } = req.query;
    const parsedLimit = Math.min(Number(limit) || 20, 100);

    const where: any = {};
    if (status) where.status = status as IncidentStatus;
    if (severity) where.severity = severity as IncidentSeverity;

    try {
        const incidents = await prisma.securityIncident.findMany({
            where,
            take: parsedLimit + 1,
            cursor: cursor ? { id: cursor as string } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                apiKey: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const hasMore = incidents.length > parsedLimit;
        const data = hasMore ? incidents.slice(0, parsedLimit) : incidents;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        res.json({ data, nextCursor });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getIncidentDetail = async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;

    try {
        const incident = await prisma.securityIncident.findUnique({
            where: { id },
            include: {
                apiKey: { select: { id: true, name: true, role: true, locationId: true } },
                assignedTo: { select: { id: true, name: true, email: true, phone: true } },
                comments: {
                    include: {
                        author: { select: { id: true, name: true, role: true } }
                    },
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        if (!incident) {
            return res.status(404).json({ message: "Incident not found." });
        }

        res.json(incident);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateIncident = async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const { status, severity, assignedToId, rootCause, resolution } = req.body;
    const callerId = req.user?.userId;

    try {
        const existing = await prisma.securityIncident.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Incident not found." });
        }

        const isClosing = status === "RESOLVED" || status === "CLOSED";

        const updated = await prisma.securityIncident.update({
            where: { id },
            data: {
                status,
                severity,
                assignedToId,
                rootCause,
                resolution,
                ...(isClosing && { resolvedAt: new Date() })
            },
            include: {
                apiKey: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } }
            }
        });

        // Log actions in security audits
        await prisma.securityAuditLog.create({
            data: {
                tableName: "SecurityIncident",
                attemptedOperation: `INCIDENT_UPDATE_${status || existing.status}`,
                attemptedBy: callerId || "SYSTEM",
                severity: "INFO",
                rawQuerySnippet: `Updated incident ${id} status to ${status || existing.status}, assignee: ${assignedToId || "unchanged"}`
            }
        });

        res.json({
            message: "Incident updated successfully.",
            incident: updated
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const addIncidentComment = async (req: AuthenticatedRequest, res: Response) => {
    const incidentId = req.params.id as string;
    const { content } = req.body;
    const authorId = req.user?.userId;

    if (!content) {
        return res.status(400).json({ message: "Comment content is required." });
    }

    if (!authorId) {
        return res.status(401).json({ message: "Unauthorized." });
    }

    try {
        const comment = await prisma.incidentComment.create({
            data: {
                incidentId,
                authorId,
                content
            },
            include: {
                author: { select: { id: true, name: true, role: true } }
            }
        });

        res.status(201).json(comment);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
