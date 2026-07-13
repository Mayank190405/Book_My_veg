"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getWhatsappTemplates = exports.getMe = exports.loginWithPassword = exports.logout = exports.refreshToken = exports.whatsappWebhook = exports.checkWhatsappStatus = exports.verifyOtpAndLogin = exports.sendOtp = void 0;
const prisma_1 = __importStar(require("../config/prisma"));
const otp_1 = require("../utils/otp");
const mbgcard_1 = require("../services/mbgcard");
const jwt_1 = require("../utils/jwt");
const logger_1 = __importDefault(require("../utils/logger"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const sendOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
    }
    try {
        const otp = (0, otp_1.generateOtp)();
        yield (0, otp_1.storeOtp)(phone, otp);
        // Pre-create/save user in database even if OTP is not yet verified
        let user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.findUnique({ where: { phone } }));
        if (!user) {
            user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.create({ data: { phone } }));
        }
        if (process.env.NODE_ENV !== "production") {
            console.log(`[AUTH] OTP for ${phone} is ${otp}`);
        }
        // Send OTP via MBG Card
        try {
            yield (0, mbgcard_1.sendOtpViaWhatsapp)(phone, otp);
            res.status(200).json({
                message: "OTP sent successfully"
            });
        }
        catch (apiError) {
            console.error("Failed to send OTP via provider:", apiError.message);
            // Generate WhatsApp Fallback URL
            const magicToken = yield (0, otp_1.generateMagicToken)(phone);
            const whatsappNumber = "917796833633"; // Ensure it's 91 format
            const message = encodeURIComponent(`Verify me on BMV: ${magicToken}`);
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
            res.status(200).json({
                message: "OTP delivery failed, please verify via WhatsApp",
                whatsappUrl,
                magicToken
            });
        }
    }
    catch (error) {
        console.error("[Auth] sendOtp error:", error);
        if (error.message && error.message.includes("Too many OTP attempts")) {
            return res.status(429).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || "Internal server error" });
    }
});
exports.sendOtp = sendOtp;
const verifyOtpAndLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
        return res.status(400).json({ message: "Phone and OTP are required" });
    }
    try {
        const isValid = yield (0, otp_1.verifyOtp)(phone, otp);
        if (!isValid) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
        // Find or create user (retry on stale-connection errors)
        let user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.findUnique({ where: { phone } }));
        if (!user) {
            user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.create({ data: { phone } }));
        }
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)(user.id, user.role, user.locationId);
        // Set Refresh Token in HTTP-only cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // Create Audit Log
        yield prisma_1.default.auditLog.create({
            data: {
                entityType: "USER",
                entityId: user.id,
                action: "LOGIN_OTP",
                staffId: user.id,
                locationId: user.locationId,
                newValue: { phone: user.phone, role: user.role }
            }
        });
        res.status(200).json({
            message: "Login successful",
            accessToken,
            user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.verifyOtpAndLogin = verifyOtpAndLogin;
const checkWhatsappStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { phone, token } = req.body;
    if (!phone || !token) {
        return res.status(400).json({ message: "Phone and token are required" });
    }
    try {
        // 1. Check Redis if this token has been marked as verified by the webhook
        let isVerified = yield (0, otp_1.isMagicTokenVerified)(token);
        // 2. Fallback: If not verified by webhook, poll MBG Card API
        if (!isVerified) {
            logger_1.default.info(`[Auth] Webhook not hit for ${phone}. Triggering fallback polling...`);
            const conversation = yield (0, mbgcard_1.getConversation)(phone);
            if (conversation && conversation.status === "1") {
                const messages = typeof conversation.message === 'string' ? JSON.parse(conversation.message) : (conversation.message || []);
                for (const msg of messages) {
                    if (msg.sender === "user") {
                        let content;
                        try {
                            content = typeof msg.message_content === 'string' ? JSON.parse(msg.message_content) : msg.message_content;
                        }
                        catch (_j) {
                            content = {};
                        }
                        logger_1.default.info(`[Auth] Checking user msg from conversation API:`, JSON.stringify(content));
                        // Try all known structures from MBG Card API
                        // 1. Meta webhook nested payload (entry > changes > value > messages)
                        const whatsappMsg = (_f = (_e = (_d = (_c = (_b = (_a = content === null || content === void 0 ? void 0 : content.entry) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.changes) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) === null || _e === void 0 ? void 0 : _e.messages) === null || _f === void 0 ? void 0 : _f[0];
                        // 2. Direct text field
                        const directText = ((_g = content === null || content === void 0 ? void 0 : content.text) === null || _g === void 0 ? void 0 : _g.body) || (content === null || content === void 0 ? void 0 : content.text) || (content === null || content === void 0 ? void 0 : content.body) || "";
                        // 3. Plain string content (raw message text)
                        const rawContent = typeof msg.message_content === 'string' ? msg.message_content : "";
                        const msgText = String(((_h = whatsappMsg === null || whatsappMsg === void 0 ? void 0 : whatsappMsg.text) === null || _h === void 0 ? void 0 : _h.body) ||
                            directText ||
                            rawContent ||
                            "");
                        const rawSender = String((whatsappMsg === null || whatsappMsg === void 0 ? void 0 : whatsappMsg.from) ||
                            msg.whatsapp_bot_subscriber_subscriber_id ||
                            "").replace(/\D/g, '');
                        const senderWithPlus = rawSender.startsWith('91') ? `+${rawSender}` : `+91${rawSender}`;
                        logger_1.default.info(`[Auth] Extracted msgText: "${msgText}", sender: "${senderWithPlus}"`);
                        if (msgText.includes(token)) {
                            logger_1.default.info(`[Auth] Fallback polling successful. Found token ${token} from ${senderWithPlus}`);
                            yield (0, otp_1.markMagicTokenAsVerified)(token);
                            isVerified = true;
                            break;
                        }
                    }
                }
            }
        }
        if (!isVerified) {
            return res.status(200).json({ verified: false, message: "Waiting for verification..." });
        }
        // 3. Verify token internally (get the phone number associated)
        const verifiedPhone = yield (0, otp_1.verifyMagicToken)(token);
        if (!verifiedPhone || verifiedPhone !== phone) {
            return res.status(400).json({ message: "Invalid or expired magic token" });
        }
        // 4. Login user (same as verifyOtpAndLogin)
        let user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.findUnique({ where: { phone } }));
        if (!user) {
            user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.create({ data: { phone } }));
        }
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)(user.id, user.role, user.locationId);
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // Cleanup: remove verified flag and token
        yield (0, otp_1.clearMagicToken)(token);
        res.status(200).json({
            verified: true,
            message: "WhatsApp verification successful",
            accessToken,
            user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
        });
    }
    catch (error) {
        logger_1.default.error("WhatsApp status check failed:", error);
        res.status(500).json({ message: "Failed to check WhatsApp status" });
    }
});
exports.checkWhatsappStatus = checkWhatsappStatus;
const whatsappWebhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    logger_1.default.info(`[Webhook] Received WhatsApp message: ${JSON.stringify(req.body, null, 2)}`);
    try {
        // Parse the MBG Card/Meta payload
        const messagesStr = req.body.message;
        const messages = typeof messagesStr === 'string' ? JSON.parse(messagesStr) : (messagesStr || []);
        for (const msg of messages) {
            const content = typeof msg.message_content === 'string' ? JSON.parse(msg.message_content) : msg.message_content;
            const whatsappMsg = (_f = (_e = (_d = (_c = (_b = (_a = content === null || content === void 0 ? void 0 : content.entry) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.changes) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) === null || _e === void 0 ? void 0 : _e.messages) === null || _f === void 0 ? void 0 : _f[0];
            if ((whatsappMsg === null || whatsappMsg === void 0 ? void 0 : whatsappMsg.type) === "text") {
                const msgText = String(((_g = whatsappMsg.text) === null || _g === void 0 ? void 0 : _g.body) || "");
                const rawSender = String(whatsappMsg.from || "").replace(/\D/g, '');
                const senderWithPlus = rawSender.startsWith('91') ? `+${rawSender}` : `+91${rawSender}`;
                // Extract token from message (format: "Verify me on BMV: token_here")
                const tokenMatch = msgText.match(/BMV:\s*([a-z0-9]+)/i);
                if (tokenMatch) {
                    const token = tokenMatch[1];
                    logger_1.default.info(`[Webhook] Found token ${token} from ${senderWithPlus}`);
                    // Verify this sender matches the token's registered phone
                    const registeredPhone = yield (0, otp_1.verifyMagicToken)(token);
                    if (registeredPhone) {
                        const normalizedRegPhone = registeredPhone.replace(/\D/g, '');
                        const normalizedSender = rawSender;
                        if (normalizedSender.endsWith(normalizedRegPhone) || normalizedRegPhone.endsWith(normalizedSender)) {
                            logger_1.default.info(`[Webhook] Token ${token} verified for ${senderWithPlus}`);
                            yield (0, otp_1.markMagicTokenAsVerified)(token);
                        }
                    }
                }
            }
        }
        res.status(200).send("OK");
    }
    catch (error) {
        console.error("[Webhook] Error processing WhatsApp message:", error);
        res.status(200).send("OK"); // Always return 200 to provider
    }
});
exports.whatsappWebhook = whatsappWebhook;
const refreshToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const token = req.cookies.refreshToken;
    if (!token) {
        return res.status(401).json({ message: "Refresh token required" });
    }
    try {
        const decoded = (0, jwt_1.verifyRefreshToken)(token);
        const user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.findUnique({ where: { id: decoded.userId } }));
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        const tokens = (0, jwt_1.generateTokens)(user.id, user.role, user.locationId);
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(200).json({ accessToken: tokens.accessToken });
    }
    catch (error) {
        return res.status(403).json({ message: "Invalid refresh token" });
    }
});
exports.refreshToken = refreshToken;
const logout = (req, res) => {
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logged out successfully" });
};
exports.logout = logout;
const loginWithPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone, password } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ message: "Phone and password are required" });
    }
    try {
        logger_1.default.info(`[AUTH] Login attempt for identifier: ${phone}`);
        let user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.findUnique({ where: { phone } }));
        let locationMatch = null;
        if (user) {
            logger_1.default.info(`[AUTH] User found for identifier: ${phone}, checking password...`);
        }
        if (!user || !user.password) {
            logger_1.default.info(`[AUTH] Triggering fallback identification for identifier: ${phone}...`);
            // Fallback: Check if this is a Store/Location login using contactNumber & store password
            locationMatch = yield (0, prisma_1.withRetry)(() => prisma_1.default.location.findFirst({
                where: { contactNumber: phone }
            }));
            if (!locationMatch || !locationMatch.password) {
                logger_1.default.warn(`[AUTH] Access identifier not recognized: ${phone}`);
                return res.status(401).json({ message: "Invalid credentials or no password set for this account" });
            }
            const isStoreMatch = yield bcryptjs_1.default.compare(password, locationMatch.password);
            if (!isStoreMatch) {
                logger_1.default.warn(`[AUTH] Store password mismatch for identifier: ${phone}`);
                return res.status(401).json({ message: "Invalid credentials" });
            }
            logger_1.default.info(`[AUTH] Store login successful for ${locationMatch.name} (${locationMatch.id})`);
            // Create a virtual user session for the store hub
            const { accessToken, refreshToken } = (0, jwt_1.generateTokens)(`STORE_${locationMatch.id}`, "STORE_ADMIN", locationMatch.id);
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            // Create Audit Log - Set staffId to null for virtual store logins (avoids FK violation)
            try {
                yield (0, prisma_1.withRetry)(() => prisma_1.default.auditLog.create({
                    data: {
                        entityType: "LOCATION",
                        entityId: locationMatch.id,
                        action: "LOGIN_STORE_ADMIN",
                        staffId: null,
                        locationId: locationMatch.id,
                        newValue: { name: locationMatch.name, virtualId: `STORE_${locationMatch.id}` }
                    }
                }));
            }
            catch (auditError) {
                logger_1.default.error("[AUTH] Failed to create store login audit log:", auditError);
                // Don't fail the login if audit log fails, but we've logged it
            }
            return res.status(200).json({
                message: "Store login successful",
                accessToken,
                user: {
                    id: `STORE_${locationMatch.id}`,
                    phone: locationMatch.contactNumber,
                    role: "STORE_ADMIN",
                    name: locationMatch.name,
                    locationId: locationMatch.id,
                    slug: locationMatch.slug
                },
            });
        }
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            logger_1.default.warn(`[AUTH] Password mismatch for identifier: ${phone}`);
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)(user.id, user.role, user.locationId);
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // Create Audit Log
        try {
            yield (0, prisma_1.withRetry)(() => prisma_1.default.auditLog.create({
                data: {
                    entityType: "USER",
                    entityId: user.id,
                    action: "LOGIN_PASSWORD",
                    staffId: user.id,
                    locationId: user.locationId,
                    newValue: { phone: user.phone, role: user.role }
                }
            }));
        }
        catch (auditError) {
            logger_1.default.error("[AUTH] Failed to create user login audit log:", auditError);
        }
        logger_1.default.info(`[AUTH] User login successful for ${user.id} (${user.role})`);
        res.status(200).json({
            message: "Login successful",
            accessToken,
            user: { id: user.id, phone: user.phone, role: user.role, name: user.name, locationId: user.locationId },
        });
    }
    catch (error) {
        logger_1.default.error("[AUTH] loginWithPassword critical error:", {
            error: error.message,
            stack: error.stack,
            phone
        });
        res.status(500).json({ message: "Internal server error", error: process.env.NODE_ENV === "development" ? error.message : undefined });
    }
});
exports.loginWithPassword = loginWithPassword;
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield (0, prisma_1.withRetry)(() => prisma_1.default.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, phone: true, name: true, email: true, role: true, locationId: true },
        }));
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching profile" });
    }
});
exports.getMe = getMe;
const getWhatsappTemplates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = yield (0, mbgcard_1.getMyMetaTemplates)();
        res.status(200).json(data);
    }
    catch (error) {
        logger_1.default.error("[Auth] getWhatsappTemplates error:", error);
        res.status(500).json({ message: "Failed to fetch WhatsApp templates from MBG Card", error: error.message });
    }
});
exports.getWhatsappTemplates = getWhatsappTemplates;
