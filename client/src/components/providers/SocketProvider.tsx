"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { initSocket, disconnectSocket } from "@/services/socketService";

export default function SocketProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUserStore();

    useEffect(() => {
        if (user) {
            initSocket(user.id);
        } else {
            disconnectSocket();
        }

        return () => {
            disconnectSocket();
        };
    }, [user]);

    return <>{children}</>;
}
