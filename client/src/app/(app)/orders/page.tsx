"use client";

import { useEffect, Suspense, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrders } from "@/services/orderService";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { 
    Package, ChevronRight, CheckCircle2, XCircle, Clock, Truck, SlidersHorizontal,
    Loader2, Archive, ShoppingBag, RotateCcw, Eye
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<string, { bg: string, text: string, border: string, icon: any }> = {
    PENDING: { bg: "bg-blue-50/70", text: "text-blue-700", border: "border-blue-100", icon: Clock },
    CONFIRMED: { bg: "bg-indigo-50/70", text: "text-indigo-700", border: "border-indigo-100", icon: CheckCircle2 },
    PROCESSING: { bg: "bg-sky-50/70", text: "text-sky-700", border: "border-sky-100", icon: Loader2 },
    PACKED: { bg: "bg-purple-50/70", text: "text-purple-700", border: "border-purple-100", icon: Archive },
    SHIPPED: { bg: "bg-amber-50/70", text: "text-amber-700", border: "border-amber-100", icon: Truck },
    OUT_FOR_DELIVERY: { bg: "bg-orange-50/70", text: "text-orange-700", border: "border-orange-100", icon: Truck },
    DELIVERED: { bg: "bg-emerald-50/70", text: "text-emerald-700", border: "border-emerald-100", icon: CheckCircle2 },
    CANCELLED: { bg: "bg-rose-50/70", text: "text-rose-700", border: "border-rose-100", icon: XCircle },
    FAILED: { bg: "bg-red-50/70", text: "text-red-700", border: "border-red-100", icon: XCircle },
};

function getRelativeDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    
    const dateZero = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = nowZero.getTime() - dateZero.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const timeStr = date.toLocaleTimeString("en-US", { 
        hour: "2-digit", 
        minute: "2-digit",
        hour12: true
    });

    if (diffDays === 0) {
        return `Today • ${timeStr}`;
    } else if (diffDays === 1) {
        return `Yesterday • ${timeStr}`;
    } else if (diffDays > 1 && diffDays <= 7) {
        return `${diffDays} days ago • ${timeStr}`;
    } else {
        const day = date.getDate();
        const month = date.toLocaleDateString("en-US", { month: "short" });
        const year = date.getFullYear();
        return `${day} ${month}, ${year} • ${timeStr}`;
    }
}

