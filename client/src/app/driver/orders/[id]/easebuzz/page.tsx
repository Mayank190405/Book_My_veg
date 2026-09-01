"use client";

import { useState, useEffect, use, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    ArrowLeft, 
    Check, 
    ShieldCheck, 
    Loader2, 
    QrCode, 
    ExternalLink, 
    Sparkles, 
    RefreshCw,
    CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from "qrcode.react";

function EasebuzzFlowContent({ id }: { id: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialAmount = searchParams.get("amount") || "";
    const isPartial = searchParams.get("partial") === "true";

    const [order, setOrder] = useState<any | null>(null);
    const [amount, setAmount] = useState(initialAmount);
    const [loading, setLoading] = useState(true);
    const [isInitiating, setIsInitiating] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [successData, setSuccessData] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<"QR" | "GATEWAY">("QR");

    const fetchOrder = useCallback(async () => {
        try {
            const res = await api.get(`/orders/${id}`);
            const ord = res.data;
            setOrder(ord);
            
            if (ord.isPaid || ord.paymentStatus === "PAID" || ord.paymentStatus === "COMPLETED") {
                setIsSuccess(true);
                setSuccessData({
                    amount: Number(ord.totalAmount),
                    transactionId: ord.payments?.[0]?.transactionId || `EB_${Date.now()}`,
                    paidAt: new Date().toLocaleTimeString()
                });
            } else if (!initialAmount) {
                const due = Math.max(0, Number(ord.totalAmount || 0) - Number(ord.cashCollected || 0) - Number(ord.easebuzzCollected || 0));
                setAmount(due.toString());
            }
        } catch (error: any) {
            toast.error("Failed to load order");
        } finally {
            setLoading(false);
        }
    }, [id, initialAmount]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    // Live background polling for payment completion
    useEffect(() => {
        if (isSuccess) return;
        const interval = setInterval(async () => {
            try {
                const res = await api.get(`/orders/${id}`);
                const ord = res.data;
                const paid = Number(ord.cashCollected || 0) + Number(ord.easebuzzCollected || 0);
                if (ord.isPaid || ord.paymentStatus === "PAID" || ord.paymentStatus === "COMPLETED" || paid >= Number(amount)) {
                    setIsSuccess(true);
                    setSuccessData({
                        amount: Number(amount),
                        transactionId: ord.payments?.[0]?.transactionId || `EB_${Date.now()}`,
                        paidAt: new Date().toLocaleTimeString()
                    });
                    toast.success("Payment verified in real-time!");
                }
            } catch (_) {}
        }, 3500);

        return () => clearInterval(interval);
    }, [id, amount, isSuccess]);

    const numAmount = Math.max(1, Number(amount || order?.totalAmount || 100));
    const upiQrString = `upi://pay?pa=bookmyveg@icici&pn=BookMyVeg&am=${numAmount.toFixed(2)}&tr=${order?.id || id}&tn=${encodeURIComponent(`Order ${order?.id?.slice(-6) || id}`)}&cu=INR`;

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
            const accessKey = data.accessKey || data.access_key || data.data?.access_key;

            if (accessKey) {
                const launchCheckout = () => {
                    try {
                        const easebuzzCheckout = new (window as any).EasebuzzCheckout(
                            data.key || process.env.NEXT_PUBLIC_EASEBUZZ_KEY || "B9W97P5YBT", 
                            data.env || process.env.NEXT_PUBLIC_EASEBUZZ_ENV || "test"
                        );

                        easebuzzCheckout.initiatePayment({
                            access_key: accessKey,
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
                                    toast.error("Payment cancelled or not completed");
                                }
                            }
                        });
                    } catch (e: any) {
                        toast.error("Checkout modal error: " + e.message);
                    }
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
                // Direct navigation avoids mobile popup blockers
                window.location.href = data.paymentLink;
            } else {
                toast.error("No gateway payment session received.");
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
    // SCREEN: PAYMENT SUCCESS
    // ═══════════════════════════════════════════════════════════════════
    if (isSuccess && successData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 animate-in zoom-in-95 duration-300 my-auto text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-100">
                    <Check className="h-10 w-10 stroke-[3]" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">Payment Received!</h3>
                    <p className="text-xs font-semibold text-slate-400">Order #{id.slice(-6).toUpperCase()}</p>
                </div>

                {/* Statement Table */}
                <div className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3 text-xs shadow-sm text-left">
                    <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Amount Paid</span>
                        <span className="font-black text-slate-900 text-sm">₹ {successData.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Payment Mode</span>
                        <span className="font-bold text-blue-600">UPI / Easebuzz</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Transaction ID</span>
                        <span className="font-mono font-bold text-slate-700">{successData.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Status</span>
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                        </span>
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
    // SCREEN: PAYMENT SELECTION (UPI QR + ONLINE GATEWAY)
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h3 className="text-base font-black text-slate-900">
                        Collect Online Payment
                    </h3>
                </div>
                <span className="text-xs font-black text-blue-600">
                    ₹ {Number(amount).toLocaleString()}
                </span>
            </div>

            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                {isPartial && (
                    <div className="space-y-1.5 bg-purple-50/70 border border-purple-100 p-4 rounded-2xl">
                        <Label className="text-xs font-bold text-purple-900">Custom Collection Amount</Label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-lg text-slate-500">₹</span>
                            <Input 
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="h-12 pl-8 rounded-xl bg-white border border-purple-200 text-xl font-black text-slate-900"
                            />
                        </div>
                    </div>
                )}

                {/* Tab Switcher: Dynamic UPI QR vs Easebuzz Gateway */}
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button
                        onClick={() => setActiveTab("QR")}
                        className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === "QR" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <QrCode className="h-4 w-4" />
                        Doorstep UPI QR
                    </button>
                    <button
                        onClick={() => setActiveTab("GATEWAY")}
                        className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === "GATEWAY" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Easebuzz Gateway
                    </button>
                </div>

                {activeTab === "QR" ? (
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md shadow-slate-100 flex flex-col items-center text-center space-y-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-900">Scan to Pay with Any UPI App</h4>
                            <p className="text-[11px] font-semibold text-slate-400">
                                Google Pay • PhonePe • Paytm • BHIM • Banking UPI
                            </p>
                        </div>

                        {/* High-Resolution QR Code */}
                        <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-inner flex items-center justify-center">
                            <QRCodeSVG 
                                value={upiQrString}
                                size={190}
                                level="H"
                                includeMargin={true}
                            />
                        </div>

                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3.5 py-1.5 rounded-full text-xs font-black">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Listening for live payment confirmation...
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md shadow-slate-100 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <span className="text-base font-black text-blue-900 tracking-tight">Easebuzz Gateway</span>
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 256-Bit Encrypted
                            </span>
                        </div>

                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Launch the official Easebuzz card, netbanking, and UPI gateway directly on this device.
                        </p>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">Amount Payable</span>
                            <span className="text-xl font-black text-slate-900">₹ {Number(amount).toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Action CTA */}
            <div className="p-4 border-t border-slate-100 space-y-2 bg-white sticky bottom-0 z-10">
                <Button 
                    onClick={handlePayNow}
                    disabled={isInitiating}
                    className="w-full h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    {isInitiating ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Opening Gateway...
                        </>
                    ) : (
                        <>
                            <ExternalLink className="h-4 w-4" />
                            Pay Now (₹ {Number(amount).toLocaleString()})
                        </>
                    )}
                </Button>
                
                <Button 
                    variant="ghost"
                    onClick={() => router.back()}
                    className="w-full h-11 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                    Cancel / Back
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
