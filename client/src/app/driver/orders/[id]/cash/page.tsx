"use client";

import { useState, useEffect, use, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Banknote, ShieldCheck, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function CashFlowContent({ id }: { id: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialAmount = searchParams.get("amount") || "";

    const [order, setOrder] = useState<any | null>(null);
    const [amount, setAmount] = useState(initialAmount);
    const [otp, setOtp] = useState("");
    const [timer, setTimer] = useState(25);
    const [loading, setLoading] = useState(true);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isDirectCollecting, setIsDirectCollecting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [successData, setSuccessData] = useState<any | null>(null);
    const [maskedPhone, setMaskedPhone] = useState<string>("");

    const fetchOrderAndSendOtp = useCallback(async () => {
        try {
            const res = await api.get(`/orders/${id}`);
            const ord = res.data;
            setOrder(ord);
            
            const due = Math.max(0, Number(ord.totalAmount || 0) - Number(ord.cashCollected || 0) - Number(ord.easebuzzCollected || 0));
            const targetAmt = initialAmount ? Number(initialAmount) : due;
            setAmount(targetAmt.toString());

            // Trigger OTP to customer phone
            try {
                const otpRes = await api.post(`/orders/driver/${id}/send-cash-otp`, {
                    amount: targetAmt
                });
                if (otpRes.data?.phone) {
                    setMaskedPhone(otpRes.data.phone);
                }
            } catch (e) {
                // If OTP fails, fallback to phone on order
                const ph = ord.user?.phone || "";
                if (ph) setMaskedPhone(ph.slice(-4).padStart(ph.length, "*"));
            }
        } catch (error: any) {
            toast.error("Failed to load order details");
        } finally {
            setLoading(false);
        }
    }, [id, initialAmount]);

    useEffect(() => {
        fetchOrderAndSendOtp();
    }, [fetchOrderAndSendOtp]);

    // Timer countdown
    useEffect(() => {
        let interval: any = null;
        if (!isSuccess && timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer, isSuccess]);

    const handleResendOtp = async () => {
        if (timer > 0 || isSendingOtp) return;
        setIsSendingOtp(true);
        try {
            const res = await api.post(`/orders/driver/${id}/send-cash-otp`, { amount: Number(amount) });
            setTimer(25);
            if (res.data?.phone) setMaskedPhone(res.data.phone);
            toast.success("New OTP sent via WhatsApp");
        } catch (error: any) {
            toast.error("Failed to resend OTP");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 4) {
            toast.error("Please enter the 6-digit verification code");
            return;
        }

        setIsVerifying(true);
        try {
            await api.post(`/orders/driver/${id}/verify-cash-otp`, {
                otp,
                amount: Number(amount)
            });

            toast.success("Cash Collection Verified!");
            setSuccessData({
                amount: Number(amount),
                collectedAt: new Date().toLocaleTimeString(),
                mode: "Cash (OTP Verified)"
            });
            setIsSuccess(true);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid OTP code. Please verify with customer.");
        } finally {
            setIsVerifying(false);
        }
    };

    // Direct Cash Handover without OTP (Driver Override)
    const handleDirectCashCollection = async () => {
        if (isDirectCollecting) return;
        setIsDirectCollecting(true);
        try {
            const res = await api.post(`/orders/driver/${id}/collect-cash`, {
                amount: Number(amount)
            });

            toast.success(res.data?.message || "Cash Handover Recorded!");
            setSuccessData({
                amount: Number(amount),
                collectedAt: new Date().toLocaleTimeString(),
                mode: "Cash Handover"
            });
            setIsSuccess(true);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to record cash payment");
        } finally {
            setIsDirectCollecting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SCREEN 9B: CASH COLLECTED SUCCESS
    // ═══════════════════════════════════════════════════════════════════
    if (isSuccess && successData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 animate-in zoom-in-95 duration-300 my-auto text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-100">
                    <Check className="h-10 w-10 stroke-[3]" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">Cash Collected!</h3>
                    <p className="text-xs font-semibold text-slate-400">Order #{id.slice(-6).toUpperCase()}</p>
                </div>

                {/* Statement Table */}
                <div className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3 text-xs shadow-sm text-left">
                    <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Amount Collected</span>
                        <span className="font-black text-slate-900 text-sm">₹ {successData.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Collected At</span>
                        <span className="font-bold text-slate-700">{successData.collectedAt}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Payment Mode</span>
                        <span className="font-bold text-emerald-600">{successData.mode}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Status</span>
                        <span className="font-bold text-emerald-600">Added to Cash Ledger</span>
                    </div>
                </div>

                <div className="w-full space-y-2.5 pt-2">
                    <Button 
                        onClick={() => router.push(`/driver/orders/${id}/deliver`)}
                        className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                    >
                        Proceed to Deliver Order
                    </Button>
                    <button 
                        onClick={() => router.push(`/driver/orders/${id}`)}
                        className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                        Back to Order Details
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SCREEN 9A: CASH COLLECTION (OTP + DIRECT OVERRIDE)
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h3 className="text-base font-black text-slate-900">Doorstep Cash Collection</h3>
                </div>
                <span className="text-xs font-black text-emerald-600">
                    ₹ {Number(amount).toLocaleString()}
                </span>
            </div>

            <div className="p-5 space-y-6 flex-1 overflow-y-auto">
                {/* Cash Amount Card */}
                <div className="space-y-1.5 bg-emerald-50/80 border border-emerald-100 p-5 rounded-3xl">
                    <Label className="text-xs font-bold text-emerald-900">Cash Amount to Collect</Label>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-xl text-emerald-700">₹</span>
                        <Input 
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-13 pl-8 rounded-2xl bg-white border border-emerald-200 text-2xl font-black text-slate-900"
                        />
                    </div>
                </div>

                {/* OTP Verification Box */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4 text-center">
                    <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-900">Customer OTP Verification</h4>
                        <p className="text-xs text-slate-500 font-medium">
                            WhatsApp OTP sent to {maskedPhone || order?.user?.phone || "Customer"}
                        </p>
                    </div>

                    <Input 
                        type="text"
                        placeholder="• • • • • •"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-15 rounded-2xl bg-slate-50 border border-slate-200 text-center text-3xl font-black tracking-[0.4em]"
                        autoFocus
                    />

                    <div className="flex items-center justify-between text-xs pt-1 px-1">
                        <button 
                            type="button"
                            disabled={timer > 0 || isSendingOtp}
                            onClick={handleResendOtp}
                            className={cn(
                                "font-bold",
                                timer > 0 ? "text-slate-400 cursor-not-allowed" : "text-blue-600 hover:underline"
                            )}
                        >
                            {timer > 0 
                                ? `Resend OTP in 00:${String(timer).padStart(2, "0")}` 
                                : "Resend OTP Now"}
                        </button>

                        <button
                            type="button"
                            onClick={handleDirectCashCollection}
                            disabled={isDirectCollecting}
                            className="text-slate-400 hover:text-emerald-700 underline font-semibold text-[11px]"
                        >
                            Skip OTP (Direct Handover)
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-100 space-y-2 bg-white sticky bottom-0 z-10">
                <Button 
                    onClick={handleVerifyOtp}
                    disabled={isVerifying || otp.length < 4}
                    className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
                >
                    {isVerifying ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Verifying OTP...
                        </>
                    ) : (
                        "Verify & Confirm Cash"
                    )}
                </Button>

                <Button 
                    variant="outline"
                    onClick={handleDirectCashCollection}
                    disabled={isDirectCollecting}
                    className="w-full h-12 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 text-slate-700 hover:text-emerald-700 font-bold text-xs active:scale-95 transition-all"
                >
                    {isDirectCollecting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Banknote className="h-4 w-4 mr-1.5 text-emerald-600" />
                    )}
                    Direct Cash Received (No OTP)
                </Button>
            </div>
        </div>
    );
}

export default function CashPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" /></div>}>
            <CashFlowContent id={id} />
        </Suspense>
    );
}
