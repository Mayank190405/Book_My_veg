import axios from "axios";
import { useUserStore } from "@/store/useUserStore";

const getBaseURL = () => {
    if (typeof window !== "undefined") {
        // If NEXT_PUBLIC_API_URL is set, use it. 
        // Otherwise, assume backend is on port 5000 of the same host.
        return process.env.NEXT_PUBLIC_API_URL ||
            `${window.location.protocol}//${window.location.hostname}:5000/api/v1`;
    }
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
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
                // Try refreshing the token — use a clean axios instance to avoid interceptor loops
                let baseURL = api.defaults.baseURL;
                // If baseURL is relative or missing, fallback to window.location.origin or local dev server
                if (!baseURL || baseURL.startsWith('/')) {
                    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                    baseURL = (process.env.NEXT_PUBLIC_API_URL || `${origin.replace(':3000', ':5000')}/api/v1`);
                }

                const response = await axios.post(
                    `${baseURL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                const newToken = response.data.accessToken;
                useUserStore.getState().setToken(newToken);

                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                processQueue(null, newToken);

                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                useUserStore.getState().logout();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
