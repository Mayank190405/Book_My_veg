"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Flashlight } from "lucide-react";
import QRScanner from "@/components/ui/qr-scanner";

export default function DriverScanPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleScanClaim = async (scannedText: string) => {
        if (loading) return;
        setLoading(true);
        try {
            toast.info("Verifying Bill QR Code...");
            const response = await api.post("/orders/driver/claim-qr", { qrData: scannedText });
            const order = response.data.order;
            
            // Navigate to Screen 4 (Order Added Success)
            router.push(`/driver/order-added?orderId=${order.id}&amount=${order.totalAmount}&customer=${encodeURIComponent(order.user?.name || "Customer")}`);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to claim order. Please verify bill.");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col justify-between max-w-md mx-auto">
            {/* Top Bar (Screen 3) */}
            <div className="p-4 flex items-center justify-between z-10 text-white bg-slate-900/80 backdrop-blur-md">
                <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h2 className="text-base font-bold">Scan QR Code</h2>
                <div className="w-8" />
            </div>

            {/* Subtitle */}
            <div className="text-center px-6 pt-4 text-slate-300 z-10">
                <p className="text-xs font-semibold">Scan the QR code on the bill to add order</p>
            </div>

            {/* Central Camera / Viewfinder (Screen 3) */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                <QRScanner 
                    title="Scan Bill QR" 
                    isModal={false}
                    onScan={handleScanClaim} 
                    onClose={() => router.back()} 
                />
            </div>

            {/* Bottom Controls (Screen 3) */}
            <div className="p-6 pb-12 flex flex-col items-center gap-2 z-10 text-white/80">
                <button 
                    onClick={() => toast.info("Flashlight toggle supported on compatible mobile hardware")}
                    className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
                >
                    <Flashlight className="h-5 w-5" />
                </button>
                <p className="text-[11px] font-medium text-slate-400">Tap to turn on flashlight</p>
            </div>
        </div>
    );
}
