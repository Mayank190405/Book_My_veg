import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (userId: string) => {
    if (socket) return socket;

    socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000", {
        withCredentials: true,
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
