"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Banknote, CreditCard, User, Settings, HelpCircle, LogOut, ChevronRight 
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { logout } from "@/services/authService";

export default function MoreMenuPage() {
    const router = useRouter();
    const { user } = useUserStore();

    const [orders, setOrders] = useState<any[]>([]);

    useEffect(() => {
        api.get("/orders/driver/assigned")
            .then(res => {
                const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                setOrders(list);
            })
            .catch(() => setOrders([]));
    }, []);

    const { cashCollected, cashSubmitted } = useMemo(() => {
        let collected = 0;
        orders.forEach(o => {
            collected += Number(o.cashCollected || 0);
        });
        const submitted = 0;
        return { cashCollected: collected, cashSubmitted: submitted };
    }, [orders]);

    const handleLogout = async () => {
        await logout();
        router.push("/driver/login");
    };

    return (
        <div className="p-5 space-y-5 animate-in fade-in duration-300">
            <div className="pt-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Account & Settings</h2>
            </div>

            {/* Driver Profile Card (Screen 14) */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-200">
                    {user?.name?.charAt(0) || "D"}
                </div>
                <div className="space-y-0.5">
                    <h3 className="text-base font-black text-slate-900">{user?.name || "Delivery Partner"}</h3>
                    <p className="text-xs font-bold text-slate-400">{user?.phone || ""}</p>
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-black rounded-full uppercase tracking-wider">
                        Delivery Partner
                    </span>
                </div>
            </div>

            {/* Menu Items (Screen 14) */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
                <button 
                    onClick={() => router.push("/driver/history")}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Banknote className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Cash Collected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-600">₹ {cashCollected.toLocaleString()}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                </button>

                <button 
                    onClick={() => toast.info("Cash submitted statement")}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CreditCard className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Cash Submitted</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-blue-600">₹ {cashSubmitted.toLocaleString()}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                </button>

                <button 
                    onClick={() => toast.info("Driver profile details")}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                            <User className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Account</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>

                <button 
                    onClick={() => toast.info("Driver app settings")}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                            <Settings className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Settings</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>

                <button 
                    onClick={() => toast.info("Support Desk: +91 9876543210")}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                            <HelpCircle className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Help & Support</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>

                <button 
                    onClick={handleLogout}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-rose-50 text-rose-600 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                            <LogOut className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold">Logout</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-rose-300" />
                </button>
            </div>
        </div>
    );
}
