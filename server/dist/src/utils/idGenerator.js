"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderId = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generates a non-sequential, alphanumeric Order ID compliant with HDFC Bank requirements.
 * Format: BMV + 12 random alphanumeric characters (e.g., BMVA1B2C3D4E5F6)
 * Total length: 15 characters (Requirement: < 21 characters)
 */
const generateOrderId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BMV';
    const randomBytes = crypto_1.default.randomBytes(12);
    for (let i = 0; i < 12; i++) {
        result += chars[randomBytes[i] % chars.length];
    }
    return result;
};
exports.generateOrderId = generateOrderId;
