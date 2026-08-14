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
    const { user, activeStore } = useUserStore();
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
            // Initiate Payment (Create DB Order + Payment Session)
            const res = await api.post("/payments/initiate", {
                amount,
                address,
                items,
                locationId: activeStore?.id
            });
            const data = res?.data;

            if (data?.iframe && data?.accessKey) {
                const triggerIframeCheckout = () => {
                    const EasebuzzCheckout = (window as any).EasebuzzCheckout;
                    try {
                        const checkoutObj = new EasebuzzCheckout(data.key, data.env);
                        const options = {
                            access_key: data.accessKey,
                            onResponse: (response: any) => {
                                console.log("[Easebuzz Iframe Response]", response);
                                const isSuccess = response.status === "success";
                                const orderIdVal = data.orderId || data.id;
                                router.push(`/payment/success?order_id=${orderIdVal}&status=${isSuccess ? "success" : "failed"}`);
                            }
                        };
                        checkoutObj.initiatePayment(options);
                    } catch (err) {
                        console.warn("[Easebuzz] Frame blocked, falling back to direct payment link:", err);
                        if (data.paymentLink) {
                            window.location.href = data.paymentLink;
                        } else {
                            toast.error("Easebuzz Checkout failed to launch");
                            setLoading(false);
                        }
                    }
                };

                if (!(window as any).EasebuzzCheckout) {
                    const script = document.createElement("script");
                    script.src = "https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js";
                    script.async = true;
                    script.onload = triggerIframeCheckout;
                    script.onerror = () => {
                        toast.error("Failed to load Easebuzz script");
                        setLoading(false);
                    };
                    document.body.appendChild(script);
                } else {
                    triggerIframeCheckout();
                }
            } else if (data.paymentLink) {
                // BACKUP: Store orderId in localStorage in case query params get stripped on redirect
                if (data.orderId || data.id) {
                    localStorage.setItem("last_order_id", data.orderId || data.id);
                }

                // Redirect user to Hosted Checkout
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
