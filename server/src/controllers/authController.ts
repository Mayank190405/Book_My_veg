import { Request, Response } from "express";
import prisma, { withRetry } from "../config/prisma";
import {
    generateOtp,
    storeOtp,
    verifyOtp,
    generateMagicToken,
    verifyMagicToken,
    markMagicTokenAsVerified,
    isMagicTokenVerified,
    clearMagicToken
} from "../utils/otp";
import { sendOtpViaWhatsapp, getConversation, getMyMetaTemplates } from "../services/mbgcard";
import { generateTokens, verifyRefreshToken } from "../utils/jwt";
import logger from "../utils/logger";
import bcrypt from "bcryptjs";

export const sendOtp = async (req: Request, res: Response) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.endsWith("9999999999")) {
        try {
            let user = await withRetry(() => prisma.user.findUnique({ where: { phone } }));
            if (!user) {
                user = await withRetry(() => prisma.user.create({ data: { phone } }));
            }
            return res.status(200).json({
                message: "OTP sent successfully"
            });
        } catch (dbError: any) {
            console.error("Failed to ensure test user in DB:", dbError);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    try {
        const otp = generateOtp();
        await storeOtp(phone, otp);

        // Pre-create/save user in database even if OTP is not yet verified
        let user = await withRetry(() => prisma.user.findUnique({ where: { phone } }));
        if (!user) {
            user = await withRetry(() => prisma.user.create({ data: { phone } }));
        }

        if (process.env.NODE_ENV !== "production") {
            console.log(`[AUTH] OTP for ${phone} is ${otp}`);
        }

        // Send OTP via MBG Card
        try {
            await sendOtpViaWhatsapp(phone, otp);
            res.status(200).json({
                message: "OTP sent successfully"
            });
        } catch (apiError: any) {
            console.error("Failed to send OTP via provider:", apiError.message);

            // Generate WhatsApp Fallback URL
            const magicToken = await generateMagicToken(phone);
            const whatsappNumber = "917796833633"; // Ensure it's 91 format
            const message = encodeURIComponent(`Verify me on BMV: ${magicToken}`);
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

            res.status(200).json({
                message: "OTP delivery failed, please verify via WhatsApp",
                whatsappUrl,
                magicToken
            });
        }
    } catch (error: any) {
        console.error("[Auth] sendOtp error:", error);
        if (error.message && error.message.includes("Too many OTP attempts")) {
            return res.status(429).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || "Internal server error" });
    }
};

