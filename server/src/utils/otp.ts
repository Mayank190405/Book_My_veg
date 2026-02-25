import redisClient from "../config/redis";

const OTP_EXPIRY = 600; // 10 minutes
const MAX_ATTEMPTS = 8;

export const generateOtp = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOtp = async (phone: string, otp: string) => {
    const key = `otp:${phone}`;
    const attemptsKey = `otp_attempts:${phone}`;

    // Check attempts
    const attempts = await redisClient.get(attemptsKey);
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
        throw new Error("Too many OTP attempts. Please try again later.");
    }

    // Increment attempts
    await redisClient.incr(attemptsKey);
    await redisClient.expire(attemptsKey, 3600); // 1 hour expiry for attempts

    // Store OTP
    await redisClient.setEx(key, OTP_EXPIRY, otp);
};

export const verifyOtp = async (phone: string, otp: string): Promise<boolean> => {
    const key = `otp:${phone}`;
    const storedOtp = await redisClient.get(key);

    if (!storedOtp) {
        return false;
    }

    if (storedOtp !== otp) {
        return false;
    }

    // Clear OTP after successful verification
    await redisClient.del(key);
    await redisClient.del(`otp_attempts:${phone}`);

    return true;
};

export const generateMagicToken = async (phone: string): Promise<string> => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const key = `magic_token:${token}`;

    // Store token -> phone mapping for 5 minutes
    await redisClient.setEx(key, 300, phone);
    return token;
};

export const verifyMagicToken = async (token: string): Promise<string | null> => {
    const key = `magic_token:${token}`;
    const phone = await redisClient.get(key);
    return phone; // Don't delete yet, it might be used to finalize login
};

export const markMagicTokenAsVerified = async (token: string) => {
    const key = `magic_token:verified:${token}`;
    await redisClient.setEx(key, 300, "true"); // Mark as verified for 5 mins
};

export const isMagicTokenVerified = async (token: string): Promise<boolean> => {
    const key = `magic_token:verified:${token}`;
    const verified = await redisClient.get(key);
    return verified === "true";
};

export const clearMagicToken = async (token: string) => {
    await redisClient.del(`magic_token:${token}`);
    await redisClient.del(`magic_token:verified:${token}`);
};
