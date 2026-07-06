"use client";

import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useEffect } from "react";
import { Toaster } from "sonner";

export default function POSLayout({ children }: { children: React.ReactNode }) {
    const { user, _hasHydrated } = useUserStore();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (_hasHydrated) {
            if (!user) {
                router.push(`/login?redirect=${pathname}`);
            } else if (!["ADMIN", "STORE_ADMIN", "POS_OPERATOR"].includes(user.role)) {
                router.push("/");
            }
        }
    }, [user, _hasHydrated, pathname, router]);

    if (!_hasHydrated || !user) {
        return (
            <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-white/20 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
            {children}
            <Toaster richColors position="top-right" theme="light" />
        </>
    );
}
