import jwt, { Secret, SignOptions } from "jsonwebtoken";

const ACCESS_SECRET: Secret = process.env.JWT_ACCESS_SECRET || "access_secret";
const REFRESH_SECRET: Secret = process.env.JWT_REFRESH_SECRET || "refresh_secret";

export const generateTokens = (userId: string, role: string, locationId?: string | null) => {
    const accessOptions: SignOptions = {
        expiresIn: (process.env.JWT_ACCESS_EXPIRY || "15m") as any,
    };

    const refreshOptions: SignOptions = {
        expiresIn: (process.env.JWT_REFRESH_EXPIRY || "7d") as any,
    };

    const accessToken = jwt.sign({ userId, role, locationId }, ACCESS_SECRET, accessOptions);
    const refreshToken = jwt.sign({ userId }, REFRESH_SECRET, refreshOptions);

    return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => {
    return jwt.verify(token, ACCESS_SECRET);
};

export const verifyRefreshToken = (token: string) => {
    return jwt.verify(token, REFRESH_SECRET);
};
