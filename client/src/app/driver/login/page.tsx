"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { verifyOtp, sendOtp, loginWithPassword } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Loader2, 
    Eye, 
    EyeOff, 
    Smartphone, 
    Lock, 
    Truck, 
    Shield, 
    Sparkles, 
    ArrowRight, 
    Package, 
    RefreshCw,
    Navigation
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

function DriverLoginForm() {
    const router = useRouter();
    
    const [loginMode, setLoginMode] = useState<"PASSWORD" | "OTP">("PASSWORD");
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    
    // OTP States
    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [otpPhone, setOtpPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        let timer: any;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanIdent = identifier.trim();
        if (!cleanIdent || !password) {
            toast.error("Please enter mobile number and password");
            return;
        }

        setLoading(true);
        try {
            const res = await loginWithPassword(cleanIdent, password);
            const userRole = res?.user?.role;
            if (userRole !== "DELIVERY_PARTNER" && userRole !== "ADMIN" && userRole !== "STORE_ADMIN" && userRole !== "MANAGER") {
                toast.error("Access Restricted", { 
                    description: "This portal is strictly restricted to Delivery Partners." 
                });
                return;
            }
            toast.success("Login Successful", { 
                description: `Welcome back, ${res.user.name || "Rider"}!` 
            });
            router.push("/driver");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid mobile number or password.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanPhone = otpPhone.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) {
            toast.error("Please enter a valid 10-digit mobile number");
            return;
        }
        setLoading(true);
        try {
            await sendOtp(cleanPhone);
            toast.success("OTP Sent via WhatsApp", {
                description: `Verification code sent to +91 ${cleanPhone}`
            });
            setStep("OTP");
            setCountdown(45);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to send WhatsApp OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (countdown > 0 || loading) return;
        setLoading(true);
        try {
            await sendOtp(otpPhone);
            toast.success("New OTP Sent via WhatsApp");
            setCountdown(45);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to resend OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp || otp.length < 4) {
            toast.error("Please enter the verification code");
            return;
        }
        setLoading(true);
        try {
            const res = await verifyOtp(otpPhone, otp);
            const userRole = res?.user?.role;
            if (userRole !== "DELIVERY_PARTNER" && userRole !== "ADMIN" && userRole !== "STORE_ADMIN" && userRole !== "MANAGER") {
                toast.error("Access Restricted", { 
                    description: "This portal is strictly restricted to Delivery Partners." 
                });
                return;
            }
            toast.success("Login Successful", {
                description: `Welcome back, ${res.user?.name || "Rider"}!`
            });
            router.push("/driver");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid verification code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden bg-slate-950">
            {/* Ambient Background Gradient Orbs */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/15 rounded-full blur-3xl pointer-events-none" />

            {/* Main Responsive Card */}
            <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl shadow-blue-950/50 border border-white/40 p-6 sm:p-9 flex flex-col justify-between relative z-10 transition-all duration-300">
                <div className="space-y-6">
                    {/* Header Badge & Dynamic Icon */}
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/70 text-blue-700 text-[10px] font-black uppercase tracking-wider">
                            <Navigation className="h-3 w-3 text-blue-600 animate-spin-slow" />
                            Fleet & Dispatch Node
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
                            <div className="relative w-20 h-20 sm:w-22 sm:h-22 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-400/30 text-white">
                                <Truck className="w-10 h-10 sm:w-11 sm:h-11 stroke-[1.8]" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                                Delivery Partner Portal
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xs">
                                Sign in to accept deliveries, scan bills, collect payments, and manage daily drop-offs.
                            </p>
                        </div>
                    </div>

                    {/* Mode Segmented Switcher */}
                    <div className="grid grid-cols-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60">
                        <button
                            type="button"
                            onClick={() => setLoginMode("PASSWORD")}
                            className={`py-2.5 sm:py-3 text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                                loginMode === "PASSWORD"
                                    ? "bg-white text-blue-800 shadow-md shadow-slate-200/80 scale-[1.02]"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            <Lock className="h-3.5 w-3.5" />
                            Password
                        </button>
                        <button
                            type="button"
                            onClick={() => setLoginMode("OTP")}
                            className={`py-2.5 sm:py-3 text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                                loginMode === "OTP"
                                    ? "bg-white text-blue-800 shadow-md shadow-slate-200/80 scale-[1.02]"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            <Smartphone className="h-3.5 w-3.5" />
                            WhatsApp OTP
                        </button>
                    </div>

                    {/* Login Forms */}
                    {loginMode === "PASSWORD" ? (
                        <form onSubmit={handlePasswordLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">
                                    Mobile Number / Rider ID
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <Smartphone className="h-4.5 w-4.5" />
                                    </div>
                                    <Input
                                        type="text"
                                        placeholder="Enter registered mobile"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        className="h-12 sm:h-13 pl-11 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => toast.info("Please contact your Hub Dispatch Manager to reset your password.")}
                                        className="text-[11px] font-bold text-blue-700 hover:underline"
                                    >
                                        Forgot?
                                    </button>
                                </div>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <Lock className="h-4.5 w-4.5" />
                                    </div>
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter rider password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-12 sm:h-13 pl-11 pr-11 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1">
                                <label className="flex items-center gap-2 text-slate-600 font-semibold cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={rememberMe} 
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                    Keep session active
                                </label>
                            </div>

                            <Button 
                                type="submit" 
                                disabled={loading}
                                className="w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-blue-300/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Authenticating...
                                    </>
                                ) : (
                                    <>
                                        Sign In as Delivery Partner
                                        <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                                    </>
                                )}
                            </Button>
                        </form>
                    ) : (
                        step === "PHONE" ? (
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">
                                        WhatsApp Registered Mobile
                                    </label>
                                    <div className="relative flex items-center">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-500 font-bold text-xs border-r border-slate-200 pr-2">
                                            <span>🇮🇳</span>
                                            <span>+91</span>
                                        </div>
                                        <Input
                                            type="tel"
                                            placeholder="10-digit mobile"
                                            value={otpPhone}
                                            onChange={(e) => setOtpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            className="h-12 sm:h-13 pl-20 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all tracking-wider"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-medium ml-1">
                                        We will send a one-time verification code on WhatsApp.
                                    </p>
                                </div>

                                <Button 
                                    type="submit" 
                                    disabled={loading || otpPhone.length < 10}
                                    className="w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-blue-300/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Sending Code...
                                        </>
                                    ) : (
                                        <>
                                            Send WhatsApp OTP
                                            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div className="space-y-2 text-center">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                        Enter Verification Code
                                    </label>
                                    <Input
                                        type="text"
                                        placeholder="• • • • • •"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="h-14 rounded-2xl bg-slate-50/80 border border-slate-200 text-center text-2xl font-black tracking-[0.4em] text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                                        required
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                                        <span>Sent to +91 {otpPhone}</span>
                                        <button
                                            type="button"
                                            onClick={() => setStep("PHONE")}
                                            className="text-blue-700 font-bold hover:underline"
                                        >
                                            Change Number
                                        </button>
                                    </div>
                                </div>

                                <Button 
                                    type="submit" 
                                    disabled={loading || otp.length < 4}
                                    className="w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-blue-300/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        <>
                                            Verify & Enter Fleet App
                                            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                                        </>
                                    )}
                                </Button>

                                <div className="text-center pt-1">
                                    {countdown > 0 ? (
                                        <p className="text-xs text-slate-400 font-semibold">
                                            Resend OTP in <span className="text-blue-700 font-bold">{countdown}s</span>
                                        </p>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResendOtp}
                                            disabled={loading}
                                            className="text-xs font-bold text-blue-700 hover:underline inline-flex items-center gap-1.5"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                            Resend OTP via WhatsApp
                                        </button>
                                    )}
                                </div>
                            </form>
                        )
                    )}

                    {/* Switch Portal Navigation Links */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-4 text-xs font-bold text-slate-500">
                        <Link 
                            href="/packer/login" 
                            className="hover:text-purple-600 transition-colors flex items-center gap-1"
                        >
                            <Package className="h-3.5 w-3.5" />
                            Packer Portal
                        </Link>
                        <span className="text-slate-300">•</span>
                        <Link 
                            href="/admin/login" 
                            className="hover:text-blue-600 transition-colors flex items-center gap-1"
                        >
                            <Shield className="h-3.5 w-3.5" />
                            Admin Console
                        </Link>
                    </div>
                </div>

                {/* Footer Security Badge */}
                <div className="mt-6 pt-4 border-t border-slate-100/70 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-slate-500">
                        <Shield className="h-3.5 w-3.5 text-emerald-600" />
                        256-bit Encrypted
                    </span>
                    <span>BookMyVeg v2.4</span>
                </div>
            </div>
        </div>
    );
}

export default function DriverLoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            </div>
        }>
            <DriverLoginForm />
        </Suspense>
    );
}
