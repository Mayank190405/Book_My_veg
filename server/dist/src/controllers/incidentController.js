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
exports.addIncidentComment = exports.updateIncident = exports.getIncidentDetail = exports.listIncidents = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const listIncidents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { status, severity, limit = 20, cursor } = req.query;
    const parsedLimit = Math.min(Number(limit) || 20, 100);
    const where = {};
    if (status)
        where.status = status;
    if (severity)
        where.severity = severity;
    try {
        const incidents = yield prisma_1.default.securityIncident.findMany({
            where,
            take: parsedLimit + 1,
            cursor: cursor ? { id: cursor } : undefined,
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.listIncidents = listIncidents;
const getIncidentDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.params.id;
    try {
        const incident = yield prisma_1.default.securityIncident.findUnique({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getIncidentDetail = getIncidentDetail;
const updateIncident = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = req.params.id;
    const { status, severity, assignedToId, rootCause, resolution } = req.body;
    const callerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    try {
        const existing = yield prisma_1.default.securityIncident.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Incident not found." });
        }
        const isClosing = status === "RESOLVED" || status === "CLOSED";
        const updated = yield prisma_1.default.securityIncident.update({
            where: { id },
            data: Object.assign({ status,
                severity,
                assignedToId,
                rootCause,
                resolution }, (isClosing && { resolvedAt: new Date() })),
            include: {
                apiKey: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } }
            }
        });
        // Log actions in security audits
        yield prisma_1.default.securityAuditLog.create({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateIncident = updateIncident;
const addIncidentComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const incidentId = req.params.id;
    const { content } = req.body;
    const authorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!content) {
        return res.status(400).json({ message: "Comment content is required." });
    }
    if (!authorId) {
        return res.status(401).json({ message: "Unauthorized." });
    }
    try {
        const comment = yield prisma_1.default.incidentComment.create({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.addIncidentComment = addIncidentComment;
