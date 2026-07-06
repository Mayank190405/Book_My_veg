"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIo = exports.initIo = void 0;
const socket_io_1 = require("socket.io");
let io;
const initIo = (server) => {
    io = new socket_io_1.Server(server, {
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
exports.initIo = initIo;
const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
exports.getIo = getIo;
