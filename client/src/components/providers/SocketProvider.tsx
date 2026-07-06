"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { initSocket, disconnectSocket } from "@/services/socketService";

export default function SocketProvider({ children }: { children: React.ReactNode }) {
    const user = useUserStore((state) => state.user);
    const userId = user?.id;

    useEffect(() => {
        if (userId) {
            initSocket(userId);
        } else {
            disconnectSocket();
        }
        // Do not call disconnectSocket() in cleanup on unmount,
        // because we want the socket connection to persist across page navigations
        // and layout mounts/unmounts as a single persistent socket connection.
    }, [userId]);

    return <>{children}</>;
}
