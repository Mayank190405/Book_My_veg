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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.logout = exports.refreshToken = exports.verifyOtpAndLogin = exports.sendOtp = void 0;
const client_1 = require("@prisma/client");
const otp_1 = require("../utils/otp");
const automatex_1 = require("../services/automatex");
const jwt_1 = require("../utils/jwt");
const prisma = new client_1.PrismaClient();
const sendOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
    }
    try {
        const otp = (0, otp_1.generateOtp)();
        yield (0, otp_1.storeOtp)(phone, otp);
        // Send OTP via Automatex
        // In development logic might be different if we don't want to use real credits
        // But per requirements we use the real service
        try {
            yield (0, automatex_1.sendOtpViaWhatsapp)(phone, otp);
        }
        catch (apiError) {
            console.error("Failed to send SMS:", apiError);
            // Fallback or just log, but let the user know for now
            // return res.status(500).json({ message: "Failed to send OTP via SMS provider" });
        }
        res.status(200).json({ message: "OTP sent successfully", otp }); // Removing otp from response in production
    }
    catch (error) {
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
        // Find or create user
        let user = yield prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = yield prisma.user.create({
                data: { phone },
            });
        }
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)(user.id, user.role);
        // Set Refresh Token in HTTP-only cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
const refreshToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const token = req.cookies.refreshToken;
    if (!token) {
        return res.status(401).json({ message: "Refresh token required" });
    }
    try {
        const decoded = (0, jwt_1.verifyRefreshToken)(token);
        const user = yield prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        const tokens = (0, jwt_1.generateTokens)(user.id, user.role);
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
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
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, phone: true, name: true, email: true, role: true },
        });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching profile" });
    }
});
exports.getMe = getMe;