function OrderProgressTracker({ status }: { status: string }) {
    const steps = ["Placed", "Confirmed", "Shipped", "Delivered"];
    let activeStep = 0;
    
    if (["PENDING"].includes(status)) activeStep = 0;
    else if (["CONFIRMED", "PROCESSING", "PACKED"].includes(status)) activeStep = 1;
    else if (["SHIPPED", "OUT_FOR_DELIVERY"].includes(status)) activeStep = 2;
    else if (["DELIVERED"].includes(status)) activeStep = 3;
    else return null; // Hide stepper for CANCELLED or FAILED

    return (
        <div className="w-full py-3">
            <div className="relative flex items-center justify-between w-full">
                {/* Background Line */}
                <div className="absolute left-3 right-3 top-2.5 -translate-y-1/2 h-[3px] bg-slate-100/80 -z-10 rounded-full" />
                
                {/* Active Progress Line */}
                <div 
                    className="absolute left-3 top-2.5 -translate-y-1/2 h-[3px] bg-[#0B7A53] -z-10 transition-all duration-500 rounded-full" 
                    style={{ width: `${(activeStep / (steps.length - 1)) * 94}%` }}
                />
                
                {steps.map((label, index) => {
                    const isCompleted = index < activeStep;
                    const isActive = index === activeStep;
                    
                    return (
                        <div key={label} className="flex flex-col items-center">
                            <div className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-300 border-2",
                                isCompleted 
                                    ? "bg-[#0B7A53] border-[#0B7A53] text-white"
                                    : isActive
                                        ? "bg-white border-[#0B7A53] text-[#0B7A53]"
                                        : "bg-white border-slate-200 text-slate-400"
                            )}>
                                {isCompleted ? "✓" : index + 1}
                            </div>
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-wider mt-1.5",
                                isActive ? "text-[#0B7A53]" : isCompleted ? "text-slate-600" : "text-slate-400"
                            )}>
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function getActionableTimeline(status: string, expectedDetails: string) {
    if (["PENDING", "CONFIRMED"].includes(status)) {
        return "Est. Delivery: Today, within 30 mins";
    } else if (["PROCESSING", "PACKED"].includes(status)) {
        return "Processing - Dispatching shortly";
    } else if (["SHIPPED", "OUT_FOR_DELIVERY"].includes(status)) {
        return "Arriving shortly - Out for delivery";
    } else if (status === "DELIVERED") {
        return `Delivered on ${expectedDetails}`;
    } else {
        return `Order Cancelled`;
    }
}

function OrderCardSkeleton() {
    return (
        <div className="w-full bg-white border border-slate-100 rounded-3xl p-6 space-y-4 animate-pulse">
            <div className="h-6 bg-slate-100 rounded w-1/3" />
            <div className="flex gap-3">
                <div className="w-16 h-16 bg-slate-100 rounded-xl" />
                <div className="w-16 h-16 bg-slate-100 rounded-xl" />
                <div className="w-16 h-16 bg-slate-100 rounded-xl" />
            </div>
            <div className="h-10 bg-slate-100 rounded-xl w-full" />
        </div>
    );
}

function OrderSuccessAnimation({ onDone }: { onDone: () => void }) {
    const [step, setStep] = useState<"connecting" | "verifying" | "confirmed" | "exit">("connecting");
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer1 = setTimeout(() => setStep("verifying"), 1500);
        const timer2 = setTimeout(() => {
            setStep("confirmed");
            confetti({
                particleCount: 120,
                spread: 80,
                origin: { y: 0.45 },
                colors: ['#0b5c3e', '#10b981', '#34d399', '#ffffff']
            });
        }, 3000);
        const timer3 = setTimeout(() => {
            setStep("exit");
            setTimeout(onDone, 600);
        }, 4200);

        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) { clearInterval(interval); return 100; }
                const stepAmount = prev < 50 ? 3 : prev < 85 ? 1.5 : 0.8;
                return Math.min(prev + stepAmount, 100);
            });
        }, 50);

        return () => {
            clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); clearInterval(interval);
        };
    }, [onDone]);

    return (
        <div
            className={cn(
                "fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-600",
                "bg-gradient-to-br from-[#052e20] via-[#0b5c3e] to-[#063824]",
                step === "exit" ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
            )}
            onClick={() => { setStep("exit"); setTimeout(onDone, 600); }}
        >
            <div className="absolute -right-20 -top-20 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col items-center text-center px-8 relative z-10">
                <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
                    {step !== "confirmed" && step !== "exit" ? (
                        <>
                            <div className="absolute inset-0 rounded-full border-4 border-white/10 border-t-[#7fffc4] animate-spin" />
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                <span className="text-3xl animate-pulse">🥬</span>
                            </div>
                        </>
                    ) : (
                        <div className="w-28 h-28 bg-[#10b981]/20 border-2 border-[#10b981]/50 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.5)]">
                            <svg className="w-16 h-16 text-[#7fffc4]" viewBox="0 0 52 52" fill="none">
                                <circle cx="26" cy="26" r="23" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                                <path d="M16 26l7 7 14-14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    )}
                </div>

                <div className="h-20 flex flex-col justify-center mb-6">
                    {step === "connecting" && (
                        <div>
                            <h2 className="text-xl font-black tracking-wide uppercase text-white leading-none">Reserving Veggies</h2>
                            <p className="text-emerald-300 text-[11px] font-black uppercase tracking-[0.2em] mt-3">
                                Securing fresh inventory <span className="animate-pulse">...</span>
                            </p>
                        </div>
                    )}
                    {step === "verifying" && (
                        <div>
                            <h2 className="text-xl font-black tracking-wide uppercase text-white leading-none">Quality Check</h2>
                            <p className="text-emerald-300 text-[11px] font-black uppercase tracking-[0.2em] mt-3">
                                Verifying organic items <span className="animate-pulse">...</span>
                            </p>
                        </div>
                    )}
                    {(step === "confirmed" || step === "exit") && (
                        <div>
                            <h2 className="text-3xl font-black italic tracking-wide uppercase text-[#7fffc4] leading-none">Order Confirmed!</h2>
                            <p className="text-emerald-100 text-[11px] font-black uppercase tracking-[0.2em] mt-3">
                                Fresh batch secured successfully 🎉
                            </p>
                        </div>
                    )}
                </div>

                <div className="w-64 bg-white/10 h-1.5 rounded-full overflow-hidden mb-3">
                    <div
                        className={cn("h-full rounded-full transition-all duration-300",
                            step === "confirmed" || step === "exit" ? "bg-[#7fffc4]" : "bg-gradient-to-r from-emerald-400 to-[#7fffc4]"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function parseDateDetails(dateStr: string) {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString("en-US", { 
        hour: "2-digit", 
        minute: "2-digit",
        hour12: true
    });
    return `${day} ${month}, ${year} • ${time}`;
}

function parseExpectedDate(dateStr: string | null, createdAtStr: string) {
    const target = dateStr ? new Date(dateStr) : new Date(new Date(createdAtStr).getTime() + 24 * 60 * 60 * 1000);
    const day = target.getDate();
    const month = target.toLocaleDateString("en-US", { month: "short" });
    const year = target.getFullYear();
    return `${day} ${month}, ${year}`;
}

function OrdersContent() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"ALL" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED">("ALL");

    const { data: orders, isLoading } = useQuery({
        queryKey: ["orders"],
        queryFn: getOrders,
    });

    const filteredOrders = useMemo(() => {
        const orderList = orders?.data ?? [];
        return orderList.filter((order: any) => {
            if (activeTab === "ALL") return true;
            if (activeTab === "PROCESSING") return ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"].includes(order.status);
            if (activeTab === "SHIPPED") return ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status);
            if (activeTab === "DELIVERED") return order.status === "DELIVERED";
            if (activeTab === "CANCELLED") return ["CANCELLED", "FAILED"].includes(order.status);
            return true;
        });
    }, [orders?.data, activeTab]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#f8faf9] pt-8 px-6">
                <div className="space-y-4 max-w-xl mx-auto">
                    {[...Array(3)].map((_, i) => (
                        <OrderCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    const allOrders = orders?.data || [];

    return (
        <div className="min-h-screen bg-[#f8faf9] pb-40">
            {/* Title Section matching Image 1 */}
            <div className="pt-8 px-6 max-w-2xl mx-auto flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">My Orders</h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-2">
                        Track and manage all your orders
                    </p>
                </div>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#f4fbf7] hover:bg-emerald-50 text-[#0b5c3e] border border-emerald-500/10 text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filter
                </button>
            </div>

            {/* Flat Category Tabs matching Mockup */}
            <div className="bg-[#f8faf9] sticky top-[4.5rem] z-40 py-3">
                <div className="max-w-2xl mx-auto px-6 flex overflow-x-auto gap-3.5 scrollbar-hide">
                    {[
                        { key: "ALL", label: "All Orders" },
                        { key: "PROCESSING", label: "Processing" },
                        { key: "SHIPPED", label: "Shipped" },
                        { key: "DELIVERED", label: "Delivered" },
                        { key: "CANCELLED", label: "Cancelled" }
                    ].map((tab) => {
                        const active = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={cn(
                                    "px-4.5 py-2 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all active:scale-95 border cursor-pointer",
                                    active
                                        ? "bg-[#0B7A53] text-white border-[#0B7A53] shadow-md shadow-emerald-950/15"
                                        : "bg-white text-slate-500 border-slate-100 hover:text-slate-700 hover:bg-slate-50/50"
                                )}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Orders List Container */}
            <main className="mt-4 px-6 max-w-2xl mx-auto">
                {allOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-6 text-center max-w-sm mx-auto">
                        <div className="w-20 h-20 bg-emerald-50 text-[#0B7A53] rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <ShoppingBag className="h-9 w-9" />
                        </div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">No Orders Found</h3>
                        <p className="text-xs font-medium text-slate-400 mt-2 leading-relaxed">
                            It looks like you haven&apos;t placed any orders yet. Let&apos;s get some fresh organic veggies delivered to your doorstep!
                        </p>
                        <button 
                            onClick={() => router.push('/')} 
                            className="mt-8 px-8 py-3.5 bg-[#0B7A53] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-xl hover:bg-[#096645] transition-all active:scale-95 cursor-pointer w-full"
                        >
                            Start Shopping
                        </button>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-sm mx-auto">
                        <div className="w-16 h-16 bg-slate-55 text-slate-300 rounded-full flex items-center justify-center mb-4">
                            <Package className="h-7 w-7" />
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            No {activeTab.toLowerCase()} orders found
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredOrders.map((order: any) => {
                            const dateDetails = getRelativeDate(order.createdAt);
                            const expectedDetails = parseExpectedDate(order.deliveryDate, order.createdAt);
                            const styleData = STATUS_BADGES[order.status] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: Clock };
                            const StatusIcon = styleData.icon;
                            
                            const thumbs = order.items.slice(0, 3).map((i: any) => i.product?.images?.[0]).filter(Boolean);
                            const extraCount = order.items.length - thumbs.length;

                            const firstItem = order.items[0];
                            const firstItemName = firstItem?.product?.name || "Product";
                            const firstItemQtyStr = firstItem?.weight ? ` (${firstItem.weight}${firstItem.weightUnit || ''})` : '';
                            const productNamesSummary = order.items.length > 1
                                ? `${firstItemName}${firstItemQtyStr} + ${order.items.length - 1} more`
                                : `${firstItemName}${firstItemQtyStr}`;

                            const totalQtyCount = order.items.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0);
                            const totalQty = `${totalQtyCount} ${totalQtyCount === 1 ? 'Unit' : 'Units'}`;

                            return (
                                <div
                                    key={order.id}
                                    className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 relative group text-left"
                                >
                                    {/* Link wrapper around card header/middle to navigate */}
                                    <div 
                                        onClick={() => router.push(`/orders/${order.id}`)}
                                        className="cursor-pointer space-y-4"
                                    >
                                        {/* Card Header Row */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-0.5 text-left">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                    ID: #ORD{order.id.slice(-8).toUpperCase()}
                                                </p>
                                                <p className="text-[11.5px] font-black text-slate-800 tracking-tight">
                                                    {dateDetails}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 flex items-center gap-1.5",
                                                    styleData.bg, styleData.text, styleData.border
                                                )}>
                                                    <StatusIcon className="h-3 w-3 stroke-[2.5]" />
                                                    {order.status === "REFUNDED" ? "EXCHANGED" : order.status.replace(/_/g, " ")}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Thumbnails & Pricing Info Row */}
                                        <div className="flex items-center justify-between gap-4 py-3 border-t border-b border-slate-50">
                                            <div className="flex items-center gap-3">
                                                {/* Overlapping circle avatars */}
                                                <div className="flex items-center -space-x-3 shrink-0">
                                                    {thumbs.map((img: string, i: number) => (
                                                        <div 
                                                            key={i}
                                                            className="w-10 h-10 bg-slate-50 border-2 border-white rounded-full relative overflow-hidden flex items-center justify-center p-0.5 shadow-sm"
                                                            style={{ zIndex: 10 - i }}
                                                        >
                                                            <Image
                                                                src={img}
                                                                alt="thumbnail"
                                                                fill
                                                                className="object-contain p-0.5 rounded-full"
                                                            />
                                                        </div>
                                                    ))}
                                                    {extraCount > 0 && (
                                                        <div className="w-10 h-10 bg-slate-100 border-2 border-white rounded-full flex items-center justify-center text-slate-500 font-black text-[9px] shadow-sm z-0">
                                                            +{extraCount}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="text-left space-y-0.5">
                                                    <p className="text-xs font-black text-slate-800 leading-tight">
                                                        {productNamesSummary}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        {order.items.length} {order.items.length === 1 ? "Item" : "Items"} • {totalQty}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <p className="text-base font-black text-slate-900 leading-none">
                                                    ₹{Number(order.totalAmount).toFixed(0)}
                                                </p>
                                                <span className="text-[8.5px] font-black text-[#0B7A53] uppercase tracking-wider mt-0.5 block">
                                                    Paid
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Progress Tracker */}
                                    <OrderProgressTracker status={order.status} />

                                    {/* Card Footer Row */}
                                    <div className="flex items-center justify-between gap-4 mt-3 pt-2 border-t border-slate-50/50">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-left">
                                            {getActionableTimeline(order.status, expectedDetails)}
                                        </span>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {["PENDING", "CONFIRMED", "PROCESSING", "PACKED"].includes(order.status) && (
                                                <button
                                                    onClick={() => router.push(`/orders/${order.id}`)}
                                                    className="px-3.5 py-2 border border-rose-100 hover:border-rose-200 text-rose-600 hover:bg-rose-50/30 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer bg-white"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            <button
                                                onClick={() => router.push(`/orders/${order.id}`)}
                                                className="px-4 py-2.5 bg-[#0B7A53] text-white hover:bg-[#096645] text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm shadow-emerald-950/10 active:scale-95 cursor-pointer"
                                            >
                                                {["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status) 
                                                    ? "Track Order" 
                                                    : order.status === "DELIVERED" 
                                                        ? "Buy Again" 
                                                        : ["CANCELLED", "FAILED"].includes(order.status) 
                                                            ? "Reorder" 
                                                            : "View Details"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function OrdersPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#f8faf9] pt-28 px-6 space-y-4">
                {[...Array(3)].map((_, i) => <OrderCardSkeleton key={i} />)}
            </div>
        }>
            <OrdersContent />
        </Suspense>
    );
}
