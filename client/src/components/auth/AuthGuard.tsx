"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, _hasHydrated } = useUserStore();
    const router = useRouter();

    useEffect(() => {
        if (_hasHydrated && !user) {
            router.push("/login?redirect=" + window.location.pathname);
        }
    }, [user, _hasHydrated, router]);

    if (!_hasHydrated || !user) {
        return <Skeleton className="w-full h-screen" />;
    }

    return <>{children}</>;
}
