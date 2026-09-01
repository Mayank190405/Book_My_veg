import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const getSocketURL = () => {
    if (typeof window !== "undefined") {
        const isClientLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        let apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        
        if (apiUrl.includes("localhost") && !isClientLocal) {
            apiUrl = "";
        }
        
        if (apiUrl.startsWith("http")) {
            const url = new URL(apiUrl);
            return `${url.protocol}//${url.host}`;
        }
        if (!isClientLocal) return window.location.origin;
        return `${window.location.protocol}//${window.location.hostname}:5001`;
    }
    return process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:5001";
};

export const initSocket = (userId: string) => {
    if (socket) return socket;

    socket = io(getSocketURL(), {
        withCredentials: true,
        transports: ["websocket"],
    });

    socket.on("connect", () => {
        console.log("Connected to socket server");
        if (userId) {
            socket?.emit("join_room", userId);
        }
    });

    return socket;
};

export const getSocket = () => {
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
