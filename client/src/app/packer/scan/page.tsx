"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import QRScanner from "@/components/ui/qr-scanner";
import { Button } from "@/components/ui/button";

export default function PackerScanPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [scannedOrder, setScannedOrder] = useState<any | null>(null);

    const handleScanValidate = async (scannedText: string) => {
        if (loading) return;
        setLoading(true);
        try {
            toast.info("Validating Bill QR Code...");
            const response = await api.post("/orders/packer/validate-qr", { qrData: scannedText });
            const order = response.data.order;
            setScannedOrder(order);
            toast.success("Bill Verified Successfully!", {
                description: `Order #${order.id.slice(-8).toUpperCase()} validated.`
            });
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to validate bill QR code.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col justify-between max-w-md mx-auto">
            {/* Top Bar */}
            <div className="p-4 flex items-center justify-between z-10 text-white bg-slate-900/80 backdrop-blur-md">
                <button onClick={() => router.push("/packer")} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h2 className="text-base font-bold">Verify Bill QR</h2>
                <div className="w-8" />
            </div>

            {/* Subtitle */}
            <div className="text-center px-6 pt-2 text-slate-300 z-10">
                <p className="text-xs font-semibold">Scan the printed bill QR to confirm order packing</p>
            </div>

            {/* Viewfinder or Success Screen */}
            <div className="flex-1 flex items-center justify-center p-6 relative">
                {scannedOrder ? (
                    <div className="w-full max-w-xs bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">Order Verified!</h3>
                            <p className="text-xs text-slate-500 font-bold mt-1">
                                #{scannedOrder.id.slice(-8).toUpperCase()}
                            </p>
                            <p className="text-xs text-slate-600 font-medium mt-1">
                                {scannedOrder.user?.name || "Customer"} — ₹{Number(scannedOrder.totalAmount || 0).toFixed(2)}
                            </p>
                        </div>
                        <div className="pt-2 space-y-2">
                            <Button 
                                onClick={() => setScannedOrder(null)} 
                                variant="outline" 
                                className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-wider"
                            >
                                Scan Another Bill
                            </Button>
                            <Button 
                                onClick={() => router.push("/packer")} 
                                className="w-full h-11 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black uppercase tracking-wider"
                            >
                                Back to Dashboard
                            </Button>
                        </div>
                    </div>
                ) : (
                    <QRScanner 
                        title="Scan Bill QR" 
                        isModal={false}
                        onScan={handleScanValidate} 
                        onClose={() => router.push("/packer")} 
                    />
                )}
            </div>

            {/* Bottom Note */}
            <div className="p-6 pb-10 text-center text-[11px] text-slate-400">
                Ensure QR code is clearly visible in the camera frame
            </div>
        </div>
    );
}
