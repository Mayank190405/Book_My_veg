import axios from "axios";
import { useUserStore } from "@/store/useUserStore";

export const getBaseURL = () => {
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const envUrl = process.env.NEXT_PUBLIC_API_URL;

        // On HTTPS or production domain (bookmyveg), use relative /api/v1
        // so requests use same-origin HTTPS and Nginx reverse proxy routes them to backend port 5001
        if (protocol === "https:" || hostname.includes("bookmyveg")) {
            return "/api/v1";
        }

        if (envUrl) {
            if (hostname !== "localhost" && hostname !== "127.0.0.1" && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
                return envUrl.replace("localhost", hostname).replace("127.0.0.1", hostname);
            }
            return envUrl;
        }

        return `${protocol}//${hostname}:5001/api/v1`;
    }
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";
};


const api = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
});

// Request Interceptor: Inject token
api.interceptors.request.use((config) => {
    const token = useUserStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Handle 401 & Refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            // Prevent infinite refresh loop if refresh endpoint itself returned 401
            if (originalRequest.url?.includes('/auth/refresh')) {
                useUserStore.getState().logout();
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Try refreshing the token — use getBaseURL() to maintain environment & HTTPS consistency
                const baseURL = getBaseURL();
                const storedRefreshToken = useUserStore.getState().refreshToken;

                const response = await axios.post(
                    `${baseURL}/auth/refresh`,
                    { refreshToken: storedRefreshToken },
                    { 
                        headers: storedRefreshToken ? { 'x-refresh-token': storedRefreshToken } : {},
                        withCredentials: true 
                    }
                );

                const newToken = response.data.accessToken;
                const newRefreshToken = response.data.refreshToken;

                if (newToken) {
                    useUserStore.getState().setToken(newToken);
                }
                if (newRefreshToken) {
                    useUserStore.getState().setRefreshToken(newRefreshToken);
                }

                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                processQueue(null, newToken);

                return api(originalRequest);
            } catch (refreshError: any) {
                processQueue(refreshError, null);
                // Only log out if refresh explicitly returned 401 or 403 (unauthorized/invalid token), not on network errors
                if (refreshError?.response?.status === 401 || refreshError?.response?.status === 403) {
                    useUserStore.getState().logout();
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
