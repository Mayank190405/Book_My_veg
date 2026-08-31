"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { verifyOtp, sendOtp, loginWithPassword } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package, Lock, Phone, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";

function PackerLoginForm() {
    const router = useRouter();
    const { user } = useUserStore();
    
    const [loginMode, setLoginMode] = useState<"PASSWORD" | "OTP">("PASSWORD");
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    
    // OTP States
    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [otpPhone, setOtpPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier.trim() || !password) {
            toast.error("Please enter both login identifier and password");
            return;
        }

        setLoading(true);
        try {
            const res = await loginWithPassword(identifier.trim(), password);
            const userRole = res?.user?.role;
            if (userRole !== "PACKING" && userRole !== "ADMIN" && userRole !== "STORE_ADMIN") {
                toast.error("Access Denied", { 
                    description: "This portal is strictly restricted to Packing personnel." 
                });
                return;
            }
            toast.success("Packer Duty Started", { description: `Welcome, ${res.user.name || "Packer"}!` });
            router.push("/packer");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid credentials. Please verify your password.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otpPhone || otpPhone.length < 10) {
            toast.error("Please enter a valid 10-digit mobile number");
            return;
        }
        setLoading(true);
        try {
            await sendOtp(otpPhone);
            toast.success("OTP sent to your registered device");
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
            const res = await verifyOtp(otpPhone, otp);
            const userRole = res?.user?.role;
            if (userRole !== "PACKING" && userRole !== "ADMIN" && userRole !== "STORE_ADMIN") {
                toast.error("Access Denied", { description: "This terminal is restricted to Packing personnel." });
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
            <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl border border-blue-100 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-60 transition-all group-hover:bg-blue-100/50" />
                
                <div className="relative z-10 space-y-7">
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-200 ring-4 ring-blue-50 group-hover:rotate-6 transition-transform">
                            <Package className="h-10 w-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Packer Portal</h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mt-1">BMV Fulfillment Hub</p>
                        </div>
                    </div>

                    {/* Mode Selector Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => setLoginMode("PASSWORD")}
                            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                loginMode === "PASSWORD"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            Password Login
                        </button>
                        <button
                            type="button"
                            onClick={() => setLoginMode("OTP")}
                            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                loginMode === "OTP"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            WhatsApp OTP
                        </button>
                    </div>

                    {loginMode === "PASSWORD" ? (
                        <form onSubmit={handlePasswordLogin} className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                    Mobile / Username
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        type="text"
                                        placeholder="e.g. 9876543210"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        className="h-14 pl-12 rounded-2xl bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-blue-100 transition-all shadow-inner"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                    Packer Password
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-blue-100 transition-all shadow-inner"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <Button 
                                type="submit" 
                                disabled={loading}
                                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Access Packing Terminal <ShieldCheck className="h-4 w-4" /></>}
                            </Button>
                        </form>
                    ) : (
                        step === "PHONE" ? (
                            <form onSubmit={handleSendOtp} className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Registered Mobile</Label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 border-r border-slate-200 pr-3">
                                            <span className="text-base">🇮🇳</span>
                                            <span className="text-slate-500 font-bold text-xs">+91</span>
                                        </div>
                                        <Input
                                            type="tel"
                                            placeholder="Phone Number"
                                            value={otpPhone}
                                            onChange={(e) => setOtpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            className="h-14 pl-20 rounded-2xl bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-blue-100 transition-all shadow-inner"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <Button 
                                    type="submit" 
                                    disabled={loading}
                                    className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-200 transition-all active:scale-95"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send WhatsApp OTP"}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOtp} className="space-y-5">
                                <div className="space-y-2 text-center">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entry Approval Code</Label>
                                    <Input
                                        type="text"
                                        placeholder="• • • • • •"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="h-16 rounded-2xl bg-slate-50 border-none text-center text-2xl font-black tracking-[0.4em] focus:ring-4 focus:ring-blue-100 transition-all"
                                        required
                                        autoFocus
                                    />
                                    <p className="text-[10px] text-slate-400 font-bold mt-1">Encrypted key sent to +91 {otpPhone}</p>
                                </div>
                                <Button 
                                    type="submit" 
                                    disabled={loading}
                                    className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-slate-200 transition-all active:scale-95"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Identity"}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setStep("PHONE")}
                                    className="w-full text-center text-xs text-slate-400 font-bold hover:text-slate-600"
                                >
                                    Change Mobile Number
                                </button>
                            </form>
                        )
                    )}
                </div>
            </div>
            <p className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                BMV Fulfillment System • Audited Logistics
            </p>
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

