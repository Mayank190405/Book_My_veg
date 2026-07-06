"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, Loader2, CheckCircle, XCircle, CreditCard, ArrowRight, IndianRupee } from "lucide-react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";

function MockGatewayContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [orderId, setOrderId] = useState<string | null>(null);
    const [amount, setAmount] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setOrderId(searchParams.get("orderId"));
        setAmount(searchParams.get("amount"));
    }, [searchParams]);

    const handlePaymentAction = async (simulateSuccess: boolean) => {
        if (!orderId) return;
        setLoading(true);

        const status = simulateSuccess ? "CHARGED" : "FAILED";
        try {
            // Trigger backend payment verification directly so database order status changes to PAID / FAILED
            await api.post("/payments/verify", {
                order_id: orderId,
                status: status
            });
            
            // Redirect to success page with status
            router.push(`/payment/success?order_id=${orderId}&status=${status}`);
        } catch (err) {
            console.error("Verification callback failed:", err);
            // Fallback redirect anyway
            router.push(`/payment/success?order_id=${orderId}&status=${status}`);
        } finally {
            setLoading(false);
        }
    };

    if (!orderId) {
        return (
            <div className="min-h-screen bg-[#061512] flex items-center justify-center text-white p-8">
                <div className="text-center space-y-4">
                    <XCircle className="h-16 w-16 text-red-500 mx-auto animate-bounce" />
                    <h1 className="text-xl font-black uppercase tracking-widest">Invalid Session</h1>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">No Order ID provided for checkout.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dark">
            <div className="min-h-screen bg-[#061512] pb-40 transition-colors text-white flex flex-col justify-center items-center px-6">
                <div className="max-w-md w-full bg-white/5 backdrop-blur-3xl rounded-[3.5rem] border border-white/10 p-10 shadow-2xl relative overflow-hidden space-y-8">
                    
                    {/* Top Accent line */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-primary to-emerald-500" />

                    {/* Gateway Header */}
                    <div className="text-center space-y-3">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-center text-primary mx-auto mb-2">
                            <CreditCard className="h-8 w-8" />
                        </div>
                        <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] block">SECURE SANDBOX GATEWAY</span>
                        <h1 className="text-2xl font-black uppercase tracking-tight italic text-white leading-none mt-1">Book My Veg Payment</h1>
                    </div>

                    <hr className="border-white/5" />

                    {/* Transaction Details */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 font-bold uppercase tracking-wider text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-white/40 text-[10px]">Merchant Name</span>
                            <span className="text-white">Book My Veg</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-white/5 pt-3">
                            <span className="text-white/40 text-[10px]">Order Reference</span>
                            <span className="text-white font-mono">{orderId}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-white/5 pt-3">
                            <span className="text-white/40 text-[10px]">Currency</span>
                            <span className="text-white">INR (Indian Rupee)</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-white/5 pt-3">
                            <span className="text-white/40 text-[10px]">Amount Payable</span>
                            <span className="text-lg font-black text-primary flex items-center gap-0.5">
                                <IndianRupee className="h-4.5 w-4.5" />
                                {Number(amount).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Shield Status indicator */}
                    <div className="flex items-center justify-center gap-2.5 py-3 px-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-[10px] font-black text-primary uppercase tracking-widest">
                        <ShieldCheck className="h-4.5 w-4.5" />
                        <span>TEST GATEWAY ACTIVATED</span>
                    </div>

                    {/* Simulation Actions */}
                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-6 gap-3">
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Authorizing Transaction...</span>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => handlePaymentAction(true)}
                                    className="w-full group bg-emerald-600 hover:bg-emerald-500 text-white h-18 rounded-[1.75rem] flex items-center justify-between px-8 shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="h-5 w-5 text-white" />
                                        <span className="text-xs font-black uppercase tracking-widest italic">Simulate Success</span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                        <ArrowRight className="h-4 w-4" strokeWidth={3} />
                                    </div>
                                </button>

                                <button
                                    onClick={() => handlePaymentAction(false)}
                                    className="w-full group bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-500 h-18 rounded-[1.75rem] flex items-center justify-between px-8 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <XCircle className="h-5 w-5 text-red-500" />
                                        <span className="text-xs font-black uppercase tracking-widest italic">Simulate Failure</span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                        <ArrowRight className="h-4 w-4" strokeWidth={3} />
                                    </div>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MockGatewayPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-[#061512]">
                <Loader2 className="h-16 w-16 text-primary animate-spin opacity-20" />
            </div>
        }>
            <MockGatewayContent />
        </Suspense>
    );
}
