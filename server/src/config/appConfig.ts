import dotenv from "dotenv";

dotenv.config();

export const appConfig = {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT) || 5000,
    db: {
        url: process.env.DATABASE_URL,
    },
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
    },
    auth: {
        jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "access_secret",
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "refresh_secret",
        jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
        jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
    },
    payments: {
        juspay: {
            apiKey: process.env.JUSPAY_API_KEY,
            merchantId: process.env.JUSPAY_MERCHANT_ID,
            clientId: process.env.JUSPAY_CLIENT_ID,
            baseUrl: process.env.JUSPAY_BASE_URL,
            responseKey: process.env.JUSPAY_RESPONSE_KEY,
        }
    },
    orders: {
        slotCapacity: Number(process.env.SLOT_CAPACITY) || 20,
        transactionRetryLimit: 3,
        autoCancelDelay: 30 * 60 * 1000, // 30 mins
    },
    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
};
