"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithPassword } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, Cpu, Lock, Globe, Zap, ShieldCheck, Key, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

export default function AdminLogin() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get("redirect") || "/admin/dashboard";

    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user } = useUserStore();

    // Already logged in as Admin? Redirect.
    useEffect(() => {
        if (user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STORE_ADMIN")) {
            router.push(redirect);
        }
    }, [user, router, redirect]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await loginWithPassword(phone, password);
            if (res.user.role !== "ADMIN" && res.user.role !== "SUPER_ADMIN" && res.user.role !== "STORE_ADMIN") {
                toast.error("Access Denied: Insufficient Privileges");
                useUserStore.getState().logout();
                return;
            }
            toast.success("Login Successful", {
                description: `Accessed as ${res.user.role}`,
                icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />
            });

            // Role-based institutional routing
            if (res.user.role === "STORE_ADMIN" && res.user.slug) {
                router.push(`/admin/stores/${res.user.slug}`);
            } else {
                router.push(redirect);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid Admin Credentials");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
            {/* Subtle Design Elements */}
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-emerald-50 rounded-full blur-[120px] -mr-32 -mt-32 opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-blue-50 rounded-full blur-[120px] -ml-32 -mb-32 opacity-50"></div>
            
            <div className="w-full max-w-lg relative">
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 md:p-14 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col items-center">
                        {/* Branding Header */}
                        <div className="flex flex-col items-center mb-12 text-center">
                            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-200 mb-6 group transition-transform hover:scale-105 duration-500">
                                <ShieldCheck className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Admin Portal</h1>
                            <p className="text-sm text-slate-500 font-medium">Verify your credentials to access management</p>
                        </div>

                        <form onSubmit={handleLogin} className="w-full space-y-8">
                            <div className="space-y-6">
                                {/* Admin ID / Phone */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Phone Number</Label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center pr-4 border-r border-slate-100 transition-colors group-focus-within:border-emerald-200 py-1">
                                            <UserIcon className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                                        </div>
                                        <input 
                                            type="tel"
                                            placeholder="Ph. Number"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl pl-16 pr-6 text-base font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Security Key / Password */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Password</Label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center pr-4 border-r border-slate-100 transition-colors group-focus-within:border-emerald-200 py-1">
                                            <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                                        </div>
                                        <input 
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={cn(
                                                "w-full h-14 bg-slate-50 border border-slate-200 rounded-xl pl-16 pr-14 text-base font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300",
                                                !showPassword && "tracking-[0.2em]"
                                            )}
                                            required
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest text-sm shadow-xl shadow-slate-200 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>Log In</span>
                                        <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
                                    </>
                                )}
                            </button>
                            
                            <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Authorized Access</span>
                                </div>
                                <div className="hidden md:flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Connection Verified</span>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Footer Credits */}
                <div className="mt-10 flex flex-col items-center gap-2 opacity-40">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Book My Veg Administrative Interface</p>
                    <div className="flex items-center gap-4">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Version 2.4.0</span>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Cloud Environment</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
