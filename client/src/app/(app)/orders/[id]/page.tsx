"use client";

import { useEffect, Suspense, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrderById, cancelOrder } from "@/services/orderService";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, useRouter } from "next/navigation";
import { 
    ArrowLeft, MapPin, Package, CheckCircle2, Circle, Clock, 
    AlertTriangle, Loader2, ChevronLeft, Target, ShieldCheck, 
    ShoppingBag, Truck, PhoneCall, Headphones, HelpCircle, 
    Calendar, CreditCard, Check, ChevronDown, User, Store, Navigation 
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSocket } from "@/services/socketService";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const MOCK_STEPS = [
    { key: "PENDING", label: "Order Placed", timeStr: "10:05 AM" },
    { key: "CONFIRMED", label: "Confirmed", timeStr: "10:20 AM" },
    { key: "PROCESSING", label: "Processing" },
    { key: "PACKED", label: "Packed" },
    { key: "SHIPPED", label: "Shipped" },
    { key: "DELIVERED", label: "Delivered" },
];

function getStepIndex(status: string) {
    const orderOfSteps = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
    let idx = orderOfSteps.indexOf(status);
    if (status === "OUT_FOR_DELIVERY") {
        idx = 4; // Map to SHIPPED index
    }
    return idx;
}

function OrderDetailsContent() {
    const { id } = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [cancelling, setCancelling] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [showItems, setShowItems] = useState(false);
    const mapRef = useRef<any>(null);

    const { data: order, isLoading } = useQuery({
        queryKey: ["order", id],
        queryFn: () => getOrderById(id as string),
        enabled: !!id,
    });

    const storeLat = Number(order?.location?.latitude) || 19.9975;
    const storeLng = Number(order?.location?.longitude) || 73.7898;

    const customerLat = Number((order?.shippingAddress as any)?.latitude) || 19.9830;
    const customerLng = Number((order?.shippingAddress as any)?.longitude) || 73.7702;

    const calculatedDistance = (() => {
        if (!order) return 0;
        const R = 6371; // Earth radius in km
        const dLat = (customerLat - storeLat) * Math.PI / 180;
        const dLon = (customerLng - storeLng) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(storeLat * Math.PI / 180) * Math.cos(customerLat * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    })();

    // Dynamically load Leaflet assets
    useEffect(() => {
        if ((window as any).L) {
            setIsMapLoaded(true);
            return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
            setIsMapLoaded(true);
        };
    }, []);

    // Instantiate map with actual coordinates
    useEffect(() => {
        if (!isMapLoaded || !order) return;

        const L = (window as any).L;
        if (!L) return;

        const mapEl = document.getElementById("tracking-map");
        if (!mapEl) return;

        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }

        const map = L.map("tracking-map", {
            zoomControl: false,
            attributionControl: false
        }).setView([storeLat, storeLng], 13);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            maxZoom: 19
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapRef.current = map;

        // Custom Store Marker with premium ping animation
        const storeIcon = L.divIcon({
            html: `<div class="relative w-10 h-10 rounded-full bg-[#0b5c3e] border-2 border-white flex items-center justify-center text-white text-base shadow-lg"><div class="absolute inset-0 rounded-full bg-[#0b5c3e] animate-ping opacity-25"></div>🏪</div>`,
            className: "",
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        // Custom Customer Marker with premium ping animation
        const userIcon = L.divIcon({
            html: `<div class="relative w-10 h-10 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-base shadow-lg"><div class="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-25"></div>👤</div>`,
            className: "",
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        // Add markers to the map
        L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map)
            .bindTooltip(order.location?.name || "Store", { permanent: true, direction: "top", className: "text-[9px] font-black uppercase tracking-wider bg-white border border-slate-100 rounded px-1.5 py-0.5 shadow-sm text-slate-800" });

        L.marker([customerLat, customerLng], { icon: userIcon }).addTo(map)
            .bindTooltip("You", { permanent: true, direction: "top", className: "text-[9px] font-black uppercase tracking-wider bg-white border border-slate-100 rounded px-1.5 py-0.5 shadow-sm text-slate-800" });

        // Add Polyline connection
        L.polyline([[storeLat, storeLng], [customerLat, customerLng]], {
            color: "#0b5c3e",
            weight: 3,
            dashArray: "5, 8",
            opacity: 0.8
        }).addTo(map);

        // Fit bounds to show both nodes
        map.fitBounds([[storeLat, storeLng], [customerLat, customerLng]], { padding: [50, 50] });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [isMapLoaded, order]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleOrderStatusUpdate = (updatedOrder: any) => {
            if (updatedOrder.id === id) {
                queryClient.invalidateQueries({ queryKey: ["order", id] });
                toast.success(`Order status updated to ${updatedOrder.status.replace(/_/g, " ")}`);
            }
        };

        socket.on("order_status_updated", handleOrderStatusUpdate);

        return () => {
            socket.off("order_status_updated", handleOrderStatusUpdate);
        };
    }, [id, queryClient]);

    const handleCancelOrder = async () => {
        if (!order) return;
        setCancelling(true);
        try {
            await cancelOrder(order.id);
            toast.success("Order cancelled successfully");
            queryClient.invalidateQueries({ queryKey: ["order", id] });
        } catch (error) {
            console.error(error);
            toast.error("Failed to cancel order");
        } finally {
            setCancelling(false);
        }
    };

    if (isLoading) return <OrderDetailSkeleton />;
    
    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-6 text-center px-8 relative overflow-hidden">
                <div className="absolute top-[-10%] right-[10%] w-[300px] h-[300px] rounded-full bg-[#0b5c3e]/5 blur-3xl -z-10" />
                <div className="w-20 h-20 bg-white rounded-[2.5rem] flex items-center justify-center border border-slate-100 mb-2 shadow-sm">
                    <Package className="h-8 w-8 text-[#0b5c3e]/20" />
                </div>
                <div>
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Tracing Lost...</h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">No transmission record was found.</p>
                </div>
                <button onClick={() => router.push('/orders')} className="mt-4 px-8 h-12 bg-[#0b5c3e] rounded-full text-white font-black uppercase tracking-widest text-[10px] shadow-md active:scale-95 transition-all">Back to History</button>
            </div>
        );
    }

    const canCancel = ["PENDING", "CONFIRMED", "PAYMENT_PENDING"].includes(order.status);
    const dateFormatted = new Date(order.createdAt).toLocaleDateString("en-IN", { 
        day: "2-digit", 
        month: "short", 
        year: "numeric" 
    }).toUpperCase();

    const currentStepIdx = getStepIndex(order.status);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f8faf9] via-[#fafafc] to-[#f4f6f5] pb-40 relative overflow-hidden">
            {/* Background floating blurs */}
            <div className="absolute top-[-10%] right-[5%] w-[400px] h-[400px] rounded-full bg-[#0b5c3e]/5 blur-[120px] -z-10 animate-pulse duration-[8000ms]" />
            <div className="absolute top-[35%] left-[-10%] w-[350px] h-[350px] rounded-full bg-emerald-500/5 blur-[100px] -z-10" />

            {/* Tracking Page Header matching Mockup */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex items-center justify-between bg-white/70 backdrop-blur-xl border-b border-slate-100/80 shadow-[0_2px_15px_rgba(0,0,0,0.015)]">
                <button
                    onClick={() => router.push('/orders')}
                    className="w-11 h-11 flex items-center justify-center bg-white rounded-full border border-slate-100 shadow-sm active:scale-90 hover:shadow-md hover:border-slate-200 transition-all text-slate-800"
                >
                    <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                </button>
                <div className="text-center">
                    <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] leading-none mb-1">Live Tracking</h1>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-[0.1em] italic">
                        RECORD: {order.id.slice(-8).toUpperCase()}
                    </p>
                </div>
                <button 
                    onClick={() => router.push('/chat?topic=order&orderId=' + order.id)}
                    className="w-11 h-11 flex items-center justify-center bg-white rounded-full border border-slate-100 shadow-sm active:scale-90 hover:shadow-md hover:border-slate-200 transition-all text-slate-800"
                >
                    <HelpCircle className="h-4.5 w-4.5 text-[#0b5c3e]" />
                </button>
            </header>

            <main className="pt-28 px-4 max-w-xl mx-auto space-y-6">
                
                {/* 3-Column Stats Bar matches mockup */}
                <div className="bg-white/80 backdrop-blur-md rounded-[2.2rem] border border-white/50 p-5 grid grid-cols-3 gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.015)] items-center">
                    <div className="flex items-center gap-3 border-r border-slate-100/60 pr-2">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 text-[#0b5c3e] flex items-center justify-center shrink-0">
                            <Calendar className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Order Date</p>
                            <p className="text-[10px] font-black text-slate-800 leading-tight uppercase truncate">{dateFormatted}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 border-r border-slate-100/60 px-2">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/0 text-amber-600 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Payment</p>
                            <p className={cn("text-[10px] font-black leading-tight uppercase truncate", order.paymentStatus === "PAID" ? "text-emerald-700" : "text-amber-600")}>
                                {order.paymentStatus}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pl-2">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0b5c3e]/10 to-[#0b5c3e]/0 text-[#0b5c3e] flex items-center justify-center shrink-0">
                            <Check className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
                            <p className="text-[10px] font-black text-[#0b5c3e] leading-tight uppercase truncate">
                                {order.status === "REFUNDED" ? "EXCHANGED" : order.status}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Tracking Details Card matches mockup */}
                <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-white/50 shadow-[0_12px_40px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col p-6 space-y-6">
                    
                    {/* Horizontal Progress Timeline at top of card */}
                    <div className="w-full overflow-x-auto pb-2 scrollbar-none">
                        <div className="min-w-[480px] relative pt-2 px-2">
                            {/* Connector Lines */}
                            <div className="absolute top-7 left-8 right-8 h-1.5 bg-slate-100/80 -z-0 rounded-full" />
                            <div 
                                className="absolute top-7 left-8 h-1.5 bg-gradient-to-r from-emerald-600 to-[#0b5c3e] transition-all duration-1000 -z-0 rounded-full shadow-[0_0_8px_rgba(11,92,62,0.2)]" 
                                style={{ width: `${(Math.max(0, currentStepIdx) / 5) * 88}%` }}
                            />

                            <div className="flex justify-between items-start relative z-10">
                                {MOCK_STEPS.map((step, idx) => {
                                    const isDone = idx <= currentStepIdx;
                                    const isActive = idx === currentStepIdx;

                                    return (
                                        <div key={step.key} className="flex flex-col items-center text-center space-y-2.5 w-16 shrink-0">
                                            {/* Step Circle */}
                                            <div className={cn(
                                                "w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500 bg-white",
                                                isActive
                                                    ? "border-[#0b5c3e] bg-[#0b5c3e] text-white shadow-lg shadow-emerald-950/20 scale-110"
                                                    : isDone
                                                    ? "border-[#0b5c3e] bg-[#0b5c3e] text-white"
                                                    : "border-slate-100 bg-white text-slate-350"
                                            )}>
                                                {isDone ? (
                                                    <Check className="w-4.5 h-4.5" strokeWidth={3} />
                                                ) : (
                                                    <span className="text-[10px] font-black">{idx + 1}</span>
                                                )}
                                            </div>

                                            {/* Step Label */}
                                            <div className="min-h-[36px] flex flex-col justify-start">
                                                <p className={cn(
                                                    "text-[8px] font-black uppercase tracking-wider leading-none",
                                                    isActive ? "text-[#0b5c3e]" : isDone ? "text-slate-800" : "text-slate-350"
                                                )}>
                                                    {step.label}
                                                </p>
                                                {step.timeStr && isDone && (
                                                    <span className="text-[7px] text-slate-400 font-bold block mt-1.5 leading-none">
                                                        {step.timeStr}
                                                    </span>
                                                )}
                                                {isActive && (
                                                    <span className="inline-flex items-center gap-1 mx-auto text-[6px] bg-emerald-50 text-[#0b5c3e] border border-emerald-200 font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider mt-1.5 leading-none animate-pulse">
                                                        <span className="w-1 h-1 rounded-full bg-emerald-600 animate-ping" />
                                                        Now
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Leaflet Live Map Section */}
                    <div className="relative overflow-hidden rounded-[2rem] h-72 border-2 border-white shadow-[0_8px_30px_rgba(0,0,0,0.03)] z-10 p-1 bg-white">
                        <div id="tracking-map" className="w-full h-full bg-slate-50 z-0 rounded-[1.8rem] overflow-hidden" />
                    </div>

                    {/* Bottom Logistics Info Card matches mockup */}
                    <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-slate-100/60">
                        <div className="border-r border-slate-100/60 pr-2 text-left flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0b5c3e] shrink-0 mt-0.5">
                                <Store className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[7px] font-black text-slate-450 uppercase tracking-widest mb-0.5">Store</p>
                                <p className="text-[9px] font-black text-slate-800 truncate uppercase leading-none">
                                    {order.location?.name || "FreshHub Main"}
                                </p>
                                <p className="text-[7px] text-slate-400 font-bold truncate mt-1 leading-none uppercase">
                                    {order.location?.address || "Nashik"}
                                </p>
                            </div>
                        </div>
                        <div className="border-r border-slate-100/60 px-2 flex flex-col justify-center items-center">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 mb-1">
                                <Navigation className="w-4 h-4 text-[#0b5c3e]" />
                            </div>
                            <p className="text-[7px] font-black text-slate-450 uppercase tracking-widest leading-none">Distance</p>
                            <p className="text-[10px] font-black text-[#0b5c3e] uppercase mt-1 leading-none">
                                {calculatedDistance > 0.05 ? `${calculatedDistance.toFixed(1)} km` : "1.2 km"}
                            </p>
                        </div>
                        <div className="pl-2 text-right flex items-start justify-end gap-2.5">
                            <div className="min-w-0">
                                <p className="text-[7px] font-black text-slate-455 uppercase tracking-widest mb-0.5">You</p>
                                <p className="text-[9px] font-black text-slate-800 truncate uppercase leading-none">
                                    {(order.shippingAddress as any)?.name || "You"}
                                </p>
                                <p className="text-[7px] text-slate-400 font-bold truncate mt-1 leading-none uppercase">
                                    {(order.shippingAddress as any)?.city || "Nashik"}
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                                <User className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    {/* Estimated Delivery Pill Banner matches mockup */}
                    <div className="bg-[#f4fbf7]/80 border border-[#d2efe0]/50 rounded-2xl p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#0b5c3e]">
                            <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest leading-none">Estimated Dispatch</span>
                        </div>
                        <span className="text-[10px] font-black text-[#0b5c3e] uppercase tracking-wider leading-none">12 - 20 MIN</span>
                    </div>
                </div>

                {/* Logistics & Delivery Details (Driver) Card */}
                {order.deliveryPartner && (
                    <div className="bg-gradient-to-br from-blue-50/40 to-indigo-50/10 backdrop-blur-md rounded-[2.5rem] border border-blue-100/50 p-6 space-y-5 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl -z-10" />
                        <div className="flex items-center justify-between border-b border-blue-100/30 pb-4">
                            <h3 className="text-[10px] font-black text-blue-500 flex items-center gap-2 uppercase tracking-widest">
                                <Truck className="h-3.5 w-3.5" /> Dispatch Registry
                            </h3>
                            {order.deliveryOtp && ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status) && (
                                <span className="bg-emerald-50 text-[#0b5c3e] border border-emerald-100 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider">
                                    OTP: {order.deliveryOtp}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-800 shrink-0 font-black text-sm shadow-sm">
                                {order.deliveryPartner.name?.[0]?.toUpperCase() || "D"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight italic">
                                    {order.deliveryPartner.name || "Delivery Agent"}
                                </p>
                                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-1">
                                    Assigned Courier
                                </p>
                            </div>
                            {order.deliveryPartner.phone && (
                                <a 
                                    href={`tel:${order.deliveryPartner.phone}`}
                                    className="h-10 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border border-slate-150 transition-all active:scale-95 shadow-sm"
                                >
                                    <PhoneCall className="h-3 w-3" /> Call Driver
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Contents Items List with Accordion REDESIGN */}
                <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-white/50 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] space-y-4">
                    <button 
                        type="button"
                        onClick={() => setShowItems(!showItems)}
                        className="w-full flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-2.5">
                            <ShoppingBag className="h-4.5 w-4.5 text-[#0b5c3e]" />
                            <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">
                                Contents ({order.items.length})
                            </span>
                        </div>
                        <span className="text-[10px] font-black text-[#0b5c3e] uppercase tracking-wider group-hover:underline flex items-center gap-1">
                            {showItems ? "Hide Registry" : "Show Registry"}
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", showItems ? "rotate-185" : "rotate-0")} />
                        </span>
                    </button>

                    {showItems && (
                        <div className="space-y-4 pt-4 border-t border-slate-100/60 animate-in fade-in slide-in-from-top-3 duration-300">
                            {order.items.map((item: any) => (
                                <div key={item.id} className="flex gap-4 pb-4 border-b border-slate-100/40 last:border-0 last:pb-0 items-center">
                                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 p-1">
                                        <Image
                                            src={item.product?.images?.[0] || "/placeholder.png"}
                                            alt={item.product?.name || "Product"}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-850 uppercase tracking-tight truncate italic">{item.product?.name || "Premium Produce"}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                                            QTY: {Number(item.quantity) || 0} × <span className="text-[#0b5c3e]">₹{(Number(item.sellingPrice) || 0).toFixed(0)}</span>
                                        </p>
                                    </div>
                                    <p className="text-sm font-black text-slate-800 text-right tabular-nums">₹{((Number(item.quantity) || 0) * (Number(item.sellingPrice) || 0)).toFixed(0)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pricing Breakdown Overview matches Digital Receipt mockup */}
                {(() => {
                    const totalAmt = Number(order.totalAmount);
                    const itemsSubtotal = order.items.reduce((acc: number, item: any) => {
                        return acc + (Number(item.quantity || 0) * Number(item.sellingPrice || 0));
                    }, 0);
                    const dbDelivery = order.deliveryCharge !== undefined && order.deliveryCharge !== null ? Number(order.deliveryCharge) : 0;
                    const deliveryFee = dbDelivery > 0 ? dbDelivery : Math.max(0, totalAmt - itemsSubtotal);
                    const subtotalVal = totalAmt - deliveryFee;

                    return (
                        <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-white/50 p-6 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subtotal</span>
                                <span className="text-xs font-black text-slate-700">₹{subtotalVal.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Delivery</span>
                                <span className={cn(
                                    "text-xs font-black tracking-wider uppercase",
                                    deliveryFee > 0 ? "text-slate-700" : "text-[#0b5c3e] italic text-[9px]"
                                )}>
                                    {deliveryFee > 0 ? `₹${deliveryFee.toFixed(0)}` : "FREE"}
                                </span>
                            </div>

                            {/* Dotted billing separator */}
                            <div className="border-t-2 border-dashed border-slate-150 my-4" />

                            <div className="flex justify-between items-end pt-2">
                                <div className="flex flex-col">
                                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Payable</span>
                                     <span className="text-3xl font-black text-slate-800 tracking-widest italic leading-none tabular-nums">₹{totalAmt.toFixed(0)}</span>
                                </div>
                                <div className="bg-emerald-50/80 border border-emerald-100/50 px-3 py-1.5 rounded-xl text-right">
                                     <div className="flex items-center gap-1 text-[#0b5c3e]">
                                         <ShieldCheck className="h-3.5 w-3.5" />
                                         <span className="text-[8px] font-black uppercase tracking-wider leading-none">Secure Sync</span>
                                     </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Cancel Button */}
                {canCancel && (
                    <div className="pt-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="w-full bg-red-500/5 border-red-500/10 text-red-500 hover:bg-red-500 hover:text-white h-14 rounded-full font-black uppercase tracking-widest text-[9px] transition-all">
                                    Cancel Order
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-white border border-slate-100 rounded-[2.5rem] w-[90%] max-w-sm shadow-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-slate-900 font-black uppercase tracking-widest italic text-center text-lg">Confirm Cancel?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[8px] text-center mt-3 leading-relaxed">
                                        Cancelling an active order terminates shipment registry immediately and cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex flex-col gap-2 mt-6">
                                    <AlertDialogAction onClick={handleCancelOrder} className="bg-red-600 text-white hover:bg-red-500 rounded-xl h-12 font-black uppercase tracking-widest text-[10px]" disabled={cancelling}>
                                        {cancelling ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirm Termination"}
                                    </AlertDialogAction>
                                    <AlertDialogCancel className="bg-slate-50 border border-slate-100 text-slate-400 rounded-xl h-12 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 hover:text-slate-700">Go Back</AlertDialogCancel>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </main>

            {/* Need Help Footer Button matches Mockup */}
            <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100/80 p-4 z-40 flex justify-center shadow-[0_-4px_20px_rgba(0,0,0,0.015)]">
                <button
                    onClick={() => router.push('/chat?topic=order&orderId=' + order.id)}
                    className="w-full max-w-md h-12 rounded-full bg-[#0b5c3e] hover:bg-[#07402a] text-white text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                    <Headphones className="w-4 h-4 shrink-0" />
                    Need help? Contact Support
                </button>
            </div>
        </div>
    );
}

export default function OrderDetailsPage() {
    return (
        <Suspense fallback={<OrderDetailSkeleton />}>
            <OrderDetailsContent />
        </Suspense>
    );
}

function OrderDetailSkeleton() {
    return (
        <div className="min-h-screen bg-[#fafafc] px-6 py-12 space-y-6 max-w-xl mx-auto pt-28">
            <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full bg-white" />
                <Skeleton className="w-40 h-6 bg-white" />
            </div>
            <Skeleton className="w-full h-44 rounded-[2rem] bg-white border border-slate-100" />
            <Skeleton className="w-full h-60 rounded-[2rem] bg-white border border-slate-100" />
            <Skeleton className="w-full h-32 rounded-[2rem] bg-white border border-slate-100" />
        </div>
    );
}
