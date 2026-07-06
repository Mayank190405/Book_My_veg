"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useUserStore } from "@/store/useUserStore";
import { LogOut, Package, ClipboardCheck, LayoutDashboard } from "lucide-react";
import { logout } from "@/services/authService";
import { cn } from "@/lib/utils";
import GlobalNotificationListener from "@/components/features/GlobalNotificationListener";

export default function PackerLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, _hasHydrated } = useUserStore();

    useEffect(() => {
        if (_hasHydrated) {
            // Allow specialized login page access
            if (pathname.endsWith("/login")) return;

            if (!user) {
                router.push(`/packer/login?redirect=${pathname}`);
            } else if (user.role !== "PACKING") {
                router.push("/");
            }
        }
    }, [user, _hasHydrated, pathname, router]);

    const handleLogout = async () => {
        if (confirm("Are you sure you want to log out?")) {
            await logout();
            router.push("/login");
        }
    };

    const isLoginPage = pathname.endsWith("/login");

    if (!_hasHydrated || (!isLoginPage && (!user || user.role !== "PACKING"))) {
        return (
            <div className="h-screen w-full bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
            <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
                {/* Mobile-first Header */}
                <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between px-4 h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">Packer Portal</h1>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">BMV Logistics</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                <main className="p-4 max-w-lg mx-auto">
                    {children}
                </main>

                <Toaster richColors position="top-center" theme="light" />
                <GlobalNotificationListener />
            </div>
        </ThemeProvider>
    );
}
