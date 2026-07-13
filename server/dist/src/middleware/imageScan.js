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
exports.scanImageUpload = void 0;
exports.validateMagicBytes = validateMagicBytes;
exports.scanForThreats = scanForThreats;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const io_1 = require("../sockets/io");
// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Allowed extensions and MIME types
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
// Setup Multer memory storage
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: MAX_FILE_SIZE }
});
// Magic byte signatures for image formats
const SIGNATURES = {
    jpg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    webp: [0x52, 0x49, 0x46, 0x46] // "RIFF"
};
/**
 * Validates the file buffer magic bytes against target signatures
 */
function validateMagicBytes(buffer, ext) {
    const extClean = ext.toLowerCase().replace(".", "");
    // WebP signature check needs RIFF at start and WEBP at offset 8
    if (extClean === "webp") {
        if (buffer.length < 12)
            return false;
        const isRiff = SIGNATURES.webp.every((byte, idx) => buffer[idx] === byte);
        const isWebp = buffer.toString("ascii", 8, 12) === "WEBP";
        return isRiff && isWebp;
    }
    const signature = SIGNATURES[extClean === "jpeg" ? "jpg" : extClean];
    if (!signature)
        return false;
    if (buffer.length < signature.length)
        return false;
    return signature.every((byte, idx) => buffer[idx] === byte);
}
/**
 * Scans the buffer for malicious script injections or polyglot payloads.
 * Looks for common PHP, HTML, and JS execution patterns.
 */
function scanForThreats(buffer) {
    // Convert buffer to both string and hex representation for thorough scanning
    const contentStr = buffer.toString("utf-8").toLowerCase();
    const dangerousPatterns = [
        { pattern: "<?php", name: "PHP Tag" },
        { pattern: "<script", name: "Script Tag" },
        { pattern: "javascript:", name: "JS URI Scheme" },
        { pattern: "onload=", name: "Inline HTML Event" },
        { pattern: "onerror=", name: "Inline HTML Event" },
        { pattern: "onclick=", name: "Inline HTML Event" },
        { pattern: "eval(", name: "JS Eval Function" },
        { pattern: "document.cookie", name: "Session Access Pattern" },
        { pattern: "base64,phb", name: "Base64 PHP Wrapper" } // Common php base64 payloads start with this
    ];
    for (const p of dangerousPatterns) {
        if (contentStr.includes(p.pattern)) {
            return { safe: false, reason: `Embedded code signature detected: ${p.name}` };
        }
    }
    return { safe: true };
}
/**
 * Middleware wrapper to handle multer parsing & run threat checks
 */
const scanImageUpload = (req, res, next) => {
    upload.single("image")(req, res, (err) => __awaiter(void 0, void 0, void 0, function* () {
        if (err instanceof multer_1.default.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        else if (err) {
            return res.status(400).json({ message: err.message || "File upload failed" });
        }
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: "No image file provided" });
        }
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        // 1. Extension Check
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return res.status(400).json({
                message: `Invalid file extension. Allowed extensions are: ${ALLOWED_EXTENSIONS.join(", ")}`
            });
        }
        // 2. MIME Type Check
        if (!ALLOWED_MIMES.includes(file.mimetype)) {
            return res.status(400).json({
                message: `Invalid MIME type. Allowed types are: ${ALLOWED_MIMES.join(", ")}`
            });
        }
        // 3. Size Check
        if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({
                message: "File size exceeds the maximum limit of 5MB"
            });
        }
        // 4. Magic Bytes Validation
        if (!validateMagicBytes(file.buffer, ext)) {
            logger_1.default.warn(`[Security Alert] Magic bytes mismatch for file ${file.originalname} (claimed ${ext})`);
            return res.status(400).json({
                message: "Security warning: File content type does not match its extension signature."
            });
        }
        // 5. Threat Signature Scan
        const scanResult = scanForThreats(file.buffer);
        if (!scanResult.safe) {
            const clientIp = req.ip || req.socket.remoteAddress || "Unknown";
            const userAgent = req.headers["user-agent"] || null;
            const adminUser = req.user;
            const attemptedBy = adminUser ? `ADMIN_USER_${adminUser.id}` : "UNAUTHENTICATED";
            const reason = scanResult.reason || "Dangerous patterns detected in file payload";
            logger_1.default.error(`[SECURITY THREAT] Malicious image upload blocked from ${clientIp}. Reason: ${reason}`);
            try {
                // Determine SLA deadline (P1: 1 hour)
                const slaDeadline = new Date(Date.now() + 60 * 60 * 1000);
                // Log Security Incident
                const incident = yield prisma_1.default.securityIncident.create({
                    data: {
                        title: `🚨 Image Threat Blocked: [P1] MALICIOUS_FILE_UPLOAD`,
                        description: `A file upload attempt containing dangerous script payloads was blocked. Filename: ${file.originalname}, Size: ${file.size} bytes. Registered threat: ${reason}`,
                        threatType: "MALICIOUS_FILE_UPLOAD",
                        severity: "P1",
                        status: "OPEN",
                        sourceIp: clientIp,
                        userAgent,
                        slaDeadline,
                        detectionProof: {
                            filename: file.originalname,
                            mimetype: file.mimetype,
                            size: file.size,
                            detectedThreat: reason,
                            attemptedBy
                        }
                    }
                });
                // Create Security Audit Log
                yield prisma_1.default.securityAuditLog.create({
                    data: {
                        tableName: "SecurityIncident",
                        attemptedOperation: "THREAT_DETECTION_MALICIOUS_FILE_UPLOAD",
                        attemptedBy,
                        severity: "HIGH",
                        rawQuerySnippet: `Blocked upload of ${file.originalname}. Saved incident ID: ${incident.id}`
                    }
                });
                // Emit socket alert to Admin Dashboard
                const io = (0, io_1.getIo)();
                if (io) {
                    io.emit("admin:threat_alert", {
                        incidentId: incident.id,
                        title: incident.title,
                        threatType: "MALICIOUS_FILE_UPLOAD",
                        severity: "P1",
                        sourceIp: clientIp,
                        proof: { filename: file.originalname, reason },
                        slaDeadline,
                        timestamp: incident.createdAt
                    });
                }
                // Push notifications to other administrators
                const admins = yield prisma_1.default.user.findMany({
                    where: { role: "ADMIN" },
                    select: { id: true }
                });
                if (admins.length > 0) {
                    yield prisma_1.default.notification.createMany({
                        data: admins.map(admin => ({
                            userId: admin.id,
                            title: `🚨 SECURITY ALERT: MALICIOUS FILE BLOCKED`,
                            body: `Malicious upload blocked from IP ${clientIp}. Incident ID: ${incident.id}`,
                            type: "THREAT"
                        }))
                    });
                }
            }
            catch (loggingError) {
                logger_1.default.error("Error logging security incident for malicious file upload:", loggingError);
            }
            return res.status(400).json({
                message: "Security threat detected: The uploaded file contains forbidden script payloads and has been blocked."
            });
        }
        // Passed all validation checks!
        next();
    }));
};
exports.scanImageUpload = scanImageUpload;
