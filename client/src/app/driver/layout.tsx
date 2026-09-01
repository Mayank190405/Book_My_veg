"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, ClipboardList, History as HistoryIcon, SlidersHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { token, user, _hasHydrated } = useUserStore();

    // Hide bottom navigation on auth, scanner, and order action sub-pages
    const isLoginPage = pathname?.includes("/driver/login");
    const isScanPage = pathname?.includes("/driver/scan");
    const isOrderSubPage = Boolean(pathname?.match(/\/driver\/orders\/[^\/]+/)) || pathname?.includes("/driver/order-added");
    const hideBottomNav = isLoginPage || isScanPage || isOrderSubPage;

    const isAllowedRole = user?.role === "DELIVERY_PARTNER" || user?.role === "ADMIN" || user?.role === "STORE_ADMIN" || user?.role === "MANAGER";

    useEffect(() => {
        if (!_hasHydrated) return;

        if ((!token || !user || !isAllowedRole) && !isLoginPage) {
            router.replace("/driver/login");
        } else if (token && user && isAllowedRole && isLoginPage) {
            router.replace("/driver");
        }
    }, [_hasHydrated, token, user, isLoginPage, isAllowedRole, router]);

    if (!_hasHydrated) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if ((!token || !user || !isAllowedRole) && !isLoginPage) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (isLoginPage) {
        return (
            <div className="min-h-screen w-full bg-slate-50 text-slate-800 antialiased font-sans flex flex-col items-center justify-center">
                <main className="w-full flex-1 flex flex-col items-center justify-center">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100/80 flex justify-center text-slate-800 antialiased font-sans select-none sm:py-6 md:py-8 sm:px-4">
            {/* Mobile / Tablet / Desktop Responsive Container Frame */}
            <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl bg-slate-50 min-h-screen sm:min-h-[88vh] sm:rounded-3xl shadow-xl shadow-slate-200/60 relative flex flex-col overflow-x-hidden border border-slate-200/60 transition-all duration-300">
                <main className={cn("flex-1 flex flex-col", !hideBottomNav && "pb-22")}>
                    {children}
                </main>

                {/* Bottom Navigation Bar */}
                {!hideBottomNav && (
                    <nav className="fixed sm:absolute bottom-0 left-0 right-0 max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 sm:px-10 py-2.5 sm:py-3 flex items-center justify-between z-40 shadow-2xl sm:rounded-b-3xl">
                        <button
                            onClick={() => router.push("/driver")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-2xl transition-all",
                                pathname === "/driver" ? "text-blue-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <Home className="h-5 w-5 stroke-[2.2]" />
                            <span className="text-[10px] sm:text-xs font-bold">Home</span>
                        </button>

                        <button
                            onClick={() => router.push("/driver/orders")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-2xl transition-all",
                                pathname?.startsWith("/driver/orders") ? "text-blue-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <ClipboardList className="h-5 w-5 stroke-[2.2]" />
                            <span className="text-[10px] sm:text-xs font-bold">Orders</span>
                        </button>

                        <button
                            onClick={() => router.push("/driver/history")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-2xl transition-all",
                                pathname === "/driver/history" ? "text-blue-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <HistoryIcon className="h-5 w-5 stroke-[2.2]" />
                            <span className="text-[10px] sm:text-xs font-bold">History</span>
                        </button>

                        <button
                            onClick={() => router.push("/driver/more")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-2xl transition-all",
                                pathname === "/driver/more" ? "text-blue-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <SlidersHorizontal className="h-5 w-5 stroke-[2.2]" />
                            <span className="text-[10px] sm:text-xs font-bold">More</span>
                        </button>
                    </nav>
                )}
            </div>
        </div>
    );
}
