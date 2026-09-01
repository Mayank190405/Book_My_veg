"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Package, History as HistoryIcon, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

export default function PackerLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { token, user, _hasHydrated } = useUserStore();

    const isLoginPage = pathname?.includes("/packer/login");
    const isScanPage = pathname?.includes("/packer/scan");
    const hideBottomNav = isLoginPage || isScanPage;

    const isAllowedRole = user?.role === "PACKING" || user?.role === "ADMIN" || user?.role === "STORE_ADMIN" || user?.role === "MANAGER";

    useEffect(() => {
        if (!_hasHydrated) return;

        if ((!token || !user || !isAllowedRole) && !isLoginPage) {
            router.replace("/packer/login");
        } else if (token && user && isAllowedRole && isLoginPage) {
            router.replace("/packer");
        }
    }, [_hasHydrated, token, user, isLoginPage, isAllowedRole, router]);

    if (!_hasHydrated) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if ((!token || !user || !isAllowedRole) && !isLoginPage) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (isLoginPage) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col">
                <main className="flex-1 flex flex-col">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex justify-center text-slate-800 antialiased font-sans select-none sm:py-4">
            {/* Mobile / Handheld Scanner Container Frame */}
            <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[92vh] sm:rounded-3xl shadow-2xl relative flex flex-col overflow-x-hidden border border-slate-200/60">
                <main className={cn("flex-1 flex flex-col", !hideBottomNav && "pb-20")}>
                    {children}
                </main>

                {/* Bottom Navigation Bar */}
                {!hideBottomNav && (
                    <nav className="fixed sm:absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-2 flex items-center justify-between z-40 shadow-2xl sm:rounded-b-3xl">
                        <button
                            onClick={() => router.push("/packer")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all",
                                pathname === "/packer" ? "text-purple-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <Home className="h-5 w-5" />
                            <span className="text-[10px]">Dashboard</span>
                        </button>

                        <button
                            onClick={() => router.push("/packer/orders")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all",
                                pathname?.startsWith("/packer/orders") ? "text-purple-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <Package className="h-5 w-5" />
                            <span className="text-[10px]">My Orders</span>
                        </button>

                        <button
                            onClick={() => router.push("/packer/history")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all",
                                pathname === "/packer/history" ? "text-purple-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <HistoryIcon className="h-5 w-5" />
                            <span className="text-[10px]">History</span>
                        </button>

                        <button
                            onClick={() => router.push("/packer/profile")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all",
                                pathname === "/packer/profile" ? "text-purple-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <User className="h-5 w-5" />
                            <span className="text-[10px]">Profile</span>
                        </button>
                    </nav>
                )}
            </div>
        </div>
    );
}
