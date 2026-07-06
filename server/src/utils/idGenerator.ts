import crypto from 'crypto';

/**
 * Generates a non-sequential, alphanumeric Order ID compliant with HDFC Bank requirements.
 * Format: BMV + 12 random alphanumeric characters (e.g., BMVA1B2C3D4E5F6)
 * Total length: 15 characters (Requirement: < 21 characters)
 */
export const generateOrderId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BMV';
    const randomBytes = crypto.randomBytes(12);
    for (let i = 0; i < 12; i++) {
        result += chars[randomBytes[i] % chars.length];
    }
    return result;
};
