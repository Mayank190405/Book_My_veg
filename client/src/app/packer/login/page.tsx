"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { verifyOtp, sendOtp } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package, ShieldCheck, Smartphone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";

function PackerLoginForm() {
    const router = useRouter();
    const { user } = useUserStore();
    
    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await sendOtp(phone);
            toast.success("OTP sent to your warehouse device");
            setStep("OTP");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to initiate session");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await verifyOtp(phone, otp);
            if (res.user.role !== "PACKING") {
                toast.error("Access Denied", { description: "This terminal is restricted to PACKING personnel." });
                return;
            }
            toast.success("Warehouse Session Established");
            router.push("/packer");
        } catch (error: any) {
            toast.error("Invalid verification code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-blue-50 relative overflow-hidden group">
                {/* Visual accents */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-50 transition-all group-hover:bg-blue-100/50" />
                
                <div className="relative z-10 space-y-8">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-200 ring-4 ring-blue-50 group-hover:rotate-6 transition-transform">
                            <Package className="h-10 w-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Packer Terminal</h1>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600/60 mt-2">BMV Logistical Hub</p>
                        </div>
                    </div>

                    {step === "PHONE" ? (
                        <form onSubmit={handleSendOtp} className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Authentication ID (Phone)</Label>
                                <div className="relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold border-r border-slate-100 pr-4">+91</div>
                                    <Input
                                        type="tel"
                                        placeholder="Mobile Registry ID"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="h-16 pl-20 rounded-2xl bg-slate-50 border-none text-lg font-bold focus:ring-4 focus:ring-blue-100 transition-all"
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 transition-all active:scale-95">
                                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Initiate Audit Session"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div className="space-y-3 text-center">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Warehouse Access Code</Label>
                                <Input
                                    type="text"
                                    placeholder="• • • • • •"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="h-20 rounded-2xl bg-slate-50 border-none text-center text-3xl font-black tracking-[0.5em] focus:ring-4 focus:ring-blue-100 transition-all pl-[0.5em]"
                                    required
                                />
                                <p className="text-[10px] text-slate-400 font-bold">Sent to Registry ID +91 {phone}</p>
                            </div>
                            <Button type="submit" className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-slate-200 transition-all active:scale-95">
                                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Establish Terminal Access"}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
            <p className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Audited Environment • Authorized Only</p>
        </div>
    );
}

export default function PackerLoginPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12">
            <Suspense fallback={<Loader2 className="h-12 w-12 animate-spin text-blue-600" />}>
                <PackerLoginForm />
            </Suspense>
        </div>
    );
}
