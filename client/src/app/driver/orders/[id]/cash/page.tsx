"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
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
    const [isSuccess, setIsSuccess] = useState(false); // Screen 9B
    const [successData, setSuccessData] = useState<any | null>(null);

    useEffect(() => {
        const fetchOrderAndSendOtp = async () => {
            try {
                const res = await api.get(`/orders/${id}`);
                setOrder(res.data);
                if (!initialAmount) {
                    const due = Math.max(0, Number(res.data.totalAmount || 0) - Number(res.data.cashCollected || 0) - Number(res.data.easebuzzCollected || 0));
                    setAmount(due.toString());
                }

                // Trigger OTP
                await api.post(`/orders/driver/${id}/send-cash-otp`, {
                    amount: Number(initialAmount || res.data.totalAmount)
                }).catch(() => null);
            } catch (error: any) {
                toast.error("Failed to initiate cash collection");
            } finally {
                setLoading(false);
            }
        };
        fetchOrderAndSendOtp();
    }, [id, initialAmount]);

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
            await api.post(`/orders/driver/${id}/send-cash-otp`, { amount: Number(amount) });
            setTimer(25);
            toast.success("New OTP sent via WhatsApp");
        } catch (error: any) {
            toast.error("Failed to resend OTP");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 4) {
            toast.error("Please enter the verification code");
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
                collectedAt: new Date().toLocaleString()
            });
            setIsSuccess(true);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid OTP verification code");
        } finally {
            setIsVerifying(false);
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
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
                    <Check className="h-12 w-12 stroke-[3]" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900">Cash Collected Successfully!</h3>
                </div>

                {/* Statement Table (Screen 9B) */}
                <div className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3 text-xs shadow-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Amount Collected</span>
                        <span className="font-black text-slate-900 text-sm">₹ {successData.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Collected At</span>
                        <span className="font-bold text-slate-700">{successData.collectedAt}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Payment Mode</span>
                        <span className="font-bold text-emerald-600">Cash</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Status</span>
                        <span className="font-bold text-emerald-600">Verified</span>
                    </div>
                </div>

                <div className="w-full space-y-2 pt-4">
                    <Button 
                        onClick={() => router.push(`/driver/orders/${id}/deliver`)}
                        className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-200"
                    >
                        Mark as Delivered
                    </Button>
                    <button 
                        onClick={() => router.push(`/driver/orders/${id}`)}
                        className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                        Back to Order
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SCREEN 9A: CASH COLLECTION (OTP)
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar (Screen 9A) */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 sticky top-0 bg-white z-10">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h3 className="text-base font-black text-slate-900">Cash Collection</h3>
            </div>

            <div className="p-6 space-y-6 flex-1">
                {/* Enter Amount Card (Screen 9A) */}
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">Enter Amount</Label>
                    <div className="relative">
                        <Input 
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-14 rounded-2xl bg-slate-50 border border-slate-200 text-2xl font-black text-slate-900 pl-4"
                        />
                    </div>
                </div>

                {/* OTP Section (Screen 9A) */}
                <div className="space-y-4 pt-2">
                    <div className="text-center space-y-1">
                        <p className="text-xs font-bold text-slate-700">
                            OTP has been sent to {order?.user?.phone || "Customer"}
                        </p>
                    </div>

                    <Input 
                        type="text"
                        placeholder="• • • • • •"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-16 rounded-2xl bg-slate-50 border border-slate-200 text-center text-3xl font-black tracking-[0.4em]"
                        autoFocus
                    />

                    <div className="text-center">
                        <button 
                            type="button"
                            disabled={timer > 0 || isSendingOtp}
                            onClick={handleResendOtp}
                            className={cn(
                                "text-xs font-bold",
                                timer > 0 ? "text-slate-400 cursor-not-allowed" : "text-blue-600 hover:underline"
                            )}
                        >
                            {timer > 0 
                                ? `Resend OTP in 00:${String(timer).padStart(2, "0")}` 
                                : "Resend OTP Now"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 space-y-2">
                <Button 
                    onClick={handleVerifyOtp}
                    disabled={isVerifying || otp.length < 4}
                    className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-200"
                >
                    {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify OTP"}
                </Button>
                <Button 
                    variant="ghost"
                    onClick={() => router.back()}
                    className="w-full h-12 text-xs font-bold text-slate-400"
                >
                    Cancel
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
