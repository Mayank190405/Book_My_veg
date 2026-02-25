"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";

export default function AdminLink() {
    const { user } = useUserStore();

    if (user?.role !== "ADMIN") return null;

    return (
        <div className="fixed bottom-20 right-4 z-40">
            <Link href="/admin" className="bg-black text-white p-3 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
                <LayoutDashboard className="h-6 w-6" />
            </Link>
        </div>
    );
}
