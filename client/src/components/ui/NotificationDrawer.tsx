"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
    getNotifications, 
    markNotificationAsRead, 
    markAllNotificationsRead, 
    deleteNotification 
} from "@/services/notificationService";
import { useUserStore } from "@/store/useUserStore";
import { 
    X, 
    Bell, 
    ShoppingBag, 
    CheckCircle2, 
    AlertTriangle, 
    Info, 
    Trash2, 
    Sparkles,
    CheckCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface NotificationDrawerProps {
    open: boolean;
    onClose: () => void;
}

export default function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
    const { user, _hasHydrated } = useUserStore();
    const queryClient = useQueryClient();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const { data: notifications, isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
        enabled: _hasHydrated && !!user,
        refetchInterval: 30000,
    });

    const markReadMutation = useMutation({
        mutationFn: markNotificationAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    const markAllReadMutation = useMutation({
        mutationFn: markAllNotificationsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteNotification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    const getIcon = (type: string) => {
        switch (type) {
            case "ORDER":
                return <ShoppingBag className="h-5 w-5 text-amber-600" />;
            case "SUCCESS":
                return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
            case "WARNING":
            case "ALERT":
                return <AlertTriangle className="h-5 w-5 text-rose-600" />;
            default:
                return <Info className="h-5 w-5 text-blue-600" />;
        }
    };

    const getBgColor = (type: string, isRead: boolean) => {
        if (isRead) return "bg-card hover:bg-secondary/20";
        switch (type) {
            case "ORDER":
                return "bg-amber-500/5 hover:bg-amber-500/10 border-l-4 border-l-amber-500";
            case "SUCCESS":
                return "bg-emerald-500/5 hover:bg-emerald-500/10 border-l-4 border-l-emerald-500";
            case "WARNING":
            case "ALERT":
                return "bg-rose-500/5 hover:bg-rose-500/10 border-l-4 border-l-rose-500";
            default:
                return "bg-blue-500/5 hover:bg-blue-500/10 border-l-4 border-l-blue-500";
        }
    };

    const getIconContainerColor = (type: string) => {
        switch (type) {
            case "ORDER":
                return "bg-amber-500/10 border border-amber-500/20";
            case "SUCCESS":
                return "bg-emerald-500/10 border border-emerald-500/20";
            case "WARNING":
            case "ALERT":
                return "bg-rose-500/10 border border-rose-500/20";
            default:
                return "bg-blue-500/10 border border-blue-500/20";
        }
    };

    if (!mounted) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                className={cn(
                    "fixed inset-0 bg-black/60 z-[100] transition-all duration-500",
                    open ? "opacity-100 backdrop-blur-md pointer-events-auto" : "opacity-0 backdrop-blur-0 pointer-events-none"
                )}
            />

            {/* Notification Panel */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 z-[110] bg-background rounded-t-[3rem] shadow-[0_-20px_80px_rgba(0,0,0,0.1)] transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col items-center",
                    "max-h-[85vh] w-full border-t border-border",
                    open ? "translate-y-0" : "translate-y-full"
                )}
            >
                {/* Drag Handle Accent */}
                <div className="w-full flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1.5 bg-secondary rounded-full" />
                </div>

                {/* Header */}
                <div className="w-full flex items-center justify-between px-8 py-5 border-b border-border">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                            <Bell className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-foreground uppercase tracking-tight leading-none">
                                Notifications
                            </h2>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3 fill-current" /> Live updates and alerts
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {notifications && notifications.some(n => !n.isRead) && (
                            <button
                                onClick={() => markAllReadMutation.mutate()}
                                disabled={markAllReadMutation.isPending}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 text-[#0b5c3e] hover:bg-emerald-100 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark all read
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-3 rounded-2xl bg-secondary text-foreground/40 hover:bg-secondary/80 transition-all active:scale-90 border border-border"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Notification List Content */}
                <div className="w-full flex-1 overflow-y-auto px-6 py-4 space-y-3 max-w-2xl scrollbar-hide">
                    {isLoading ? (
                        <div className="space-y-3 py-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-20 bg-secondary/30 rounded-[1.5rem] animate-pulse" />
                            ))}
                        </div>
                    ) : !notifications || notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                            <div className="relative">
                                <Bell className="h-24 w-24 text-secondary/50" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-4xl animate-bounce">📭</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-foreground uppercase tracking-tight">No notifications yet</h3>
                                <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest mt-2 max-w-[240px] mx-auto leading-relaxed">
                                    We&apos;ll notify you here when there are updates to your orders or account.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 pb-6">
                            {notifications.map((notification, idx: number) => {
                                const parsedDate = notification.createdAt ? new Date(notification.createdAt) : new Date();
                                const timeAgo = !isNaN(parsedDate.getTime()) 
                                    ? formatDistanceToNow(parsedDate, { addSuffix: true }) 
                                    : "";

                                return (
                                    <div
                                        key={notification.id}
                                        onClick={() => {
                                            if (!notification.isRead) {
                                                markReadMutation.mutate(notification.id);
                                            }
                                        }}
                                        className={cn(
                                            "flex gap-4 border border-border rounded-[1.5rem] p-4 items-start transition-all cursor-pointer group animate-in slide-in-from-bottom-4 duration-500",
                                            getBgColor(notification.type, notification.isRead)
                                        )}
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                            getIconContainerColor(notification.type)
                                        )}>
                                            {getIcon(notification.type)}
                                        </div>

                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className={cn(
                                                    "text-xs uppercase tracking-wider text-left",
                                                    notification.isRead ? "font-bold text-foreground/75" : "font-black text-foreground"
                                                )}>
                                                    {notification.title}
                                                </h4>
                                                <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider shrink-0">
                                                    {timeAgo}
                                                </span>
                                            </div>
                                            <p className={cn(
                                                "text-[11px] leading-relaxed text-left",
                                                notification.isRead ? "text-muted-foreground" : "font-medium text-foreground/90"
                                            )}>
                                                {notification.body}
                                            </p>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteMutation.mutate(notification.id);
                                            }}
                                            disabled={deleteMutation.isPending}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
}
