"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Check, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function EasebuzzFlowContent({ id }: { id: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialAmount = searchParams.get("amount") || "";
    const isPartial = searchParams.get("partial") === "true";

    const [order, setOrder] = useState<any | null>(null);
    const [amount, setAmount] = useState(initialAmount);
    const [loading, setLoading] = useState(true);
    const [isInitiating, setIsInitiating] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false); // Screen 10B
    const [successData, setSuccessData] = useState<any | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await api.get(`/orders/${id}`);
                setOrder(res.data);
                if (!initialAmount) {
                    const due = Math.max(0, Number(res.data.totalAmount || 0) - Number(res.data.cashCollected || 0) - Number(res.data.easebuzzCollected || 0));
                    setAmount(due.toString());
                }
            } catch (error: any) {
                toast.error("Failed to load order");
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [id, initialAmount]);

    const handlePayNow = async () => {
        if (!amount || Number(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsInitiating(true);
        try {
            const response = await api.post(`/payments/${id}/generate-link`, {
                amount: Number(amount)
            });

            const data = response.data;
            if (data.access_key) {
                const launchCheckout = () => {
                    const easebuzzCheckout = new (window as any).EasebuzzCheckout(
                        process.env.NEXT_PUBLIC_EASEBUZZ_KEY || "B9W97P5YBT", 
                        process.env.NEXT_PUBLIC_EASEBUZZ_ENV || "test"
                    );

                    easebuzzCheckout.initiatePayment({
                        access_key: data.access_key,
                        onResponse: (resp: any) => {
                            if (resp.status === "success") {
                                toast.success("Easebuzz Payment Successful!");
                                setSuccessData({
                                    amount: Number(amount),
                                    transactionId: resp.easepayid || `EB${Date.now()}`,
                                    paidAt: new Date().toLocaleString()
                                });
                                setIsSuccess(true);
                            } else {
                                toast.error("Payment was not completed");
                            }
                        }
                    });
                };

                if (!(window as any).EasebuzzCheckout) {
                    const script = document.createElement("script");
                    script.src = "https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js";
                    script.onload = launchCheckout;
                    document.body.appendChild(script);
                } else {
                    launchCheckout();
                }
            } else if (data.paymentLink) {
                window.open(data.paymentLink, "_blank");
                toast.info("Payment link opened in gateway");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to launch Easebuzz gateway");
        } finally {
            setIsInitiating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SCREEN 10B: PAYMENT SUCCESS (EASEBUZZ)
    // ═══════════════════════════════════════════════════════════════════
    if (isSuccess && successData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 animate-in zoom-in-95 duration-300 my-auto text-center">
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
                    <Check className="h-12 w-12 stroke-[3]" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900">Payment Successful!</h3>
                </div>

                {/* Statement Table (Screen 10B) */}
                <div className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3 text-xs shadow-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Amount Paid</span>
                        <span className="font-black text-slate-900 text-sm">₹ {successData.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Payment Mode</span>
                        <span className="font-bold text-blue-600">Easebuzz</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Transaction ID</span>
                        <span className="font-mono font-bold text-slate-700">{successData.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Paid At</span>
                        <span className="font-bold text-slate-700">{successData.paidAt}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Status</span>
                        <span className="font-bold text-emerald-600">Success</span>
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
    // SCREEN 10A: EASEBUZZ PAYMENT
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar (Screen 10A) */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 sticky top-0 bg-white z-10">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h3 className="text-base font-black text-slate-900">
                    Payment (Easebuzz)
                </h3>
            </div>

            <div className="p-6 space-y-6 flex-1">
                {isPartial ? (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">Enter Partial Amount</Label>
                        <Input 
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-14 rounded-2xl bg-slate-50 border border-slate-200 text-2xl font-black text-slate-900 pl-4"
                        />
                    </div>
                ) : (
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-400">Total Amount</p>
                        <p className="text-3xl font-black text-slate-900">₹ {Number(amount).toLocaleString()}</p>
                    </div>
                )}

                <p className="text-xs text-slate-500 font-medium">
                    Complete the payment on the secure payment page.
                </p>

                {/* Easebuzz Card (Screen 10A) */}
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-base font-black text-blue-900 tracking-tight">Easebuzz</span>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Secured by Easebuzz
                        </span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] font-bold text-slate-400">Amount Payable</p>
                        <p className="text-2xl font-black text-slate-900">₹ {Number(amount).toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 space-y-2">
                <Button 
                    onClick={handlePayNow}
                    disabled={isInitiating}
                    className="w-full h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-200"
                >
                    {isInitiating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Pay Now"}
                </Button>
                <Button 
                    variant="ghost"
                    onClick={() => router.back()}
                    className="w-full h-12 text-xs font-bold text-slate-400"
                >
                    Cancel Payment
                </Button>
            </div>
        </div>
    );
}

export default function EasebuzzPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>}>
            <EasebuzzFlowContent id={id} />
        </Suspense>
    );
}
