"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { verifyOtp, sendOtp, loginWithPassword } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Smartphone, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";

function DriverLoginForm() {
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
            toast.error("Please enter mobile number and password");
            return;
        }

        setLoading(true);
        try {
            const res = await loginWithPassword(identifier.trim(), password);
            const userRole = res?.user?.role;
            if (userRole !== "DELIVERY_PARTNER" && userRole !== "ADMIN" && userRole !== "STORE_ADMIN") {
                toast.error("Access Restricted", { 
                    description: "This portal is strictly restricted to Delivery Partners." 
                });
                return;
            }
            toast.success("Login Successful", { description: `Welcome back, ${res.user.name || "Delivery Partner"}!` });
            router.push("/driver");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid mobile number or password.");
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
            toast.success("OTP Sent via WhatsApp");
            setStep("OTP");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to send WhatsApp OTP");
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
            if (userRole !== "DELIVERY_PARTNER" && userRole !== "ADMIN" && userRole !== "STORE_ADMIN") {
                toast.error("Access Restricted", { description: "This portal is restricted to Delivery Partners." });
                return;
            }
            toast.success("Login Successful");
            router.push("/driver");
        } catch (error: any) {
            toast.error("Invalid verification code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-sm mx-auto px-5 py-8 flex flex-col min-h-screen justify-between">
            <div className="space-y-8 my-auto">
                {/* Illustration & Branding (Screen 1) */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-28 h-28 bg-blue-50 rounded-3xl flex items-center justify-center relative shadow-sm">
                        {/* Scooter Delivery Illustration */}
                        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18.5" cy="17.5" r="3.5"/>
                                <circle cx="5.5" cy="17.5" r="3.5"/>
                                <circle cx="15" cy="5" r="1"/>
                                <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">DELIVERY PORTAL</h1>
                        <div className="space-y-0.5">
                            <h2 className="text-base font-bold text-slate-800">Welcome Back!</h2>
                            <p className="text-xs text-slate-400 font-medium">Log in to continue</p>
                        </div>
                    </div>
                </div>

                {/* Login Mode Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button
                        type="button"
                        onClick={() => setLoginMode("PASSWORD")}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                            loginMode === "PASSWORD"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        Password
                    </button>
                    <button
                        type="button"
                        onClick={() => setLoginMode("OTP")}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                            loginMode === "OTP"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        WhatsApp OTP
                    </button>
                </div>

                {loginMode === "PASSWORD" ? (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Smartphone className="h-5 w-5" />
                                </div>
                                <Input
                                    type="text"
                                    placeholder="Mobile Number"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="h-13 pl-12 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold focus:border-blue-600 focus:bg-white transition-all"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-13 pl-12 pr-12 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold focus:border-blue-600 focus:bg-white transition-all"
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

                        <div className="text-right">
                            <button
                                type="button"
                                onClick={() => toast.info("Please contact store administrator to reset your password.")}
                                className="text-xs font-bold text-blue-600 hover:underline"
                            >
                                Forgot Password?
                            </button>
                        </div>

                        <Button 
                            type="submit" 
                            disabled={loading}
                            className="w-full h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
                        </Button>
                    </form>
                ) : (
                    step === "PHONE" ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Smartphone className="h-5 w-5" />
                                </div>
                                <Input
                                    type="tel"
                                    placeholder="Mobile Number"
                                    value={otpPhone}
                                    onChange={(e) => setOtpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    className="h-13 pl-12 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold focus:border-blue-600 focus:bg-white transition-all"
                                    required
                                    autoFocus
                                />
                            </div>
                            <Button 
                                type="submit" 
                                disabled={loading}
                                className="w-full h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send OTP"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div className="space-y-2 text-center">
                                <Input
                                    type="text"
                                    placeholder="• • • • • •"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="h-14 rounded-2xl bg-slate-50 border border-slate-200 text-center text-2xl font-black tracking-[0.4em] focus:border-blue-600 focus:bg-white transition-all"
                                    required
                                    autoFocus
                                />
                                <p className="text-xs text-slate-400 font-medium">OTP sent to +91 {otpPhone}</p>
                            </div>
                            <Button 
                                type="submit" 
                                disabled={loading}
                                className="w-full h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Login"}
                            </Button>
                            <button
                                type="button"
                                onClick={() => setStep("PHONE")}
                                className="w-full text-center text-xs text-slate-400 font-medium hover:text-slate-600"
                            >
                                Change Mobile Number
                            </button>
                        </form>
                    )
                )}
            </div>

            <div className="text-center pt-8">
                <p className="text-[11px] text-slate-400 font-medium">Version 1.0.0</p>
            </div>
        </div>
    );
}

export default function DriverLoginPage() {
    return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <Suspense fallback={<Loader2 className="h-10 w-10 animate-spin text-blue-600" />}>
                <DriverLoginForm />
            </Suspense>
        </div>
    );
}
