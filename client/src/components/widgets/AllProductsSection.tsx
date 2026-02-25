import { useInfiniteQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ui/ProductCard";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

export default function AllProductsSection() {
    const observerTarget = useRef(null);

    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ["all-products-infinite"],
        queryFn: ({ pageParam }) => getProducts(pageParam, 10),
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        initialPageParam: undefined,
    });

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    if (isLoading) {
        return (
            <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {[...Array(10)].map((_, i) => (
                        <Skeleton key={i} className="h-64 rounded-[2.25rem] bg-white/5" />
                    ))}
                </div>
            </div>
        );
    }

    const allProducts = data?.pages.flatMap(page => page.data) || [];

    if (allProducts.length === 0) return null;

    return (
        <div className="space-y-8">
            <div className="px-1">
                <h2 className="text-xl font-black text-emerald-950 tracking-tight uppercase tracking-widest leading-none mb-2">All Products 📦</h2>
                <p className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest">Freshly picked from our entire catalog</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allProducts.map((product: any, idx: number) => (
                    <div
                        key={`${product.id}-${idx}`}
                        className="animate-fade-in"
                        style={{ animationDelay: `${(idx % 10) * 30}ms` }}
                    >
                        <ProductCard
                            id={product.id}
                            name={product.name}
                            images={product.images}
                            basePrice={Number(product.basePrice)}
                            weightUnit={product.weightUnit}
                            inventory={product.inventory}
                            pricing={product.pricing}
                            variant="transparent"
                        />
                    </div>
                ))}
            </div>

            {/* Pagination / Loading State */}
            <div ref={observerTarget} className="flex flex-col items-center justify-center pt-8 pb-32">
                {isFetchingNextPage ? (
                    <div className="flex flex-col items-center gap-4 animate-bounce-slow">
                        <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                        <span className="text-[10px] font-black text-emerald-950/40 uppercase tracking-widest">Growing your list...</span>
                    </div>
                ) : hasNextPage ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/20 animate-pulse" />
                ) : (
                    <div className="text-center space-y-2">
                        <div className="text-2xl opacity-20">🍃</div>
                        <p className="text-[10px] font-black text-emerald-950/20 uppercase tracking-widest">That's everything for now</p>
                    </div>
                )}
            </div>
        </div>
    );
}
