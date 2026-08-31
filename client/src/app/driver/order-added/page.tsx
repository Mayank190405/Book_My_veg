"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function OrderAddedContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const orderId = searchParams.get("orderId") || "";
    const amount = searchParams.get("amount") || "0";
    const customer = searchParams.get("customer") || "Customer";

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 animate-in zoom-in-95 duration-300 my-auto text-center">
            {/* Green Checkmark Circle (Screen 4) */}
            <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
                <Check className="h-12 w-12 stroke-[3]" />
            </div>

            <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Order Added Successfully!</h2>
                <p className="text-xs text-slate-400 font-medium max-w-xs">
                    Order has been added to your My Orders.
                </p>
            </div>

            {/* Order Card (Screen 4) */}
            <div className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-1.5 text-center shadow-sm">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Order #{orderId.slice(-6).toUpperCase() || "1050"}
                </p>
                <h4 className="text-base font-bold text-slate-800">{decodeURIComponent(customer)}</h4>
                <p className="text-2xl font-black text-slate-900">
                    ₹ {Number(amount).toLocaleString()}
                </p>
            </div>

            <div className="w-full space-y-2 pt-4">
                <Button
                    onClick={() => router.push(`/driver/orders/${orderId}`)}
                    className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-200 active:scale-95"
                >
                    View Order
                </Button>
                <button
                    onClick={() => router.push("/driver/orders")}
                    className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                    Back to Orders
                </button>
            </div>
        </div>
    );
}

export default function OrderAddedPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>}>
            <OrderAddedContent />
        </Suspense>
    );
}
