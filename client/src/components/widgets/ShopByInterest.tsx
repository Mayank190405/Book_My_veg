"use client";

import Link from "next/link";
import { Leaf, Droplets, FlaskConical, Star } from "lucide-react";

const INTERESTS = [
    { label: "Farm Fresh", icon: Leaf, color: "bg-emerald-500", text: "text-emerald-600", href: "/category/fresh" },
    { label: "Healthy Fats", icon: Droplets, color: "bg-amber-500", text: "text-amber-600", href: "/category/oils" },
    { label: "Liquid Health", icon: FlaskConical, color: "bg-blue-500", text: "text-blue-600", href: "/category/juices" },
    { label: "Exotic Selection", icon: Star, color: "bg-purple-500", text: "text-purple-600", href: "/category/exotic" },
];

export default function ShopByInterest() {
    return (
        <div className="space-y-4">
            <div className="px-1 flex items-center justify-between">
                <h2 className="text-xl font-black text-white-950 tracking-tight uppercase tracking-widest">Shop By Interest</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {INTERESTS.map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        className="group relative overflow-hidden bg-white/60 backdrop-blur-xl border border-black/5 rounded-3xl p-4 flex items-center gap-4 transition-all hover:shadow-lg active:scale-[0.98]"
                    >
                        <div className={`${item.color} bg-opacity-10 p-3 rounded-2xl transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                            <item.icon className={`h-6 w-6 ${item.text}`} />
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-sm font-black tracking-tight leading-none mb-1 ${item.text}`}>{item.label}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-widest opacity-40 ${item.text}`}>Explore</span>
                        </div>

                        {/* Decorative element */}
                        <div className={`absolute top-0 right-0 w-16 h-16 ${item.color} opacity-[0.03] rounded-bl-[4rem] transition-all group-hover:scale-150`} />
                    </Link>
                ))}
            </div>
        </div>
    );
}