export const verifyOtpAndLogin = async (req: Request, res: Response) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ message: "Phone and OTP are required" });
    }

    try {
        const isValid = await verifyOtp(phone, otp);

        if (!isValid) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        // Find or create user (retry on stale-connection errors)
        let user = await withRetry(() => prisma.user.findUnique({ where: { phone } }));

        if (!user) {
            user = await withRetry(() => prisma.user.create({ data: { phone } }));
        }

        const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.locationId);

        // Set Refresh Token in HTTP-only cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Create Audit Log
        await (prisma.auditLog.create as any)({
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const checkWhatsappStatus = async (req: Request, res: Response) => {
    const { phone, token } = req.body;

    if (!phone || !token) {
        return res.status(400).json({ message: "Phone and token are required" });
    }

    try {
        // 1. Check Redis if this token has been marked as verified by the webhook
        let isVerified = await isMagicTokenVerified(token);

        // 2. Fallback: If not verified by webhook, poll MBG Card API
        if (!isVerified) {
            logger.info(`[Auth] Webhook not hit for ${phone}. Triggering fallback polling...`);
            const conversation = await getConversation(phone);

            if (conversation && conversation.status === "1") {
                const messages = typeof conversation.message === 'string' ? JSON.parse(conversation.message) : (conversation.message || []);

                for (const msg of messages) {
                    if (msg.sender === "user") {
                        let content: any;
                        try {
                            content = typeof msg.message_content === 'string' ? JSON.parse(msg.message_content) : msg.message_content;
                        } catch {
                            content = {};
                        }

                        logger.info(`[Auth] Checking user msg from conversation API:`, JSON.stringify(content));

                        // Try all known structures from MBG Card API
                        // 1. Meta webhook nested payload (entry > changes > value > messages)
                        const whatsappMsg = content?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
                        // 2. Direct text field
                        const directText = content?.text?.body || content?.text || content?.body || "";
                        // 3. Plain string content (raw message text)
                        const rawContent = typeof msg.message_content === 'string' ? msg.message_content : "";

                        const msgText = String(
                            whatsappMsg?.text?.body ||
                            directText ||
                            rawContent ||
                            ""
                        );

                        const rawSender = String(
                            whatsappMsg?.from ||
                            msg.whatsapp_bot_subscriber_subscriber_id ||
                            ""
                        ).replace(/\D/g, '');
                        const senderWithPlus = rawSender.startsWith('91') ? `+${rawSender}` : `+91${rawSender}`;

                        logger.info(`[Auth] Extracted msgText: "${msgText}", sender: "${senderWithPlus}"`);

                        if (msgText.includes(token)) {
                            logger.info(`[Auth] Fallback polling successful. Found token ${token} from ${senderWithPlus}`);
                            await markMagicTokenAsVerified(token);
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
        const verifiedPhone = await verifyMagicToken(token);
        if (!verifiedPhone || verifiedPhone !== phone) {
            return res.status(400).json({ message: "Invalid or expired magic token" });
        }

        // 4. Login user (same as verifyOtpAndLogin)
        let user = await withRetry(() => prisma.user.findUnique({ where: { phone } }));
        if (!user) {
            user = await withRetry(() => prisma.user.create({ data: { phone } }));
        }

        const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.locationId);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Cleanup: remove verified flag and token
        await clearMagicToken(token);

        res.status(200).json({
            verified: true,
            message: "WhatsApp verification successful",
            accessToken,
            user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
        });

    } catch (error) {
        logger.error("WhatsApp status check failed:", error);
        res.status(500).json({ message: "Failed to check WhatsApp status" });
    }
};

export const whatsappWebhook = async (req: Request, res: Response) => {
    logger.info(`[Webhook] Received WhatsApp message: ${JSON.stringify(req.body, null, 2)}`);

    try {
        // Parse the MBG Card/Meta payload
        const messagesStr = req.body.message;
        const messages = typeof messagesStr === 'string' ? JSON.parse(messagesStr) : (messagesStr || []);

        for (const msg of messages) {
            const content = typeof msg.message_content === 'string' ? JSON.parse(msg.message_content) : msg.message_content;
            const whatsappMsg = content?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

            if (whatsappMsg?.type === "text") {
                const msgText = String(whatsappMsg.text?.body || "");
                const rawSender = String(whatsappMsg.from || "").replace(/\D/g, '');
                const senderWithPlus = rawSender.startsWith('91') ? `+${rawSender}` : `+91${rawSender}`;

                // Extract token from message (format: "Verify me on BMV: token_here")
                const tokenMatch = msgText.match(/BMV:\s*([a-z0-9]+)/i);
                if (tokenMatch) {
                    const token = tokenMatch[1];
                    logger.info(`[Webhook] Found token ${token} from ${senderWithPlus}`);

                    // Verify this sender matches the token's registered phone
                    const registeredPhone = await verifyMagicToken(token);
                    if (registeredPhone) {
                        const normalizedRegPhone = registeredPhone.replace(/\D/g, '');
                        const normalizedSender = rawSender;

                        if (normalizedSender.endsWith(normalizedRegPhone) || normalizedRegPhone.endsWith(normalizedSender)) {
                            logger.info(`[Webhook] Token ${token} verified for ${senderWithPlus}`);
                            await markMagicTokenAsVerified(token);
                        }
                    }
                }
            }
        }

        res.status(200).send("OK");
    } catch (error) {
        console.error("[Webhook] Error processing WhatsApp message:", error);
        res.status(200).send("OK"); // Always return 200 to provider
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    const token = req.cookies.refreshToken;

    if (!token) {
        return res.status(401).json({ message: "Refresh token required" });
    }

    try {
        const decoded = verifyRefreshToken(token) as { userId: string };
        const user = await withRetry(() => prisma.user.findUnique({ where: { id: decoded.userId } }));

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        const tokens = generateTokens(user.id, user.role, user.locationId);

        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({ accessToken: tokens.accessToken });
    } catch (error) {
        return res.status(403).json({ message: "Invalid refresh token" });
    }
};

export const logout = (req: Request, res: Response) => {
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logged out successfully" });
};

export const loginWithPassword = async (req: Request, res: Response) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ message: "Phone and password are required" });
    }

    try {
        logger.info(`[AUTH] Login attempt for identifier: ${phone}`);
        
        let user: any = await withRetry(() => prisma.user.findUnique({ where: { phone } }));
        let locationMatch: any = null;

        if (user) {
            logger.info(`[AUTH] User found for identifier: ${phone}, checking password...`);
        }

        if (!user || !user.password) {
            logger.info(`[AUTH] Triggering fallback identification for identifier: ${phone}...`);
            // Fallback: Check if this is a Store/Location login using contactNumber & store password
            locationMatch = await withRetry(() => prisma.location.findFirst({
                where: { contactNumber: phone }
            }));

            if (!locationMatch || !locationMatch.password) {
                logger.warn(`[AUTH] Access identifier not recognized: ${phone}`);
                return res.status(401).json({ message: "Invalid credentials or no password set for this account" });
            }

            const isStoreMatch = await bcrypt.compare(password, locationMatch.password);
            if (!isStoreMatch) {
                logger.warn(`[AUTH] Store password mismatch for identifier: ${phone}`);
                return res.status(401).json({ message: "Invalid credentials" });
            }

            logger.info(`[AUTH] Store login successful for ${locationMatch.name} (${locationMatch.id})`);

            // Create a virtual user session for the store hub
            const { accessToken, refreshToken } = generateTokens(`STORE_${locationMatch.id}`, "STORE_ADMIN", locationMatch.id);

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            // Create Audit Log - Set staffId to null for virtual store logins (avoids FK violation)
            try {
                await withRetry(() => (prisma.auditLog.create as any)({
                    data: {
                        entityType: "LOCATION",
                        entityId: locationMatch.id,
                        action: "LOGIN_STORE_ADMIN",
                        staffId: null, 
                        locationId: locationMatch.id,
                        newValue: { name: locationMatch.name, virtualId: `STORE_${locationMatch.id}` }
                    }
                }));
            } catch (auditError) {
                logger.error("[AUTH] Failed to create store login audit log:", auditError);
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

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`[AUTH] Password mismatch for identifier: ${phone}`);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.locationId);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Create Audit Log
        try {
            await withRetry(() => (prisma.auditLog.create as any)({
                data: {
                    entityType: "USER",
                    entityId: user.id,
                    action: "LOGIN_PASSWORD",
                    staffId: user.id,
                    locationId: user.locationId,
                    newValue: { phone: user.phone, role: user.role }
                }
            }));
        } catch (auditError) {
            logger.error("[AUTH] Failed to create user login audit log:", auditError);
        }

        logger.info(`[AUTH] User login successful for ${user.id} (${user.role})`);

        res.status(200).json({
            message: "Login successful",
            accessToken,
            user: { id: user.id, phone: user.phone, role: user.role, name: user.name, locationId: user.locationId },
        });
    } catch (error: any) {
        logger.error("[AUTH] loginWithPassword critical error:", {
            error: error.message,
            stack: error.stack,
            phone
        });
        res.status(500).json({ message: "Internal server error", error: process.env.NODE_ENV === "development" ? error.message : undefined });
    }
};

export const getMe = async (req: any, res: Response) => {
    try {
        const user = await withRetry(() => prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, phone: true, name: true, email: true, role: true, locationId: true },
        }));
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Error fetching profile" });
    }
};

export const getWhatsappTemplates = async (req: Request, res: Response) => {
    try {
        const data = await getMyMetaTemplates();
        res.status(200).json(data);
    } catch (error: any) {
        logger.error("[Auth] getWhatsappTemplates error:", error);
        res.status(500).json({ message: "Failed to fetch WhatsApp templates from MBG Card", error: error.message });
    }
};
