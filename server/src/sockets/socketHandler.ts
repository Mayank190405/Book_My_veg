import { Server, Socket } from "socket.io";

export const socketHandler = (io: Server) => {
    io.on("connection", (socket: Socket) => {
        console.log("Client connected:", socket.id);

        socket.on("join_room", (userId: string) => {
            if (userId) {
                socket.join(userId);
                console.log(`Socket ${socket.id} joined room ${userId}`);
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });
};
