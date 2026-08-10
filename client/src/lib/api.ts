
import axios from "axios";
import { getBaseURL } from "@/services/api";

export { getBaseURL };


const API_URL = getBaseURL();

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
    (config) => {
        // In a Next.js app, we handle auth via cookies or localStorage
        // This assumes a 'token' cookie or header is handled by the browser
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
