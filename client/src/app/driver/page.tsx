"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { Toaster, toast } from "sonner";
import { 
    Package, 
    MapPin, 
    Truck, 
    CheckCircle2, 
    IndianRupee, 
    CreditCard, 
    ChevronDown, 
    ChevronUp,
    Camera,
    ShieldCheck,
    Smartphone,
    Link as LinkIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { initSocket } from "@/services/socketService";
import { useUserStore } from "@/store/useUserStore";
import { Volume2, VolumeX } from "lucide-react";

const DRIVER_STATUSES = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED"];

export default function DriverDashboard() {
    const { user } = useUserStore();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    
    // Verification states
    const [otp, setOtp] = useState("");
    const [photoUrl, setPhotoUrl] = useState("");
    const [showOtpInput, setShowOtpInput] = useState(false);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await api.get("/orders/driver/assigned");
            setOrders(res.data.data || []);
        } catch (error) {
            toast.error("Failed to fetch assigned orders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const sendOtp = async (orderId: string) => {
        try {
            await api.post(`/orders/driver/${orderId}/otp`);
            toast.success("Verification code sent to customer");
            setShowOtpInput(true);
        } catch (error) {
            toast.error("Failed to send OTP");
        }
    };

    const generatePaymentLink = async (orderId: string) => {
        try {
            const res = await api.post(`/payments/${orderId}/generate-link`);
            if (res.data.paymentLink) {
                window.open(res.data.paymentLink, '_blank');
                toast.success("Payment link generated");
            }
        } catch (error) {
            toast.error("Failed to generate payment link");
        }
    };

    const updateStatus = async (orderId: string, newStatus: string) => {
        if (newStatus === "DELIVERED") {
            if (!otp) {
                toast.error("OTP is required for completion");
                return;
            }
            if (!photoUrl) {
                toast.error("Delivery photo is required");
                return;
            }
        }

        setUpdatingId(orderId);
        try {
            await api.patch(`/orders/${orderId}/status`, { 
                status: newStatus,
                deliveryOtp: otp,
                deliveryPhoto: photoUrl
            });
            toast.success(`Order marked as ${newStatus}`);
            resetStates();
            fetchOrders();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Status update failed");
        } finally {
            setUpdatingId(null);
        }
    };

    const resetStates = () => {
        setOtp("");
        setPhotoUrl("");
        setShowOtpInput(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Synchronizing Signals...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-32">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Active Handover Queue
                </h2>
            </div>
            {orders.map((order) => {
                const isExpanded = expandedOrder === order.id;
                const isCompleted = ["DELIVERED", "FAILED", "RETURNED", "CANCELLED"].includes(order.status);
                
                return (
                    <div key={order.id} className={cn("bg-white rounded-[2rem] overflow-hidden transition-all duration-300", 
                        isExpanded ? "shadow-2xl ring-1 ring-emerald-500/10" : "shadow-sm border border-slate-100"
                    )}>
                        <div 
                            className={cn("p-5 cursor-pointer flex items-start gap-4 transition-colors", isExpanded ? "bg-slate-50/50" : "hover:bg-slate-50/30")}
                            onClick={() => {
                                setExpandedOrder(isExpanded ? null : order.id);
                                if (!isExpanded) resetStates();
                            }}
                        >
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors shadow-inner", 
                                isCompleted ? "bg-slate-100 text-slate-400" : "bg-emerald-100 text-emerald-600"
                            )}>
                                {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-900 truncate">{order.user?.name || "Premium Client"}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 flex items-center gap-1">
                                            <MapPin className="h-3 w-3 shrink-0" /> {order.shippingAddress?.fullAddress}
                                        </p>
                                    </div>
                                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0", 
                                        isCompleted ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-600"
                                    )}>
                                        {order.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="p-6 border-t border-slate-100 bg-white space-y-8 animate-in slide-in-from-top-2 duration-300">
                                {/* Delivery Logistics */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Delivery Console</h4>
                                        <div className="px-2 py-0.5 bg-emerald-50 rounded-full">
                                            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Active Routing</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner space-y-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-[1.2rem] bg-white flex items-center justify-center shadow-sm shrink-0 border border-slate-100">
                                                <MapPin className="h-5 w-5 text-emerald-600" />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Destination Details</p>
                                                 <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                                    {typeof order.shippingAddress === 'string' 
                                                        ? order.shippingAddress 
                                                        : (
                                                            <>
                                                                {order.shippingAddress?.fullAddress || order.shippingAddress?.address || "No primary address found"}
                                                                {(order.shippingAddress?.city || order.shippingAddress?.pincode || order.shippingAddress?.landmark) && (
                                                                    <span className="block text-[10px] font-black text-emerald-600/60 mt-2 uppercase tracking-[0.1em]">
                                                                        {order.shippingAddress.city} {order.shippingAddress.pincode ? `(${order.shippingAddress.pincode})` : ''}
                                                                        {order.shippingAddress.landmark && ` • NEAR ${order.shippingAddress.landmark}`}
                                                                    </span>
                                                                )}
                                                            </>
                                                          )}
                                                 </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                             <a 
                                                 href={`tel:${order.user?.phone}`}
                                                 className="h-16 rounded-[1.5rem] bg-white border border-slate-100 flex items-center justify-center gap-3 text-slate-700 hover:bg-slate-50 transition-all shadow-sm group active:scale-95"
                                             >
                                                 <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center transition-colors group-hover:bg-emerald-100">
                                                    <Smartphone className="h-4 w-4 text-emerald-600" />
                                                 </div>
                                                 <span className="text-[10px] font-black uppercase tracking-widest">Call Client</span>
                                             </a>
                                             <a 
                                                 href={order.shippingAddress?.latitude && order.shippingAddress?.longitude 
                                                    ? `https://www.google.com/maps/search/?api=1&query=${order.shippingAddress.latitude},${order.shippingAddress.longitude}`
                                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                                        typeof order.shippingAddress === 'string' 
                                                            ? order.shippingAddress 
                                                            : (order.shippingAddress?.fullAddress || order.shippingAddress?.address || "")
                                                      )}`}
                                                 target="_blank"
                                                 rel="noopener noreferrer"
                                                 className="h-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center gap-3 text-white hover:bg-black transition-all shadow-xl shadow-slate-200 group active:scale-95"
                                             >
                                                 <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center transition-colors group-hover:bg-white/20">
                                                    <MapPin className="h-4 w-4 text-emerald-400" />
                                                 </div>
                                                 <span className="text-[10px] font-black uppercase tracking-widest">Map Visit</span>
                                             </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Console */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Protocol</h4>
                                        <CreditCard className="h-4 w-4 text-slate-300" />
                                    </div>

                                    {!order.isPaid ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button 
                                                variant="outline"
                                                onClick={() => generatePaymentLink(order.id)}
                                                className="h-14 rounded-2xl border-emerald-100 hover:bg-emerald-50 text-emerald-700 font-bold text-xs flex flex-col items-center justify-center gap-1"
                                            >
                                                <LinkIcon className="h-4 w-4" />
                                                Online Link
                                            </Button>
                                            <Button 
                                                onClick={() => api.patch(`/orders/${order.id}/payment`, { isPaid: true }).then(() => fetchOrders())}
                                                className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex flex-col items-center justify-center gap-1"
                                            >
                                                <IndianRupee className="h-4 w-4" />
                                                Cash/COD
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-center gap-3 text-emerald-700 font-bold text-sm">
                                            <ShieldCheck className="h-5 w-5" /> Payment Secured
                                        </div>
                                    )}
                                </div>

                                {/* Verification Protocol */}
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Completion Protocol</h4>
                                    
                                    <div className="grid grid-cols-1 gap-6">
                                        {/* Camera Section */}
                                        <div 
                                            onClick={() => setPhotoUrl("https://images.unsplash.com/photo-1531315630201-bb15bbeb166a?q=80&w=2070&auto=format&fit=crop")}
                                            className={cn("h-40 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
                                            photoUrl ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50")}
                                        >
                                            {photoUrl ? (
                                                <img src={photoUrl} className="w-full h-full object-cover rounded-[1.4rem]" alt="Verification photo" />
                                            ) : (
                                                <>
                                                    <Camera className="h-6 w-6 text-slate-300" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Capture Handover</span>
                                                </>
                                            )}
                                        </div>

                                        {/* OTP Section */}
                                        {!showOtpInput ? (
                                            <Button 
                                                variant="outline" 
                                                onClick={() => sendOtp(order.id)}
                                                className="h-14 rounded-2xl border-slate-200 text-slate-600 font-bold gap-2"
                                            >
                                                <Smartphone className="h-4 w-4" /> Send Customer OTP
                                            </Button>
                                        ) : (
                                            <div className="space-y-3">
                                                <input 
                                                    type="text"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    placeholder="Enter 6-digit code"
                                                    className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 text-center font-black tracking-[0.3em] text-lg focus:ring-2 focus:ring-emerald-500/20"
                                                />
                                                <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Customer Approval</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Status Controls */}
                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                                    {DRIVER_STATUSES.map(s => (
                                        <Button
                                            key={s}
                                            disabled={updatingId === order.id || order.status === s}
                                            onClick={() => updateStatus(order.id, s)}
                                            variant={order.status === s ? "default" : "outline"}
                                            className={cn(
                                                "h-12 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all",
                                                order.status === s ? "bg-slate-900 border-slate-900" : "border-slate-100",
                                                s === "DELIVERED" && "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                                            )}
                                        >
                                            {s.replace(/_/g, " ")}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
