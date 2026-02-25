"use client";

import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import FloatingCart from "@/components/ui/FloatingCart";
import { useCartStore } from "@/store/useCartStore";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { totalItems } = useCartStore();
    const pathname = usePathname();

    return (
        <>
            <Header />
            <main className={cn(
                "min-h-screen pt-20 px-0 bg-gradient-app transition-all duration-300",
                totalItems > 0 && !["/checkout", "/cart"].includes(pathname) ? "pb-52" : "pb-32",
                pathname === "/checkout" && "pb-0"
            )}>
                {children}
            </main>
            {!["/checkout", "/cart"].includes(pathname) && <FloatingCart />}
            {pathname !== "/checkout" && <BottomNav />}
        </>
    );
}
