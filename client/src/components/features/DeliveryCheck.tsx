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
        <div className="bg-white space-y-4">
            <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-widest text-slate-800">
                <MapPin className="w-4 h-4 text-[#0B7A53]" />
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
                    className="bg-white rounded-2xl border-slate-250/70 h-12 text-sm focus-visible:ring-emerald-500/25 placeholder:text-slate-400 font-bold text-slate-700"
                />
                <Button
                    type="submit"
                    disabled={pincode.length !== 6 || loading}
                    className="shrink-0 rounded-2xl h-12 px-6 bg-[#0B7A53] hover:bg-[#096645] text-white font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Check"}
                </Button>
            </form>

            {result && (
                <div className={cn(
                    "text-xs flex items-start gap-2.5 p-3 rounded-2xl border animate-in fade-in duration-350",
                    result.serviceable 
                        ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" 
                        : "bg-red-50/50 border-red-100 text-red-700"
                )}>
                    {result.serviceable ? (
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                        <p className="font-extrabold uppercase tracking-wide">{result.message}</p>
                        {result.estimatedDelivery && (
                            <p className="text-[10px] font-bold opacity-80 mt-0.5">Estimated by {result.estimatedDelivery}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
