"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Clock, Loader2, ShoppingBag, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { useCartStore } from "@/store/useCartStore";
import confetti from "canvas-confetti";

type PageState = "verifying" | "success" | "failed" | "pending";

const SUCCESS_STATUSES = new Set(["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED", "CAPTURE_INITIATED"]);

function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const clearCart = useCartStore((s) => s.clearCart);

    const [pageState, setPageState] = useState<PageState>("verifying");
    const [idForVerification, setIdForVerification] = useState<string | null>(null);

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
                    particleCount: 2,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ["#22c55e", "#3b82f6"]
                });
                confetti({
                    particleCount: 2,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ["#22c55e", "#3b82f6"]
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
            await new Promise(resolve => setTimeout(resolve, 5000));

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
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-gray-50 to-white text-center animate-in fade-in duration-700">
            {children}
        </div>
    );

    if (pageState === "verifying") {
        return (
            <PageWrapper>
                <div className="flex flex-col items-center">
                    <div className="relative mb-10">
                        <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-60 scale-[2] animate-pulse"></div>
                        <Loader2 className="h-28 w-28 text-blue-600 animate-spin relative z-10" />
                    </div>
                    <h1 className="text-4xl font-black mb-4 text-gray-900 tracking-tight">Securing Confirmation</h1>
                    <p className="text-gray-500 text-xl max-w-sm leading-relaxed font-bold">
                        We're verifying your transaction with the bank. Please hold tight.
                    </p>
                </div>
            </PageWrapper>
        );
    }

    if (pageState === "success") {
        return (
            <PageWrapper>
                <div className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] shadow-[0_40px_80px_-15px_rgba(22,163,74,0.15)] p-12 flex flex-col items-center max-w-md w-full border border-white animate-in zoom-in-95 duration-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-blue-500"></div>
                    <div className="bg-green-100 rounded-full p-7 mb-10 shadow-inner">
                        <CheckCircle className="h-24 w-24 text-green-600" />
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tighter">Order Placed!</h1>
                    <p className="text-gray-500 mb-12 text-xl font-bold leading-relaxed px-4">Your payment was successful. We've started preparing your order! 🚀</p>
                    <div className="flex flex-col gap-4 w-full px-2">
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-[2rem] h-20 text-2xl font-black shadow-2xl shadow-green-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                            onClick={() => router.push("/orders")}>
                            View My Orders <ArrowRight className="h-7 w-7" />
                        </Button>
                        <Button variant="ghost" className="w-full text-gray-400 h-14 text-lg font-black hover:bg-gray-100 rounded-2xl tracking-tight" onClick={() => router.push("/")}>
                            CONTINUE SHOPPING
                        </Button>
                    </div>
                </div>
            </PageWrapper>
        );
    }

    if (pageState === "failed") {
        return (
            <PageWrapper>
                <div className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] shadow-[0_40px_80px_-15px_rgba(239,68,68,0.15)] p-12 flex flex-col items-center max-w-md w-full border border-white animate-in zoom-in-95 duration-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-400 to-orange-500"></div>
                    <div className="bg-red-100 rounded-full p-7 mb-10 shadow-inner">
                        <XCircle className="h-24 w-24 text-red-600" />
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tighter">Payment Failed</h1>
                    <p className="text-gray-500 mb-12 text-xl font-bold leading-relaxed">The bank declined your transaction. No money was deducted from your account.</p>
                    <div className="flex flex-col gap-4 w-full px-2">
                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white rounded-[2rem] h-20 text-2xl font-black shadow-2xl shadow-red-200 transition-all active:scale-95"
                            onClick={() => router.push("/checkout")}>
                            RETRY PAYMENT
                        </Button>
                        <Button variant="ghost" className="w-full text-gray-400 h-14 text-lg font-black hover:bg-gray-100 rounded-2xl tracking-tight" onClick={() => router.push("/")}>
                            BACK TO HOME
                        </Button>
                    </div>
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            <div className="max-w-sm flex flex-col items-center">
                <Clock className="h-24 w-24 text-yellow-500 mb-8 opacity-20" />
                <h1 className="text-3xl font-black mb-4">Verification Delayed</h1>
                <p className="text-gray-500 text-xl font-bold mb-10 leading-relaxed">We couldn't get an immediate response. Your order will be updated in the background.</p>
                <Button className="w-full h-16 bg-gray-900 text-white rounded-2xl text-xl font-black" onClick={() => router.push("/orders")}>GO TO ORDERS</Button>
            </div>
        </PageWrapper>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    );
}
