"use client";

import Link from "next/link";
import { Package, MapPin, LogOut, User, CreditCard, Bell, Settings, FileText, HelpCircle, ChevronRight, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import AuthGuard from "@/components/auth/AuthGuard";
import ProfileEditForm from "@/components/account/ProfileEditForm";
import { Switch } from "@/components/ui/switch";

export default function AccountPage() {
    const { user, logout } = useUserStore();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push("/");
    };

    return (
        <AuthGuard>
            <div className="pb-32 space-y-8 animate-fade-in">
                <header className="flex items-center justify-between px-1">
                    <h1 className="text-3xl font-black text-emerald-950 uppercase tracking-tight">Profile</h1>
                    <div className="p-2.5 rounded-2xl bg-white border border-black/5 shadow-sm text-emerald-900">
                        <Settings className="h-5 w-5" />
                    </div>
                </header>

                {/* Profile Section */}
                <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-sm flex items-center gap-5 relative overflow-hidden group">
                    <div className="h-20 w-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-emerald-200 border-4 border-white overflow-hidden relative group-hover:rotate-6 transition-transform">
                        {user?.name?.charAt(0).toUpperCase() || <User className="h-10 w-10" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-black text-emerald-950 text-xl tracking-tight leading-tight uppercase truncate">{user?.name || "Guest User"}</h2>
                        <div className="flex flex-col mt-1 gap-0.5">
                            <div className="flex items-center gap-1.5 text-emerald-950/40 text-[10px] font-black uppercase tracking-widest">
                                <Phone className="h-3 w-3" /> {user?.phone}
                            </div>
                            <div className="text-emerald-950/40 text-[10px] font-black uppercase tracking-widest truncate">
                                {user?.email}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-xl border border-black/5 shadow-sm">
                        <ProfileEditForm />
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <Link href="/orders" className="group bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-sm flex flex-col items-center justify-center gap-3 hover:bg-white/60 transition-all active:scale-95">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Package className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-950 uppercase tracking-widest">My Orders</span>
                    </Link>
                    <Link href="/account/addresses" className="group bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-sm flex flex-col items-center justify-center gap-3 hover:bg-white/60 transition-all active:scale-95">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                            <MapPin className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-950 uppercase tracking-widest">Addresses</span>
                    </Link>
                </div>

                {/* Sections List */}
                <div className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-emerald-950/40 uppercase tracking-[0.3em] px-4">Preferences</h3>
                        <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-black/5 flex items-center justify-between cursor-not-allowed opacity-40">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                    <span className="text-xs font-black text-emerald-950 uppercase tracking-widest">Payments</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-emerald-300" />
                            </div>

                            <div className="p-6 border-b border-black/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                        <Bell className="h-5 w-5" />
                                    </div>
                                    <span className="text-xs font-black text-emerald-950 uppercase tracking-widest">Notifications</span>
                                </div>
                                <Switch checked={true} />
                            </div>

                            <div className="p-6 flex items-center justify-between cursor-not-allowed opacity-40">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                                        <Settings className="h-5 w-5" />
                                    </div>
                                    <span className="text-xs font-black text-emerald-950 uppercase tracking-widest">App Settings</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-emerald-300" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-emerald-950/40 uppercase tracking-[0.3em] px-4">Support</h3>
                        <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white shadow-sm overflow-hidden">
                            {[
                                { icon: HelpCircle, label: "Help & Support", color: "text-amber-500", bg: "bg-amber-50" },
                                { icon: FileText, label: "Privacy Policy", color: "text-blue-500", bg: "bg-blue-50" },
                                { icon: FileText, label: "Terms of Service", color: "text-purple-500", bg: "bg-purple-50" },
                            ].map((item, i, arr) => (
                                <Link
                                    key={i}
                                    href="#"
                                    className={cn(
                                        "p-6 flex items-center justify-between hover:bg-white/60 transition-colors",
                                        i !== arr.length - 1 && "border-b border-black/5"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bg, item.color)}>
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                        <span className="text-xs font-black text-emerald-950 uppercase tracking-widest">{item.label}</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-emerald-300" />
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full py-5 rounded-[2rem] bg-red-500/10 border border-red-100 text-red-600 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-100/50 active:scale-95"
                >
                    <LogOut className="h-4 w-4" />
                    Secure Logout
                </button>

                <p className="text-center text-xs text-gray-400 pt-4">
                    App Version 1.0.0 (Build 2026)
                </p>
            </div>
        </AuthGuard>
    );
}
