"use client";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Leaf } from "lucide-react";

export default function EditorialCategoryGrid() {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["categories"], queryFn: getCategories, staleTime: 5 * 60 * 1000 });
    const categories = Array.isArray(data) ? data : data?.data || [];
    return (
        <section className="px-4 sm:px-6" aria-label="Shop by category">
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#17251e] sm:text-2xl">Shop by category</h2><Link href="/categories" className="flex min-h-11 items-center text-xs font-semibold text-[#087f5b] sm:text-sm">See all</Link></div>
            {isLoading ? <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8" aria-label="Loading categories">{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-2xl bg-[#e8f0eb] motion-reduce:animate-none" />)}</div> : isError ? <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-[#e5ebe7] bg-white p-4 text-sm"><p>We couldn’t load categories.</p><button onClick={() => refetch()} className="min-h-11 px-3 font-semibold text-[#087f5b]">Try again</button></div> : categories.length ? <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">{categories.slice(0, 8).map((category: { id: string; name: string; imageUrl?: string }) => <Link key={category.id} href={`/category/${category.id}`} className="group flex min-w-0 flex-col items-center gap-2 text-center"><div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#edf6ef]">{category.imageUrl ? <Image src={category.imageUrl} alt="" fill sizes="(max-width: 640px) 22vw, 140px" className="object-contain p-2 transition-transform group-hover:scale-105 motion-reduce:transform-none" /> : <div className="flex h-full items-center justify-center text-[#087f5b]"><Leaf className="h-7 w-7" /></div>}</div><span className="line-clamp-2 text-[11px] font-medium leading-4 text-[#17251e] sm:text-sm">{category.name}</span></Link>)}</div> : <p className="text-sm text-[#64736b]">Categories will appear here when available.</p>}
        </section>
    );
}
