"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateTokens = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret";
const generateTokens = (userId, role) => {
    const accessOptions = {
        expiresIn: (process.env.JWT_ACCESS_EXPIRY || "15m"),
    };
    const refreshOptions = {
        expiresIn: (process.env.JWT_REFRESH_EXPIRY || "7d"),
    };
    const accessToken = jsonwebtoken_1.default.sign({ userId, role }, ACCESS_SECRET, accessOptions);
    const refreshToken = jsonwebtoken_1.default.sign({ userId }, REFRESH_SECRET, refreshOptions);
    return { accessToken, refreshToken };
};
exports.generateTokens = generateTokens;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
};
exports.verifyRefreshToken = verifyRefreshToken;
