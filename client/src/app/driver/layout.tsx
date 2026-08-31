"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Package, History as HistoryIcon, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    // Hide bottom navigation on auth and scanner pages
    const isLoginPage = pathname?.includes("/driver/login");
    const isScanPage = pathname?.includes("/driver/scan");
    const hideBottomNav = isLoginPage || isScanPage;

    return (
        <div className="min-h-screen bg-slate-50 flex justify-center text-slate-800 antialiased font-sans select-none">
            {/* Mobile App Container Frame */}
            <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative flex flex-col overflow-x-hidden">
                <main className={cn("flex-1 flex flex-col", !hideBottomNav && "pb-20")}>
                    {children}
                </main>

                {/* Bottom Navigation Bar */}
                {!hideBottomNav && (
                    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-6 py-2 flex items-center justify-between z-40 shadow-2xl">
                        <button
                            onClick={() => router.push("/driver")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all",
                                pathname === "/driver" ? "text-blue-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <Home className="h-5 w-5" />
                            <span className="text-[10px]">Home</span>
                        </button>

                        <button
                            onClick={() => router.push("/driver/orders")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all",
                                pathname?.startsWith("/driver/orders") ? "text-blue-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <Package className="h-5 w-5" />
                            <span className="text-[10px]">Orders</span>
                        </button>

                        <button
                            onClick={() => router.push("/driver/history")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all",
                                pathname === "/driver/history" ? "text-blue-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <HistoryIcon className="h-5 w-5" />
                            <span className="text-[10px]">History</span>
                        </button>

                        <button
                            onClick={() => router.push("/driver/more")}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all",
                                pathname === "/driver/more" ? "text-blue-600 font-bold" : "text-slate-400 font-medium hover:text-slate-600"
                            )}
                        >
                            <MoreHorizontal className="h-5 w-5" />
                            <span className="text-[10px]">More</span>
                        </button>
                    </nav>
                )}
            </div>
        </div>
    );
}
