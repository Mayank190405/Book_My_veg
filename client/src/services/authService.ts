import api from "./api";
import { useUserStore } from "@/store/useUserStore";

export const sendOtp = async (phone: string) => {
    const response = await api.post("/auth/send-otp", { phone });
    return response.data;
};

export const verifyOtp = async (phone: string, otp: string) => {
    const response = await api.post("/auth/verify-otp", { phone, otp });
    // Update user store
    if (response.data.user) {
        useUserStore.getState().setUser(response.data.user);
    }
    if (response.data.accessToken) {
        useUserStore.getState().setToken(response.data.accessToken);
    }
    return response.data;
};

export const checkWhatsappStatus = async (phone: string, token: string) => {
    const response = await api.post("/auth/whatsapp-check", { phone, token });
    if (response.data.verified) {
        if (response.data.user) {
            useUserStore.getState().setUser(response.data.user);
        }
        if (response.data.accessToken) {
            useUserStore.getState().setToken(response.data.accessToken);
        }
    }
    return response.data;
};

export const logout = async () => {
    try {
        await api.post("/auth/logout");
    } catch (error) {
        console.error("Logout failed", error);
    } finally {
        useUserStore.getState().logout();
    }
};

export const getMe = async () => {
    try {
        const response = await api.get("/auth/me");
        if (response.data.user) {
            useUserStore.getState().setUser(response.data.user);
        }
        return response.data;
    } catch (error) {
        // If 401, clear user
        useUserStore.getState().logout();
        throw error;
    }
};
