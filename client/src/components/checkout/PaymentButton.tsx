"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentButtonProps {
    amount: number;
    address: any;
    items: any[];
    className?: string;
}

export default function PaymentButton({ amount, address, items, className }: PaymentButtonProps) {
    const [loading, setLoading] = useState(false);
    const { user } = useUserStore();
    const router = useRouter();

    const handlePayment = async () => {
        if (!user) {
            toast.error("Please login to continue");
            return;
        }

        if (!address) {
            toast.error("Please select a delivery address");
            return;
        }

        setLoading(true);

        try {
            // Initiate Payment (Create DB Order + Juspay Session)
            const { data } = await api.post("/payments/initiate", {
                amount,
                address,
                items
            });

            if (data.paymentLink) {
                // BACKUP: Store orderId in localStorage in case query params get stripped on redirect
                if (data.orderId || data.id) {
                    localStorage.setItem("last_order_id", data.orderId || data.id);
                }

                // Redirect user to Juspay Web Checkout
                window.location.href = data.paymentLink;
            } else {
                toast.error("Failed to initiate payment");
                setLoading(false);
            }

        } catch (error) {
            console.error(error);
            toast.error("Processing failed");
            setLoading(false);
        }
    };

    return (
        <Button
            className={cn("w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95", className)}
            onClick={handlePayment}
            disabled={loading}
        >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Pay Now (Online)
        </Button>
    );
}
