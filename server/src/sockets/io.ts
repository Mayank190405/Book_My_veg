import { Server } from "socket.io";
import http from "http";

let io: Server;

export const initIo = (server: http.Server) => {
    io = new Server(server, {
        cors: {
            origin: [
                process.env.CLIENT_URL || "http://localhost:3000", 
                "https://bookmyveg.co.in",
                "https://www.bookmyveg.co.in",
                "http://192.168.1.9:3000", 
                "http://192.168.1.13:3000"
            ],
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    return io;
};

export const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
