"use client";

import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import FloatingCart from "@/components/ui/FloatingCart";
import WelcomeFlow from "@/components/features/WelcomeFlow";
import { useCartStore } from "@/store/useCartStore";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { getReverseGeocode } from "@/services/geocodingService";
import { toast } from "sonner";

import PagePreloader from "@/components/ui/PagePreloader";
import TopProgressBar from "@/components/ui/TopProgressBar";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { totalItems, syncWithBackend } = useCartStore();
    const pathname = usePathname();
    const router = useRouter();
    const { user, _hasHydrated, location, setLocation, setActiveStore, setServiceArea, serviceArea, nearbyStoreWithStock, setNearbyStoreWithStock } = useUserStore();

    useEffect(() => {
        if (_hasHydrated && user) {
            syncWithBackend().catch(err => console.error("Error syncing cart on mount:", err));
        }
    }, [_hasHydrated, user, syncWithBackend]);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    useEffect(() => {
        if (_hasHydrated) {
            if (user?.role === "DELIVERY_PARTNER") {
                router.push("/driver");
            } else if (user?.role === "PACKING") {
                router.push("/packer");
            }
        }
    }, [user, _hasHydrated, router]);

    useEffect(() => {
        if (_hasHydrated && !location) {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        try {
                            // 1. Resolve localized address context
                            const geoResult = await getReverseGeocode(latitude, longitude);

                            // 2. Fetch all stores
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname !== "localhost" ? `${window.location.origin}/api/v1` : 'http://localhost:5000/api/v1');
                            const storesRes = await (await fetch(`${apiUrl}/locations`)).json();

                            // 3. Filter stores to only those whose deliveryRadius covers the customer
                            const eligible = (storesRes || [])
                                .filter((s: any) => s.latitude && s.longitude)
                                .map((s: any) => ({
                                    ...s,
                                    dist: calculateDistance(latitude, longitude, s.latitude, s.longitude)
                                }))
                                .filter((s: any) => !s.deliveryRadius || s.dist <= s.deliveryRadius)
                                .sort((a: any, b: any) => a.dist - b.dist);

                            if (eligible.length === 0) {
                                // Customer is outside ALL store delivery radii
                                setServiceArea('out-of-range');
                                setActiveStore(null);
                                toast.error("We don't deliver to your area yet.");
                            } else {
                                // 4. Always pick nearest eligible store as active
                                const nearest = eligible[0];
                                setActiveStore({ id: nearest.id, slug: nearest.slug, name: nearest.name });
                                setServiceArea('in-range');

                                // 5. Check if nearest store has stock
                                try {
                                    const stockRes = await fetch(`${apiUrl}/products?locationId=${nearest.id}&limit=5`);
                                    const stockData = await stockRes.json();
                                    const nearestHasStock = stockData.data?.some(
                                        (p: any) => p.inventory?.some((inv: any) => Number(inv.currentStock) > 0)
                                    );

                                    if (!nearestHasStock && eligible.length > 1) {
                                        // 6. Search remaining eligible stores for one with stock
                                        setNearbyStoreWithStock(null);
                                        for (const store of eligible.slice(1)) {
                                            const res = await fetch(`${apiUrl}/products?locationId=${store.id}&limit=5`);
                                            const data = await res.json();
                                            const hasStock = data.data?.some(
                                                (p: any) => p.inventory?.some((inv: any) => Number(inv.currentStock) > 0)
                                            );
                                            if (hasStock) {
                                                setNearbyStoreWithStock({ id: store.id, slug: store.slug, name: store.name });
                                                break;
                                            }
                                        }
                                    } else {
                                        setNearbyStoreWithStock(null);
                                    }
                                } catch {
                                    // Stock check failed silently — don't block store selection
                                }

                                toast.success(`Delivering via ${nearest.name}!`);
                            }

                            if (geoResult) {
                                const context = (geoResult as any).context || [];
                                const serverArea = context.find((c: any) => c.id === "area")?.text;
                                const serverPincode = context.find((c: any) => c.id === "pincode")?.text;

                                const parts = geoResult.place_name.split(",");
                                const area = serverArea || parts[0].trim();
                                const pincodeMatch = geoResult.place_name.match(/\b\d{6}\b/);
                                const foundPincode = serverPincode || (pincodeMatch ? pincodeMatch[0] : "");

                                setLocation({
                                    address: area,
                                    pincode: foundPincode,
                                    coords: { lat: latitude, lng: longitude },
                                });
                            } else {
                                setLocation({
                                    address: "Detected Location",
                                    pincode: "",
                                    coords: { lat: latitude, lng: longitude },
                                });
                            }
                        } catch (error) {
                            console.error("Auto location detection failed:", error);
                        }
                    },
                    (error) => {
                        console.log("Geolocation prompt dismissed or blocked:", error);
                    }
                );
            }
        }
    }, [_hasHydrated, setLocation, setActiveStore, setServiceArea, setNearbyStoreWithStock]);


    const isChat = pathname === "/chat";
    const isHeaderExcluded = ["/checkout", "/cart", "/account", "/account/addresses", "/categories", "/returns", "/contact"].includes(pathname) || 
        pathname.startsWith("/orders/") || 
        pathname.startsWith("/category/") || 
        pathname.startsWith("/products/") || 
        pathname.startsWith("/search");
    const isExcludedFromCartAndNav = ["/checkout", "/cart", "/account", "/account/addresses", "/returns", "/contact"].includes(pathname) || 
        pathname.startsWith("/orders/");

    return (
        <>
            <PagePreloader />
            <TopProgressBar />
            {/* Out-of-range service area banner */}
            {serviceArea === 'out-of-range' && (
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-rose-50 border-b border-rose-200 px-4 py-3 flex items-center justify-center gap-2 text-rose-800 text-sm font-medium">
                    <span>📍</span>
                    <span>We don&apos;t deliver to your area yet. Check back soon!</span>
                </div>
            )}
            {/* Nearby stock switch banner */}
            {nearbyStoreWithStock && serviceArea === 'in-range' && (
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                        <span>📦</span>
                        <span>Stock available at <strong>{nearbyStoreWithStock.name}</strong></span>
                    </div>
                    <button
                        onClick={() => {
                            setActiveStore(nearbyStoreWithStock);
                            setNearbyStoreWithStock(null);
                            toast.success(`Switched to ${nearbyStoreWithStock.name}`);
                        }}
                        className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-full shrink-0 active:scale-95 transition-all"
                    >
                        Switch →
                    </button>
                </div>
            )}
            {!isChat && !isHeaderExcluded && <Header />}
            <WelcomeFlow />
            <main 
                id="main-scroll-container"
                className={cn(
                    "flex-1 overflow-y-auto scrollbar-hide bg-gradient-app transition-all duration-300 overscroll-contain",
                    isChat
                        ? "pt-0 pb-0"
                        : isHeaderExcluded 
                            ? "pt-0" 
                            : pathname === "/" 
                                ? "pt-[11.2rem]" 
                                : pathname === "/orders"
                                    ? "pt-[5.5rem]"
                                    : "pt-[8rem]",
                    !isChat && totalItems > 0 && !isHeaderExcluded ? "pb-60" : !isChat ? "pb-32" : "",
                    !isChat && isHeaderExcluded && "pb-0"
                )}
            >
                <div key={pathname} className="animate-page-transition w-full min-h-full flex flex-col">
                    {children}
                </div>
            </main>
            {!isChat && !isExcludedFromCartAndNav && <FloatingCart />}
            {!isChat && !isExcludedFromCartAndNav && <BottomNav />}
            {/* Gradient fade overlay — hides content peeking behind the floating nav */}
            {!isChat && !isExcludedFromCartAndNav && (
                <div className="fixed bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/80 to-transparent pointer-events-none z-40" />
            )}
        </>
    );
}
