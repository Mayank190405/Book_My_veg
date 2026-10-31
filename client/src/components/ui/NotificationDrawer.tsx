"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
    getNotifications, 
    markNotificationAsRead, 
    markAllNotificationsRead, 
    deleteNotification,
    clearAllNotifications,
    Notification
} from "@/services/notificationService";
import { useUserStore } from "@/store/useUserStore";
import { 
    Bell, 
    ShoppingBag, 
    CheckCircle2, 
    AlertTriangle, 
    Trash2, 
    Sparkles,
    CheckCheck,
    ChevronDown,
    Receipt,
    CreditCard,
    Copy,
    Check,
    ArrowUpRight,
    Zap,
    Tag,
    Leaf,
    Clock,
    ArrowRight,
    ArrowLeft,
    Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface NotificationDrawerProps {
    open: boolean;
    onClose: () => void;
}

// Helper to extract bill ID, coupon codes, amount, and category for rich card presentation
function parseNotificationDetails(title: string, body: string, type?: string) {
    const combined = `${title} ${body}`.toLowerCase();
    
    const isPayment = combined.includes("payment") || 
                      combined.includes("paid") || 
                      combined.includes("settled") || 
                      combined.includes("receipt") ||
                      combined.includes("bill #");

    const isOffer = combined.includes("off") || 
                    combined.includes("coupon") || 
                    combined.includes("discount") || 
                    combined.includes("flat ") ||
                    combined.includes("save ") ||
                    combined.includes("offer");

    const isExpress = combined.includes("15-min") || 
                      combined.includes("express") || 
                      combined.includes("fast delivery");

    const isOrder = type === "ORDER" || 
                    combined.includes("order") || 
                    combined.includes("delivery") || 
                    combined.includes("harvest");

    const billMatch = body.match(/#(BMV[A-Z0-9]+)/i) || title.match(/#(BMV[A-Z0-9]+)/i);
    const amountMatch = body.match(/(₹\s?[\d,]+(?:\.\d+)?)/) || title.match(/(₹\s?[\d,]+(?:\.\d+)?)/);
    const couponMatch = body.match(/(?:coupon|code)\s+([A-Z0-9]{4,12})/i) || title.match(/(?:coupon|code)\s+([A-Z0-9]{4,12})/i);

    return {
        isPayment,
        isOffer,
        isExpress,
        isOrder,
        billId: billMatch ? billMatch[1] : null,
        amount: amountMatch ? amountMatch[1] : null,
        couponCode: couponMatch ? couponMatch[1] : null,
    };
}

// Group notifications by timeline
function getGroupLabel(dateString?: string): string {
    if (!dateString) return "Recent";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Recent";
    const now = new Date();
    
    const isToday = now.toDateString() === date.toDateString();
    if (isToday) return "Today";

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === date.toDateString()) return "Yesterday";

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return "This Week";

    return "Earlier";
}

export default function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
    const router = useRouter();
    const { user, _hasHydrated } = useUserStore();
    const queryClient = useQueryClient();
    const [mounted, setMounted] = useState(false);
    const [activeFilter, setActiveFilter] = useState<"all" | "orders" | "payments" | "offers">("all");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
    const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        setMounted(true);
        try {
            const cached = localStorage.getItem("bookmyveg_local_notifications");
            if (cached) {
                const parsed = JSON.parse(cached);
                const realOnes = Array.isArray(parsed) 
                    ? parsed.filter((n: any) => !n.id?.startsWith("bmv-welcome")) 
                    : [];
                setLocalNotifications(realOnes);
                localStorage.setItem("bookmyveg_local_notifications", JSON.stringify(realOnes));
            } else {
                setLocalNotifications([]);
            }
        } catch {
            setLocalNotifications([]);
        }
    }, []);

    const isLoggedIn = _hasHydrated && !!user && user.name !== "Guest" && user.role !== "GUEST";

    const { data: serverNotifications, isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
        enabled: isLoggedIn,
        refetchInterval: 30000,
    });

    const allNotifications: Notification[] = isLoggedIn 
        ? (serverNotifications && serverNotifications.length > 0 ? serverNotifications : localNotifications)
        : localNotifications;

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
            toast.success("All notifications marked as read ✓");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteNotification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    const clearAllMutation = useMutation({
        mutationFn: clearAllNotifications,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success("All notifications cleared");
        }
    });

    const handleMarkAsRead = (id: string) => {
        if (isLoggedIn && serverNotifications && serverNotifications.some(n => n.id === id)) {
            markReadMutation.mutate(id);
        } else {
            const updated = localNotifications.map(n => n.id === id ? { ...n, isRead: true } : n);
            setLocalNotifications(updated);
            try {
                localStorage.setItem("bookmyveg_local_notifications", JSON.stringify(updated));
            } catch {}
        }
    };

    const handleMarkAllRead = () => {
        if (isLoggedIn && serverNotifications && serverNotifications.length > 0) {
            markAllReadMutation.mutate();
        }
        const updated = localNotifications.map(n => ({ ...n, isRead: true }));
        setLocalNotifications(updated);
        try {
            localStorage.setItem("bookmyveg_local_notifications", JSON.stringify(updated));
        } catch {}
        toast.success("All notifications marked as read ✓");
    };

    const handleDelete = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (isLoggedIn && serverNotifications && serverNotifications.some(n => n.id === id)) {
            deleteMutation.mutate(id);
        } else {
            const updated = localNotifications.filter(n => n.id !== id);
            setLocalNotifications(updated);
            try {
                localStorage.setItem("bookmyveg_local_notifications", JSON.stringify(updated));
            } catch {}
        }
        toast.success("Notification removed");
    };

    const handleClearAll = () => {
        if (isLoggedIn && serverNotifications && serverNotifications.length > 0) {
            clearAllMutation.mutate();
        }
        setLocalNotifications([]);
        try {
            localStorage.setItem("bookmyveg_local_notifications", JSON.stringify([]));
        } catch {}
        toast.success("All notifications cleared");
    };

    const handleCopyBill = (e: React.MouseEvent, billId: string) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(billId);
        setCopiedId(billId);
        toast.success(`Bill #${billId} copied to clipboard! 📋`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleCopyCoupon = (e: React.MouseEvent, couponCode: string) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(couponCode);
        setCopiedCoupon(couponCode);
        toast.success(`Coupon code ${couponCode} copied! 🎉`);
        setTimeout(() => setCopiedCoupon(null), 2000);
    };

    const handleNavigate = (path: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        onClose();
        router.push(path);
    };

    // Filter notifications by category tab
    const filteredNotifications = useMemo(() => {
        if (activeFilter === "all") return allNotifications;
        if (activeFilter === "orders") {
            return allNotifications.filter(n => {
                const details = parseNotificationDetails(n.title, n.body, n.type);
                return details.isOrder || details.isExpress;
            });
        }
        if (activeFilter === "payments") {
            return allNotifications.filter(n => {
                const details = parseNotificationDetails(n.title, n.body, n.type);
                return details.isPayment;
            });
        }
        if (activeFilter === "offers") {
            return allNotifications.filter(n => {
                const details = parseNotificationDetails(n.title, n.body, n.type);
                return details.isOffer;
            });
        }
        return allNotifications;
    }, [allNotifications, activeFilter]);

    // Group filtered notifications by date groups
    const groupedNotifications = useMemo(() => {
        const groups: { [key: string]: Notification[] } = {};
        const order = ["Today", "Yesterday", "This Week", "Earlier", "Recent"];

        filteredNotifications.forEach(n => {
            const label = getGroupLabel(n.createdAt);
            if (!groups[label]) groups[label] = [];
            groups[label].push(n);
        });

        return order
            .filter(label => groups[label] && groups[label].length > 0)
            .map(label => ({
                label,
                items: groups[label]
            }));
    }, [filteredNotifications]);

    const unreadCount = allNotifications.filter(n => !n.isRead).length;
    const ordersCount = allNotifications.filter(n => {
        const d = parseNotificationDetails(n.title, n.body, n.type);
        return d.isOrder || d.isExpress;
    }).length;
    const paymentCount = allNotifications.filter(n => parseNotificationDetails(n.title, n.body, n.type).isPayment).length;
    const offersCount = allNotifications.filter(n => parseNotificationDetails(n.title, n.body, n.type).isOffer).length;

    if (!mounted) return null;

    return createPortal(
        <div
            className={cn(
                "fixed inset-0 z-[500] w-full h-[100dvh] bg-slate-50 dark:bg-[#0f1117] text-slate-900 dark:text-white flex flex-col overflow-hidden transition-all duration-300 ease-out",
                open ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-full opacity-0 pointer-events-none"
            )}
        >
            <div className="w-full max-w-2xl mx-auto flex flex-col h-full bg-slate-50 dark:bg-[#0f1117] overflow-hidden">
                {/* Full-Screen Top Header */}
                <div className="pt-[max(env(safe-area-inset-top),1rem)] px-4 sm:px-6 pb-3.5 shrink-0 bg-white dark:bg-[#14161f] border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 flex items-center justify-center text-slate-700 dark:text-white transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs"
                            aria-label="Back"
                            title="Back"
                        >
                            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                                    Notifications
                                </h2>
                                {unreadCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs shadow-emerald-600/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                        {unreadCount} new
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                                        All read ✓
                                    </span>
                                )}
                            </div>
                            <p className="text-[11.5px] font-medium text-emerald-800 dark:text-emerald-400 mt-0.5 flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3 fill-current text-emerald-600" /> Farm harvest, live orders & deals
                            </p>
                        </div>
                    </div>

                    {/* Quick Batch Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllRead}
                                disabled={markAllReadMutation.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95 border border-emerald-500/20 shadow-xs"
                                title="Mark all notifications as read"
                            >
                                <CheckCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                                <span className="hidden sm:inline">Mark read</span>
                            </button>
                        )}
                        {allNotifications.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                disabled={clearAllMutation.isPending}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 dark:bg-white/10 dark:hover:bg-rose-500/20 dark:text-slate-400 dark:hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                                title="Clear all notifications"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Capsule Tabs */}
                <div className="px-5 py-2.5 shrink-0 bg-white/80 dark:bg-[#14161f]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    <button
                        type="button"
                        onClick={() => setActiveFilter("all")}
                        className={cn(
                            "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5",
                            activeFilter === "all"
                                ? "bg-[#0c392c] text-white shadow-xs shadow-emerald-950/20"
                                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10"
                        )}
                    >
                        <span>All</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                            activeFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                        )}>
                            {allNotifications.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveFilter("orders")}
                        className={cn(
                            "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5",
                            activeFilter === "orders"
                                ? "bg-[#0c392c] text-white shadow-xs shadow-emerald-950/20"
                                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10"
                        )}
                    >
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>Orders & Delivery</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                            activeFilter === "orders" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                        )}>
                            {ordersCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveFilter("payments")}
                        className={cn(
                            "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5",
                            activeFilter === "payments"
                                ? "bg-[#0c392c] text-white shadow-xs shadow-emerald-950/20"
                                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10"
                        )}
                    >
                        <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Bills & Receipts</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                            activeFilter === "payments" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                        )}>
                            {paymentCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveFilter("offers")}
                        className={cn(
                            "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5",
                            activeFilter === "offers"
                                ? "bg-[#0c392c] text-white shadow-xs shadow-emerald-950/20"
                                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10"
                        )}
                    >
                        <Tag className="w-3.5 h-3.5 text-rose-500" />
                        <span>Offers & Deals</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                            activeFilter === "offers" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                        )}>
                            {offersCount}
                        </span>
                    </button>
                </div>

                {/* Notifications Feed Area */}
                <div className="w-full flex-1 overflow-y-auto px-4 py-3.5 space-y-4 pb-24 scrollbar-hide">
                    {isLoading ? (
                        <div className="space-y-3 py-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-24 bg-white dark:bg-white/5 rounded-2xl animate-pulse border border-slate-200/50" />
                            ))}
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3.5 text-center">
                            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                                <Leaf className="h-8 w-8 stroke-[1.8]" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    {activeFilter === "all" ? "You're all caught up! 🥬" : "No updates in this tab"}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[270px] mx-auto leading-relaxed">
                                    Daily farm harvest updates, 15-min delivery dispatches, and cashback receipts appear right here.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => handleNavigate("/categories")}
                                    className="px-4 py-2 rounded-xl bg-[#0c392c] hover:bg-[#124d3c] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                                >
                                    <span>Browse Fresh Veggies</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        groupedNotifications.map((group) => (
                            <div key={group.label} className="space-y-2.5">
                                {/* Timeline Group Header */}
                                <div className="sticky top-0 z-10 flex items-center gap-2 py-1 bg-slate-50/95 dark:bg-[#0f1117]/95 backdrop-blur-xs">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                        {group.label}
                                    </span>
                                    <span className="h-[1px] flex-1 bg-slate-200/80 dark:bg-white/10" />
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                        {group.items.length} {group.items.length === 1 ? "update" : "updates"}
                                    </span>
                                </div>

                                {/* Notification Cards */}
                                <div className="space-y-2.5">
                                    {group.items.map((notification, idx: number) => {
                                        const parsedDate = notification.createdAt ? new Date(notification.createdAt) : new Date();
                                        const timeAgo = !isNaN(parsedDate.getTime()) 
                                            ? formatDistanceToNow(parsedDate, { addSuffix: true }) 
                                            : "Recent";

                                        const { 
                                            isPayment, 
                                            isOffer, 
                                            isExpress, 
                                            isOrder, 
                                            billId, 
                                            amount, 
                                            couponCode 
                                        } = parseNotificationDetails(notification.title, notification.body, notification.type);

                                        // Determine category tag label & color theme
                                        let categoryTag = "Update";
                                        let categoryTagStyle = "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";

                                        if (isPayment) {
                                            categoryTag = "🧾 Bill Settled";
                                            categoryTagStyle = "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20";
                                        } else if (isOffer) {
                                            categoryTag = "🎁 Special Offer";
                                            categoryTagStyle = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20";
                                        } else if (isExpress) {
                                            categoryTag = "⚡ 15-Min Express";
                                            categoryTagStyle = "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20";
                                        } else if (isOrder) {
                                            categoryTag = "📦 Order Alert";
                                            categoryTagStyle = "bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/20";
                                        } else {
                                            categoryTag = "🥬 Farm Harvest";
                                            categoryTagStyle = "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20";
                                        }

                                        return (
                                            <div
                                                key={notification.id}
                                                onClick={() => {
                                                    if (!notification.isRead) {
                                                        handleMarkAsRead(notification.id);
                                                    }
                                                }}
                                                className={cn(
                                                    "relative flex gap-3.5 p-3.5 rounded-2xl transition-all duration-200 cursor-pointer group select-none border",
                                                    notification.isRead
                                                        ? "bg-white/80 dark:bg-[#151722] border-slate-200/70 dark:border-white/5 opacity-80 hover:opacity-100 hover:border-slate-300 shadow-xs"
                                                        : "bg-white dark:bg-[#181a26] border-emerald-500/30 dark:border-emerald-500/25 shadow-[0_4px_18px_rgba(5,150,105,0.06)] hover:shadow-[0_6px_22px_rgba(5,150,105,0.12)] hover:border-emerald-500/50"
                                                )}
                                                style={{ animationDelay: `${idx * 25}ms` }}
                                            >
                                                {/* Left Accent Glow Stripe for Unread */}
                                                {!notification.isRead && (
                                                    <div className="absolute left-0 top-3.5 bottom-3.5 w-1 bg-gradient-to-b from-emerald-500 via-teal-500 to-emerald-600 rounded-r-full shadow-xs shadow-emerald-500/50" />
                                                )}

                                                {/* Category Dynamic Squircle Icon */}
                                                <div className="shrink-0 relative self-start mt-0.5">
                                                    <div className={cn(
                                                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs",
                                                        isPayment
                                                            ? "bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 text-white shadow-emerald-700/25"
                                                            : isOffer
                                                            ? "bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 text-white shadow-rose-600/25"
                                                            : isExpress
                                                            ? "bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 text-white shadow-amber-600/25"
                                                            : isOrder
                                                            ? "bg-gradient-to-tr from-teal-700 to-emerald-600 text-white shadow-teal-700/25"
                                                            : "bg-gradient-to-tr from-[#0c392c] to-emerald-700 text-white shadow-[#0c392c]/25"
                                                    )}>
                                                        {isPayment ? (
                                                            <Receipt className="h-5 w-5 stroke-[2.2]" />
                                                        ) : isOffer ? (
                                                            <Tag className="h-5 w-5 stroke-[2.2]" />
                                                        ) : isExpress ? (
                                                            <Zap className="h-5 w-5 stroke-[2.2] fill-current" />
                                                        ) : isOrder ? (
                                                            <ShoppingBag className="h-5 w-5 stroke-[2.2]" />
                                                        ) : (
                                                            <Sparkles className="h-5 w-5 stroke-[2.2]" />
                                                        )}
                                                    </div>

                                                    {/* Verified Check Badge for Payments */}
                                                    {isPayment && (
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-[#181a26] shadow-xs">
                                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Notification Content Body */}
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    {/* Top Row: Tag + Timestamp + Unread Dot + Delete Button */}
                                                    <div className="flex items-center justify-between gap-1.5">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className={cn(
                                                                "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0",
                                                                categoryTagStyle
                                                            )}>
                                                                {categoryTag}
                                                            </span>
                                                            {!notification.isRead && (
                                                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-600 text-white tracking-wider uppercase shadow-xs">
                                                                    NEW
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                                <Clock className="w-2.8 h-2.8 opacity-70" />
                                                                {timeAgo}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDelete(notification.id, e)}
                                                                disabled={deleteMutation.isPending}
                                                                title="Delete notification"
                                                                className="w-6 h-6 rounded-full hover:bg-rose-50 text-slate-300 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover:opacity-100 active:scale-90"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Notification Title */}
                                                    <h4 className={cn(
                                                        "text-[13px] leading-snug",
                                                        notification.isRead 
                                                            ? "font-bold text-slate-700 dark:text-white/85" 
                                                            : "font-black text-slate-900 dark:text-white"
                                                    )}>
                                                        {notification.title}
                                                    </h4>

                                                    {/* Body Description */}
                                                    <p className={cn(
                                                        "text-[12px] leading-relaxed",
                                                        notification.isRead 
                                                            ? "text-slate-500 dark:text-slate-400" 
                                                            : "font-medium text-slate-700 dark:text-white/90"
                                                    )}>
                                                        {notification.body}
                                                    </p>

                                                    {/* Actionable Interactive Chips & CTAs */}
                                                    <div className="pt-1 flex flex-wrap items-center gap-2">
                                                        {/* Bill Amount Badge */}
                                                        {amount && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-black text-[11px] border border-emerald-500/25 shadow-xs">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>{amount} Settled</span>
                                                            </span>
                                                        )}

                                                        {/* Copy Bill ID Button */}
                                                        {billId && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleCopyBill(e, billId)}
                                                                title="Copy Bill ID"
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-bold transition-all cursor-pointer border border-slate-200/70 dark:border-white/5 active:scale-95"
                                                            >
                                                                <span>#{billId.slice(0, 10)}</span>
                                                                {copiedId === billId ? (
                                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                                ) : (
                                                                    <Copy className="w-3 h-3 text-slate-400" />
                                                                )}
                                                            </button>
                                                        )}

                                                        {/* Copy Coupon Code Button */}
                                                        {couponCode && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleCopyCoupon(e, couponCode)}
                                                                title="Copy Coupon Code"
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-black transition-all cursor-pointer border border-rose-500/20 active:scale-95 shadow-xs"
                                                            >
                                                                <Tag className="w-3 h-3 text-rose-500" />
                                                                <span>{couponCode}</span>
                                                                {copiedCoupon === couponCode ? (
                                                                    <span className="text-[10px] text-emerald-600 font-bold ml-1">Copied! ✓</span>
                                                                ) : (
                                                                    <Copy className="w-3 h-3 text-rose-400 ml-0.5" />
                                                                )}
                                                            </button>
                                                        )}

                                                        {/* Direct Category Action CTA */}
                                                        {isPayment ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleNavigate("/orders", e)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer active:scale-95 ml-auto"
                                                            >
                                                                <span>View Orders</span>
                                                                <ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        ) : isOffer ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleNavigate("/categories", e)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer active:scale-95 ml-auto"
                                                            >
                                                                <span>Redeem Now</span>
                                                                <ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        ) : isExpress ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleNavigate("/categories", e)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer active:scale-95 ml-auto"
                                                            >
                                                                <span>Order Express</span>
                                                                <ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleNavigate("/categories", e)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer active:scale-95 ml-auto"
                                                            >
                                                                <span>Explore Harvest</span>
                                                                <ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
