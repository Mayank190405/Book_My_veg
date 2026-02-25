"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
    title: string;
    emoji?: string;
    subtitle?: string;
    href?: string;
    linkLabel?: string;
    className?: string;
}

export default function SectionHeader({
    title,
    emoji,
    subtitle,
    href,
    linkLabel = "See All",
    className,
}: SectionHeaderProps) {
    return (
        <div className={cn("flex items-center justify-between mb-6 px-1", className)}>
            <div className="relative">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-7 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                        {title}
                        {emoji && <span className="text-2xl animate-bounce-slow drop-shadow-lg">{emoji}</span>}
                    </h2>
                </div>
                {subtitle && <p className="text-xs text-white/40 mt-1 font-bold ml-4.5 uppercase tracking-widest leading-none">{subtitle}</p>}
            </div>
            {href && (
                <Link
                    href={href}
                    className="flex items-center gap-2 text-xs font-black text-green-400 hover:text-green-300 transition-all uppercase tracking-widest active:scale-95"
                >
                    {linkLabel}
                    <ChevronRight className="h-4 w-4" />
                </Link>
            )}
        </div>
    );
}
