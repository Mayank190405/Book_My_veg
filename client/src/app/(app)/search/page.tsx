"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { getCategories } from "@/services/categoryService";
import ProductListItem from "@/components/ui/ProductListItem";
import { Search, ArrowLeft, Clock, X, ShoppingCart, UserRound, ArrowUpRight } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import api from "@/services/api";

function SearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const query = searchParams.get("q") ?? "";
    const [inputValue, setInputValue] = useState(query);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(query);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [sort, setSort] = useState("relevance");
    const { user, _hasHydrated, recentSearches, clearRecentSearches, addRecentSearch, removeRecentSearch } = useUserStore();
    const totalItems = useCartStore(state => state.totalItems);
    useEffect(() => { setInputValue(query); setDebouncedSearchQuery(query); }, [query]);
    useEffect(() => { const timer = setTimeout(() => setDebouncedSearchQuery(inputValue), 300); return () => clearTimeout(timer); }, [inputValue]);
    const { data: allProducts, isLoading, isError, refetch } = useQuery({ queryKey: ["search-products"], queryFn: () => getProducts(undefined, 250), staleTime: 5 * 60 * 1000 });
    const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
    const { data: popularSearches = [] } = useQuery({ queryKey: ["popular-searches"], queryFn: async () => (await api.get<string[]>("/search/popular")).data, staleTime: 5 * 60 * 1000 });
    const handleSearch = (term: string) => { const text = term.trim(); if (text) addRecentSearch(text); router.push(text ? `/search?q=${encodeURIComponent(text)}` : "/search"); };
    const activeSearch = debouncedSearchQuery.trim().toLowerCase();
    const results = (allProducts?.data ?? []).filter((product: any) => (!selectedCategory || product.categoryId === selectedCategory) && (!activeSearch || product.name.toLowerCase().includes(activeSearch) || (product.description || "").toLowerCase().includes(activeSearch) || product.tags?.some((tag: string) => tag.toLowerCase().includes(activeSearch)))).sort((a: any, b: any) => sort === "price_asc" ? Number(a.basePrice) - Number(b.basePrice) : sort === "price_desc" ? Number(b.basePrice) - Number(a.basePrice) : a.name.localeCompare(b.name));
    const hasQuery = !!activeSearch || !!query;
    const signedIn = _hasHydrated && user && user.name !== "Guest" && user.role !== "GUEST";
    return (
        <div className="min-h-screen w-full bg-white pb-28 text-[#163c2c]">
            <header className="bg-[#006c45] px-4 pb-5 pt-3 text-white sm:px-6">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2"><button onClick={() => router.back()} aria-label="Go back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button><h1 className="text-xl font-bold text-white">{hasQuery ? "Search results" : "Search"}</h1></div>
                        <div className="flex gap-2"><Link href="/cart" aria-label={`Cart, ${totalItems} items`} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><ShoppingCart className="h-5 w-5" />{totalItems > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#c5ef75] px-1.5 text-xs font-bold text-[#05452d]">{totalItems}</span>}</Link><Link href={signedIn ? "/account" : "/login"} aria-label={signedIn ? "My account" : "Log in"} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10">{signedIn ? user.name?.charAt(0) : <UserRound className="h-5 w-5" />}</Link></div>
                    </div>
                    <form onSubmit={event => { event.preventDefault(); handleSearch(inputValue); }} className="flex min-h-12 items-center gap-2 rounded-full bg-white pl-4 pr-1 text-[#163c2c]">
                        <Search className="h-5 w-5 shrink-0 text-[#006c45]" aria-hidden="true" /><input aria-label="Search products" value={inputValue} onChange={event => setInputValue(event.target.value)} placeholder="Search vegetables, fruits and more" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-[#163c2c] outline-none placeholder:text-[#73827a]" />{inputValue && <button type="button" aria-label="Clear search" onClick={() => { setInputValue(""); router.push("/search"); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><X className="h-4 w-4" /></button>}<button type="submit" aria-label="Search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eaf6dc] text-[#006c45]"><ArrowUpRight className="h-5 w-5" /></button>
                    </form>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
                {!hasQuery ? <div className="max-w-3xl space-y-7">
                    {_hasHydrated && recentSearches.length > 0 && <section><div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-bold">Recent searches</h2><button onClick={clearRecentSearches} className="min-h-11 text-xs font-semibold text-[#006c45]">Clear all</button></div><div className="divide-y divide-[#e6eee8]">{recentSearches.slice(0, 5).map(term => <div key={term} className="flex items-center gap-3"><button onClick={() => { setInputValue(term); handleSearch(term); }} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left text-sm"><Clock className="h-4 w-4 shrink-0 text-[#73827a]" /><span className="truncate">{term}</span></button><button onClick={() => removeRecentSearch(term)} aria-label={`Remove ${term} from recent searches`} className="flex h-11 w-11 items-center justify-center text-[#73827a]"><X className="h-4 w-4" /></button></div>)}</div></section>}
                    {popularSearches.length > 0 && <section><h2 className="mb-4 text-lg font-bold">Popular searches</h2><div className="flex flex-wrap gap-2">{popularSearches.map(term => <button key={term} onClick={() => { setInputValue(term); handleSearch(term); }} className="flex min-h-11 items-center gap-2 rounded-full bg-[#eff7e8] px-4 text-sm font-medium text-[#006c45]"><Search className="h-3.5 w-3.5" />{term}</button>)}</div></section>}
                    <Link href="/categories" className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#eaf6dc] px-5 text-sm font-semibold text-[#006c45]">Browse all categories<ArrowUpRight className="h-4 w-4" /></Link>
                </div> : <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#63786b]">{isLoading ? "Searching products…" : `${results.length} results`} for <strong className="font-semibold text-[#006c45]">“{activeSearch || query}”</strong></p><div className="flex flex-wrap gap-2"><select aria-label="Filter by category" value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)} className="min-h-11 max-w-[165px] rounded-full border border-[#dfe9e1] bg-white px-3 text-xs"><option value="">All categories</option>{(Array.isArray(categories) ? categories : []).map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value)} className="min-h-11 rounded-full border border-[#dfe9e1] bg-white px-3 text-xs"><option value="relevance">Name: A to Z</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></div></div>
                    {isLoading ? <div role="status" className="space-y-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-[#f0f5ef]" />)}</div> : isError ? <div role="alert" className="rounded-2xl border border-[#dfe9e1] p-6"><h2 className="font-semibold">We couldn’t load the products</h2><button onClick={() => refetch()} className="mt-3 min-h-11 rounded-full bg-[#006c45] px-5 text-sm font-semibold text-white">Try again</button></div> : results.length ? <div className="grid gap-3 xl:grid-cols-2">{results.map((product: any) => <ProductListItem key={product.id} id={product.id} name={product.name} images={product.images} basePrice={Number(product.basePrice)} weight={Number(product.weight)} weightUnit={product.weightUnit} inventory={product.inventory} pricing={product.pricing} variants={product.variants} category={product.category} minQuantity={product.minQuantity} maxQuantity={product.maxQuantity} tags={product.tags} />)}</div> : <div className="rounded-2xl border border-[#dfe9e1] px-5 py-12 text-center"><h2 className="text-lg font-semibold">No products found</h2><p className="mt-2 text-sm text-[#63786b]">Try another search or choose a different category.</p><button onClick={() => { setSelectedCategory(""); setInputValue(""); router.push("/search"); }} className="mt-4 min-h-11 rounded-full bg-[#006c45] px-5 text-sm font-semibold text-white">Clear search</button></div>}
                </section>}
            </main>
        </div>
    );
}

export default function SearchPage() {
    return <Suspense fallback={<div role="status" className="min-h-screen bg-white"><div className="h-32 bg-[#006c45]" /><p className="p-6 text-sm text-[#63786b]">Loading search…</p></div>}><SearchContent /></Suspense>;
}
