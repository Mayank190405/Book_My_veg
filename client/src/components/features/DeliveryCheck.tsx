"use client";

import { useState } from "react";
import { MapPin, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/services/api";
import { cn } from "@/lib/utils";

export default function DeliveryCheck() {
    const [pincode, setPincode] = useState("");
    const [result, setResult] = useState<{ serviceable: boolean; message: string; estimatedDelivery?: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pincode || pincode.length !== 6) return;

        setLoading(true);
        setResult(null);
        try {
            const res = await api.get(`/products/check-pincode/${pincode}`);
            setResult(res.data);
        } catch (error: any) {
            setResult({
                serviceable: false,
                message: error.response?.data?.message || "Delivery not available",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span>Check Delivery Availability</span>
            </div>
            <form onSubmit={handleCheck} className="flex gap-2">
                <Input
                    placeholder="Enter Pincode"
                    value={pincode}
                    onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPincode(val);
                        setResult(null);
                    }}
                    className="bg-white"
                />
                <Button
                    type="submit"
                    variant="outline"
                    disabled={pincode.length !== 6 || loading}
                    className="shrink-0"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
                </Button>
            </form>

            {result && (
                <div className={cn(
                    "text-sm flex items-start gap-2 p-2 rounded-lg",
                    result.serviceable ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                    {result.serviceable ? (
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                        <p className="font-medium">{result.message}</p>
                        {result.estimatedDelivery && (
                            <p className="text-xs opacity-90 mt-0.5">Estimated by {result.estimatedDelivery}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
