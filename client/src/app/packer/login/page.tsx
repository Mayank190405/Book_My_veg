"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { verifyOtp, sendOtp, loginWithPassword } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Loader2, 
    Eye, 
    EyeOff, 
    Smartphone, 
    Lock, 
    Package, 
    Shield, 
    Sparkles, 
    ArrowRight, 
    Truck, 
    RefreshCw,
    CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

function PackerLoginForm() {
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
            if (userRole !== "PACKING" && userRole !== "ADMIN" && userRole !== "STORE_ADMIN" && userRole !== "MANAGER") {
                toast.error("Access Restricted", { 
                    description: "This terminal is strictly for Packing and Hub personnel." 
                });
                return;
            }
            toast.success("Login Successful", { 
                description: `Welcome back, ${res.user.name || "Packer"}!` 
            });
            router.push("/packer");
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
            if (userRole !== "PACKING" && userRole !== "ADMIN" && userRole !== "STORE_ADMIN" && userRole !== "MANAGER") {
                toast.error("Access Restricted", { 
                    description: "This terminal is strictly for Packing and Hub personnel." 
                });
                return;
            }
            toast.success("Login Successful", {
                description: `Welcome back, ${res.user?.name || "Packer"}!`
            });
            router.push("/packer");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid verification code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative bg-slate-50 text-slate-800 selection:bg-emerald-100 selection:text-emerald-900 overflow-y-auto">
            {/* Subtle Clean Ambient Highlights */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-slate-200/50 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

            {/* Main Clean Card */}
            <div className="w-full max-w-md bg-white rounded-3xl sm:rounded-[2rem] shadow-xl shadow-slate-200/70 border border-slate-200/80 p-6 sm:p-9 flex flex-col justify-between relative z-10 mx-auto my-auto transition-all duration-300">
                <div className="space-y-6">
                    {/* Branding Header with Official Logo */}
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="relative w-28 h-16 sm:w-32 sm:h-18 flex items-center justify-center">
                            <Image 
                                src="/logo.png" 
                                alt="BookMyVeg Logo" 
                                width={130} 
                                height={65} 
                                priority
                                className="object-contain drop-shadow-sm"
                            />
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                                Packer Terminal
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xs">
                                Sign in to manage packing queues, print bills, and verify order QR codes.
                            </p>
                        </div>
                    </div>

                    {/* Mode Segmented Switcher */}
                    <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60">
                        <button
                            type="button"
                            onClick={() => setLoginMode("PASSWORD")}
                            className={`py-2.5 sm:py-3 text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                                loginMode === "PASSWORD"
                                    ? "bg-white text-slate-900 shadow-sm font-bold scale-[1.01]"
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
                                    ? "bg-white text-slate-900 shadow-sm font-bold scale-[1.01]"
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
                                    Mobile Number / Username
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
                                        className="h-12 sm:h-13 pl-11 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
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
                                        onClick={() => toast.info("Please contact your Store Hub Manager to reset your password.")}
                                        className="text-[11px] font-bold text-emerald-700 hover:underline"
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
                                        placeholder="Enter security password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-12 sm:h-13 pl-11 pr-11 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
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
                                        className="rounded-lg border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                                    />
                                    Keep session active
                                </label>
                            </div>

                            <Button 
                                type="submit" 
                                disabled={loading}
                                className="w-full h-12 sm:h-13 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Authenticating...
                                    </>
                                ) : (
                                    <>
                                        Sign In as Packer
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
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-600 font-black text-xs border-r border-slate-200 pr-2.5">
                                            <span>+91</span>
                                        </div>
                                        <Input
                                            type="tel"
                                            placeholder="10-digit mobile"
                                            value={otpPhone}
                                            onChange={(e) => setOtpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            className="h-12 sm:h-13 pl-16 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all tracking-wider"
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
                                    className="w-full h-12 sm:h-13 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
                                        className="h-14 rounded-2xl bg-slate-50 border border-slate-200 text-center text-2xl font-black tracking-[0.4em] text-slate-900 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                                        required
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                                        <span>Sent to +91 {otpPhone}</span>
                                        <button
                                            type="button"
                                            onClick={() => setStep("PHONE")}
                                            className="text-emerald-700 font-bold hover:underline"
                                        >
                                            Change Number
                                        </button>
                                    </div>
                                </div>

                                <Button 
                                    type="submit" 
                                    disabled={loading || otp.length < 4}
                                    className="w-full h-12 sm:h-13 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        <>
                                            Verify & Enter Terminal
                                            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                                        </>
                                    )}
                                </Button>

                                <div className="text-center pt-1">
                                    {countdown > 0 ? (
                                        <p className="text-xs text-slate-400 font-semibold">
                                            Resend OTP in <span className="text-slate-900 font-bold">{countdown}s</span>
                                        </p>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResendOtp}
                                            disabled={loading}
                                            className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1.5"
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
                            href="/driver/login" 
                            className="hover:text-slate-900 transition-colors flex items-center gap-1"
                        >
                            <Truck className="h-3.5 w-3.5" />
                            Driver Portal
                        </Link>
                        <span className="text-slate-300">•</span>
                        <Link 
                            href="/admin/login" 
                            className="hover:text-slate-900 transition-colors flex items-center gap-1"
                        >
                            <Shield className="h-3.5 w-3.5" />
                            Admin Console
                        </Link>
                    </div>
                </div>

                {/* Footer Security Badge */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
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

export default function PackerLoginPage() {
    return (
        <div className="w-full min-h-screen flex-1 flex items-center justify-center bg-slate-50">
            <Suspense fallback={
                <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-slate-900" />
                </div>
            }>
                <PackerLoginForm />
            </Suspense>
        </div>
    );
}
