"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Clock, Loader2, ShoppingBag, XCircle, ArrowRight, ShieldCheck, Zap, Package, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { useCartStore } from "@/store/useCartStore";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

type PageState = "verifying" | "success" | "failed" | "pending";

const SUCCESS_STATUSES = new Set(["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED", "CAPTURE_INITIATED"]);

function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const clearCart = useCartStore((s) => s.clearCart);

    const [pageState, setPageState] = useState<PageState>("verifying");
    const [idForVerification, setIdForVerification] = useState<string | null>(null);
    const [orderDetails, setOrderDetails] = useState<any>(null);

    // 1. Resolve the Order ID
    useEffect(() => {
        const queryId = searchParams.get("order_id") || searchParams.get("orderId");
        const backupId = typeof window !== "undefined" ? localStorage.getItem("last_order_id") : null;
        const finalId = queryId || backupId;
        if (finalId) setIdForVerification(finalId);
    }, [searchParams]);

    // 2. Confetti Effect
    useEffect(() => {
        if (pageState === "success") {
            const duration = 3 * 1000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 60,
                    origin: { x: 0, y: 0.8 },
                    colors: ["#10b981", "#ffffff", "#059669"]
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 60,
                    origin: { x: 1, y: 0.8 },
                    colors: ["#10b981", "#ffffff", "#059669"]
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }
    }, [pageState]);

    // 3. Status Polling
    useEffect(() => {
        if (!idForVerification || pageState !== "verifying") return;

        let pollInterval: NodeJS.Timeout;
        const rawStatus = (searchParams.get("status") ?? "").toUpperCase().trim();

        const checkStatus = async (targetId: string) => {
            try {
                const res = await api.get(`/payments/order-status/${targetId}`);
                const dbPaymentStatus = (res.data.paymentStatus ?? "").toUpperCase();
                const dbStatus = (res.data.status ?? "").toUpperCase();

                if (dbPaymentStatus === "PAID" || dbPaymentStatus === "COMPLETED" || dbStatus === "CONFIRMED") {
                    setOrderDetails(res.data);
                    clearCart();
                    localStorage.removeItem("last_order_id");
                    setPageState("success");
                    return true;
                }

                if (dbPaymentStatus === "FAILED" || dbStatus === "FAILED") {
                    setPageState("failed");
                    return true;
                }
            } catch (err) {
                console.error("[PaymentSuccess] API error:", err);
            }
            return false;
        };

        const startVerification = async () => {
            await new Promise(resolve => setTimeout(resolve, 3000));

            api.post("/payments/verify", {
                order_id: idForVerification,
                status: SUCCESS_STATUSES.has(rawStatus) ? rawStatus : undefined,
                ...Object.fromEntries(searchParams.entries())
            }).catch(e => console.error("[PaymentSuccess] Verify error:", e));

            const done = await checkStatus(idForVerification);
            if (done) return;

            pollInterval = setInterval(async () => {
                await checkStatus(idForVerification);
            }, 3000);
        };

        startVerification();

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [idForVerification, searchParams, clearCart, pageState]);

    const PageWrapper = ({ children }: { children: React.ReactNode }) => (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-center animate-in fade-in duration-1000">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
            </div>
            {children}
        </div>
    );

    if (pageState === "verifying") {
        return (
            <PageWrapper>
                <div className="flex flex-col items-center relative z-10">
                    <div className="relative mb-16">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl scale-[2.5] animate-pulse" />
                        <div className="w-40 h-40 rounded-[3rem] bg-card border border-border flex items-center justify-center relative shadow-2xl overflow-hidden">
                             <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent" />
                             <Loader2 className="h-20 w-20 text-primary animate-spin" strokeWidth={2.5} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-foreground mb-4 tracking-[0.2em] uppercase italic leading-none">Securing Confirmation</h1>
                    <div className="flex items-center gap-3 py-2 px-6 bg-primary/5 border border-primary/20 rounded-2xl mb-6">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Encrypted Bank Verification</span>
                    </div>
                    <p className="text-foreground/20 text-sm max-w-sm leading-relaxed font-bold uppercase tracking-widest italic">
                        Processing your transaction through our premium secure tunnel. Please hold tight.
                    </p>
                </div>
            </PageWrapper>
        );
    }

    if (pageState === "success") {
        return (
            <PageWrapper>
                <div className="bg-card backdrop-blur-3xl rounded-[3.5rem] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.05)] p-12 flex flex-col items-center max-w-md w-full border border-border animate-in zoom-in-95 duration-1000 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary/60 via-primary to-primary/80 shadow-[0_0_20px_rgba(16,185,129,0.2)]"></div>
                    
                    <div className="relative mb-12">
                         <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl scale-110" />
                         <div className="bg-primary rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(16,185,129,0.2)] border border-primary/30 relative">
                            <CheckCircle className="h-20 w-20 text-primary-foreground fill-white/10" strokeWidth={3} />
                         </div>
                    </div>

                    <h1 className="text-4xl font-black text-foreground mb-4 tracking-tight uppercase italic leading-none">Order Placed!</h1>
                    
                    <div className="flex flex-col items-center gap-2 mb-8">
                        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Order #</span>
                            <span className="text-sm font-black text-foreground tabular-nums tracking-wider uppercase">{idForVerification}</span>
                        </div>
                        {orderDetails?.totalAmount && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">Amount Paid</span>
                                <span className="text-xl font-black text-foreground italic">₹{Number(orderDetails.totalAmount).toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    <p className="text-foreground/40 mb-14 text-[13px] font-bold leading-relaxed px-6 uppercase tracking-wider italic">
                        Your payment was successful. We've started preparing your premium produce! 🚀
                    </p>

                    <div className="flex flex-col gap-5 w-full">
                        <Button 
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-[2.5rem] h-24 text-xl font-black shadow-2xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-between px-10 group relative overflow-hidden"
                            onClick={() => router.push("/orders")}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-1000 -translate-x-full" />
                            <div className="flex flex-col items-start leading-none relative z-10">
                                <span className="uppercase tracking-widest italic">Track Package</span>
                                <span className="text-[9px] font-bold opacity-60 tracking-[0.2em] mt-1.5 leading-none">VIEW LIVE UPDATES</span>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-2 transition-all relative z-10">
                                <ArrowRight className="h-5 w-5" strokeWidth={3} />
                            </div>
                        </Button>

                        <button 
                            className="w-full h-16 rounded-[2rem] bg-secondary border border-border text-foreground font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-secondary/80 transition-all active:scale-95 group italic"
                            onClick={() => router.push("/")}
                        >
                            <Home className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                            Continue Shopping
                        </button>
                    </div>
                </div>
            </PageWrapper>
        );
    }

    if (pageState === "failed") {
        return (
            <PageWrapper>
                <div className="bg-white/5 backdrop-blur-3xl rounded-[3.5rem] shadow-2xl p-12 flex flex-col items-center max-w-md w-full border border-red-500/10 animate-in zoom-in-95 duration-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600"></div>
                    
                    <div className="relative mb-12">
                         <div className="absolute inset-0 bg-red-500/10 rounded-full blur-3xl scale-110" />
                         <div className="bg-red-500/10 rounded-[2.5rem] p-8 border border-red-500/20">
                            <XCircle className="h-20 w-20 text-red-500" strokeWidth={2.5} />
                         </div>
                    </div>

                    <h1 className="text-4xl font-black text-white mb-4 tracking-tight uppercase italic ml-2">Payment Failed</h1>
                    <p className="text-white/30 mb-14 text-sm font-bold leading-relaxed px-6 uppercase tracking-widest italic leading-snug">
                        The transaction was declined by the bank. Our secure tunnel remains open for retry.
                    </p>

                    <div className="flex flex-col gap-4 w-full px-2">
                        <Button className="w-full bg-red-600 hover:bg-red-500 text-white rounded-[2.5rem] h-20 text-lg font-black shadow-2xl shadow-red-500/20 transition-all active:scale-95 uppercase tracking-widest italic"
                            onClick={() => router.push("/checkout")}>
                            RETRY PAYMENT
                        </Button>
                        <button className="w-full text-white/20 h-14 text-[10px] font-black uppercase tracking-[0.4em] hover:text-white/60 transition-colors italic" onClick={() => router.push("/")}>
                            BACK TO TERMINAL
                        </button>
                    </div>
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            <div className="max-w-sm flex flex-col items-center animate-pulse">
                <Clock className="h-24 w-24 text-emerald-500/20 mb-12" strokeWidth={1.5} />
                <h1 className="text-2xl font-black text-white uppercase tracking-[0.3em] italic mb-6">Verification Lag</h1>
                <p className="text-white/20 text-xs font-black uppercase tracking-widest mb-12 leading-relaxed italic">
                    Immediate confirmation delayed. We will process your shipment in the background.
                </p>
                <button className="w-full h-20 bg-emerald-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] italic shadow-2xl shadow-emerald-500/20" onClick={() => router.push("/orders")}>
                    PROCEED TO HISTORY
                </button>
            </div>
        </PageWrapper>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="h-16 w-16 text-primary animate-spin opacity-20" />
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    );
}
