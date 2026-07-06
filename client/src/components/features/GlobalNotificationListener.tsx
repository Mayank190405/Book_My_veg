"use client";

import { useEffect, useRef } from "react";
import { initSocket } from "@/services/socketService";
import { useUserStore } from "@/store/useUserStore";
import { toast } from "sonner";
import { Volume2, VolumeX, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GlobalNotificationListener() {
    const { user, notificationsEnabled, setNotificationsEnabled } = useUserStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Pre-load the bell sound
        audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
        audioRef.current.volume = 1.0;
    }, []);

    useEffect(() => {
        if (!user?.id) return;

        const socket = initSocket(user.id);
        
        const handleNewOrder = (data: any) => {
            console.log("GLOBAL_LOGISTICS_ALERT:", data);
            
            const title = "New Logistics Event!";
            const options = {
                body: `Order #${data.id?.slice(-8).toUpperCase()} requires immediate attention.`,
                icon: "/favicon.ico", // Or a specific logistics icon
            };

            // 1. Browser Native Push (OS Level)
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification(title, options);
            }

            // 2. Show In-App Toast
            toast.info(title, {
                icon: <BellRing className="h-4 w-4 text-emerald-500" />,
                description: options.body,
                duration: 15000,
                action: {
                    label: "View Request",
                    onClick: () => {
                        if (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STORE_ADMIN") {
                            window.location.href = "/admin/orders";
                        } else if (user.role === "PACKING") {
                            window.location.href = "/packer";
                        } else if (user.role === "DELIVERY_PARTNER") {
                            window.location.href = "/driver";
                        }
                    }
                }
            });

            // 3. Play Sound (if enabled)
            if (notificationsEnabled && audioRef.current) {
                audioRef.current.play().catch(err => {
                    console.warn("Audio auto-play blocked by browser policy. Interaction required.", err);
                    setNotificationsEnabled(false);
                });
            }
        };

        socket.on("OP_NEW_ORDER", handleNewOrder);

        // Request Browser Notification access on mount if not already granted
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        return () => {
            socket.off("OP_NEW_ORDER", handleNewOrder);
        };
    }, [user?.id, notificationsEnabled]);

    if (!notificationsEnabled) {
        return (
            <div className="fixed bottom-6 left-6 z-[9999] animate-in slide-in-from-left-10 duration-500">
                <button 
                    onClick={() => {
                        setNotificationsEnabled(true);
                        if (audioRef.current) {
                            audioRef.current.play();
                            toast.success("Operational alerts unlocked", {
                                description: "Loud bell notifications are now active across all dashboards."
                            });
                        }
                    }}
                    className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-3xl shadow-[0_20px_40px_rgba(220,38,38,0.2)] border border-red-500/20 transition-all hover:scale-105 group"
                >
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse group-hover:animate-none">
                        <VolumeX className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-70">Auditory Monitoring</p>
                        <p className="text-sm font-bold tracking-tight">Tap to Unmute Notifications</p>
                    </div>
                </button>
            </div>
        );
    }

    return null; // Silent observer
}
