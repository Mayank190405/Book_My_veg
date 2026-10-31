"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/categoryService";
import { Skeleton } from "@/components/ui/skeleton";
import SearchBar from "@/components/features/SearchBar";
import { LayoutGrid, ArrowRight } from "lucide-react";

export default function CategoriesPage() {
    const { data: categories, isLoading, isError, refetch } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-[#087f5b]">Everyday essentials</p>
                    <h1 className="text-2xl font-bold tracking-tight text-[#17251e] lg:text-3xl">Shop by category</h1>
                    <p className="mt-2 text-sm text-[#64736b]">Find what you need for your next meal.</p>
                </div>
                <div className="w-full sm:max-w-sm"><SearchBar /></div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className="rounded-2xl border border-[#e5ebe7] bg-white p-3">
                            <Skeleton className="aspect-square w-full rounded-xl bg-[#f0f5f1]" />
                            <Skeleton className="mx-auto mt-3 h-4 w-20 bg-[#f0f5f1]" />
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div role="alert" className="rounded-2xl border border-[#e5ebe7] bg-white px-5 py-12 text-center">
                    <h2 className="text-lg font-semibold">We couldn’t load the categories</h2>
                    <p className="mt-2 text-sm text-[#64736b]">Please try again in a moment.</p>
                    <button onClick={() => refetch()} className="mt-5 min-h-11 rounded-lg bg-[#087f5b] px-5 text-sm font-semibold text-white">Try again</button>
                </div>
            ) : !categories?.length ? (
                <div className="rounded-2xl border border-[#e5ebe7] bg-white px-5 py-16 text-center">
                    <LayoutGrid aria-hidden="true" className="mx-auto mb-4 h-9 w-9 text-[#64736b]" />
                    <h2 className="text-lg font-semibold">Categories are on their way</h2>
                    <p className="mt-2 text-sm text-[#64736b]">Check back soon to browse the shop.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-6">
                    {categories.map((cat: any) => (
                        <Link key={cat.id} href={`/category/${cat.id}`} className="group flex min-w-0 flex-col rounded-2xl border border-[#e5ebe7] bg-white p-2.5 transition-colors hover:border-[#087f5b] sm:p-4">
                            <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-[#f4f8f3]">
                                {cat.imageUrl ? <Image src={cat.imageUrl} alt="" fill className="object-contain p-2 transition-transform motion-safe:group-hover:scale-105" sizes="(max-width: 600px) 30vw, (max-width: 1024px) 22vw, 180px" /> : <LayoutGrid aria-hidden="true" className="absolute inset-0 m-auto h-10 w-10 text-[#64736b]" />}
                            </div>
                            <span className="flex min-h-10 items-center justify-center text-center text-xs font-semibold leading-snug text-[#17251e] sm:text-sm">{cat.name}</span>
                        </Link>
                    ))}
                </div>
            )}

            <Link href="/search" className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-[#e8f7ef] p-5 text-[#056647]">
                <div><h2 className="text-base font-semibold">Looking for something specific?</h2><p className="mt-1 text-sm">Search products across the shop.</p></div>
                <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" />
            </Link>
        </div>
    );
}
