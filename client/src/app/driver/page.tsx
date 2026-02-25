"use client";

import { useState } from "react";
import {
    MapPin, Phone, ShoppingBag, CheckCircle2,
    Camera, ShieldCheck, CreditCard, ArrowRight,
    Search, User as UserIcon, Loader2, Navigation
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function DriverPage() {
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [otp, setOtp] = useState("");
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);

    // ── Queries ───────────────────────────────────────────────────────
    const queryClient = useQueryClient();
    const { data: assignments, isLoading } = useQuery({
        queryKey: ["driver-assignments"],
        queryFn: async () => {
            const res = await api.get("/driver/assignments");
            return res.data;
        }
    });

    const verifyMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post("/delivery/otp/verify", {
                orderId: selectedOrder.orderId || selectedOrder.order?.id,
                otp,
                driverId: "DRIVER_SESSION" // DUMMY session for UI simulation
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Delivery verification successful!");
            queryClient.invalidateQueries({ queryKey: ["driver-assignments"] });
            setSelectedOrder(null);
            setOtp("");
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || "Invalid OTP");
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-green-500" />
            </div>
        );
    }

    if (selectedOrder) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Header Context */}
                <div className="bg-white px-6 py-6 border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                    <button
                        onClick={() => setSelectedOrder(null)}
                        className="mb-4 text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"
                    >
                        <ArrowRight className="h-3 w-3 rotate-180" />
                        Back to Route
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 leading-none mb-1">Order #{selectedOrder.id.slice(0, 8)}</h2>
                            <p className="text-sm text-gray-500 font-bold">{selectedOrder.order.shippingAddress?.street}, {selectedOrder.order.shippingAddress?.city}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-100">
                            <Navigation className="h-6 w-6 text-white" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-6 space-y-6 overflow-y-auto pb-32">
                    {/* Customer Info */}
                    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center font-black text-gray-400">
                                {selectedOrder.order.user?.name?.charAt(0) || "U"}
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-gray-900 text-lg leading-tight">{selectedOrder.order.user?.name || "Customer"}</p>
                                <p className="text-xs text-gray-400 font-bold">{selectedOrder.order.user?.phone}</p>
                            </div>
                            <button className="p-3 bg-blue-50 text-blue-600 rounded-2xl active:scale-90 transition-transform">
                                <Phone className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Order Items */}
                    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                        <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-gray-400" />
                            Bag Contents ({selectedOrder.order.items.length})
                        </h3>
                        <div className="space-y-3">
                            {selectedOrder.order.items.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-gray-700">{item.product.name}</span>
                                    <span className="text-xs font-black text-gray-400">x{item.quantity}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Amount</span>
                            <span className="text-xl font-black text-green-600">₹{selectedOrder.order.totalAmount}</span>
                        </div>
                    </div>

                    {/* Verification Form */}
                    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Delivery OTP</label>
                            <input
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter 4-digit OTP"
                                className="w-full text-center text-3xl font-black tracking-[0.5em] py-5 rounded-3xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 placeholder:tracking-normal placeholder:text-sm placeholder:font-bold"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 rounded-3xl border border-gray-100 active:scale-95 transition-all text-gray-500">
                                <Camera className="h-6 w-6" />
                                <span className="text-[10px] font-black uppercase">Take Photo</span>
                            </button>
                            <button
                                onClick={() => setIsPaymentOpen(true)}
                                className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-50  rounded-3xl border border-blue-100 active:scale-95 transition-all text-blue-600"
                            >
                                <CreditCard className="h-6 w-6" />
                                <span className="text-[10px] font-black uppercase">Online Pay</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
                    <button
                        onClick={() => verifyMutation.mutate()}
                        disabled={otp.length !== 4 || verifyMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 transition-all shadow-xl shadow-green-100 disabled:opacity-50 disabled:grayscale active:scale-95"
                    >
                        {verifyMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <><CheckCircle2 className="h-6 w-6" /> Complete Delivery</>}
                    </button>
                </div>

                {/* HDFC Gateway Simulation */}
                {isPaymentOpen && (
                    <div className="fixed inset-0 bg-white z-[100] animate-in slide-in-from-bottom duration-500 p-8 flex flex-col">
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
                            <div className="w-20 h-20 bg-blue-900 rounded-3xl flex items-center justify-center text-white font-black text-2xl mb-4">
                                HDFC
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 leading-tight">Secure Payment Gateway</h3>
                            <p className="text-gray-500 font-medium">Requesting ₹{selectedOrder.order.totalAmount} from Customer</p>

                            <div className="w-64 h-64 bg-gray-100 rounded-[2.5rem] flex items-center justify-center border-4 border-gray-50 shadow-inner">
                                <ShieldCheck className="h-20 w-20 text-blue-600 opacity-20" />
                            </div>

                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Awaiting customer confirmation...</p>
                        </div>
                        <button
                            onClick={() => {
                                setIsPaymentOpen(false);
                                toast.success("Payment Received Successfully");
                            }}
                            className="bg-blue-600 text-white py-5 rounded-[2rem] font-black hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-100"
                        >
                            Simulate Success
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white px-8 py-10 rounded-b-[3rem] shadow-sm">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">My Deliveries</h1>
                <p className="text-gray-500 font-bold flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    Today's Task • {assignments?.length || 0} Packets
                </p>
            </header>

            <main className="flex-1 p-6 space-y-6">
                {assignments?.map((assignment: any) => (
                    <div
                        key={assignment.id}
                        onClick={() => setSelectedOrder(assignment)}
                        className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-6 active:scale-95 transition-all cursor-pointer group"
                    >
                        <div className="w-16 h-16 bg-gray-50 rounded-[1.5rem] flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                            <MapPin className="h-8 w-8 text-gray-200 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-900 text-lg leading-tight truncate">{assignment.order.shippingAddress?.street}</p>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest truncate">{assignment.order.user?.name || "Customer"}</p>
                        </div>
                        <button className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </div>
                ))}

                {assignments?.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-300 opacity-50 gap-4">
                        <ShoppingBag className="h-16 w-16" />
                        <p className="font-bold">No packets assigned for delivery</p>
                    </div>
                )}
            </main>
        </div>
    );
}
