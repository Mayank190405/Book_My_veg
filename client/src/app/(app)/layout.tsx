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
import { getBaseURL } from "@/services/api";

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
    const { user, _hasHydrated, location, setLocation, activeStore, setActiveStore, setServiceArea, serviceArea, nearbyStoreWithStock, setNearbyStoreWithStock } = useUserStore();

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
        if (!_hasHydrated) return;

        const initializeStoreAndLocation = async () => {
            try {
                const apiUrl = getBaseURL();
                // 1. Fetch available store locations
                const storesRes = await (await fetch(`${apiUrl}/locations`)).json();
                if (!storesRes || storesRes.length === 0) return;

                const defaultStore = storesRes[0];

                const selectStore = (store: any, lat: number, lng: number, address: string, pincode: string) => {
                    setActiveStore({ id: store.id, slug: store.slug, name: store.name });
                    setServiceArea('in-range');
                    setLocation({
                        address: address || store.name,
                        pincode: pincode || store.pincode || "422002",
                        coords: { lat, lng }
                    });
                };

                // Case A: If location coordinates exist but activeStore is missing, find closest store from existing coords
                if (location && location.coords && !activeStore) {
                    const { lat, lng } = location.coords;
                    const eligible = (storesRes || [])
                        .filter((s: any) => s.latitude && s.longitude)
                        .map((s: any) => ({
                            ...s,
                            dist: calculateDistance(lat, lng, Number(s.latitude), Number(s.longitude))
                        }))
                        .filter((s: any) => !s.deliveryRadius || s.dist <= s.deliveryRadius)
                        .sort((a: any, b: any) => a.dist - b.dist);

                    if (eligible.length > 0) {
                        selectStore(eligible[0], lat, lng, location.address, location.pincode);
                    } else {
                        selectStore(defaultStore, Number(defaultStore.latitude) || 19.9922, Number(defaultStore.longitude) || 73.7753, location.address, location.pincode);
                    }
                    return;
                }

                // Case B: No activeStore and no location, or force auto connect on first visit
                if (!activeStore || !location) {
                    // Instantly fall back to default store so page content renders immediately
                    selectStore(defaultStore, Number(defaultStore.latitude) || 19.9922, Number(defaultStore.longitude) || 73.7753, defaultStore.name, defaultStore.pincode);

                    // Then silently request precise GPS to refine if allowed
                    if ("geolocation" in navigator) {
                        navigator.geolocation.getCurrentPosition(
                            async (position) => {
                                const { latitude, longitude } = position.coords;
                                try {
                                    const geoResult = await getReverseGeocode(latitude, longitude);
                                    const eligible = (storesRes || [])
                                        .filter((s: any) => s.latitude && s.longitude)
                                        .map((s: any) => ({
                                            ...s,
                                            dist: calculateDistance(latitude, longitude, Number(s.latitude), Number(s.longitude))
                                        }))
                                        .filter((s: any) => !s.deliveryRadius || s.dist <= s.deliveryRadius)
                                        .sort((a: any, b: any) => a.dist - b.dist);

                                    if (eligible.length > 0) {
                                        const nearest = eligible[0];
                                        let area = nearest.name;
                                        let pin = nearest.pincode || "422002";
                                        if (geoResult) {
                                            const context = (geoResult as any).context || [];
                                            const serverArea = context.find((c: any) => c.id === "area")?.text;
                                            const serverPincode = context.find((c: any) => c.id === "pincode")?.text;
                                            const parts = geoResult.place_name.split(",");
                                            area = serverArea || parts[0].trim();
                                            pin = serverPincode || (geoResult.place_name.match(/\b\d{6}\b/)?.[0] || "");
                                        }
                                        selectStore(nearest, latitude, longitude, area, pin);
                                        toast.success(`Delivering via ${nearest.name}`);
                                    }
                                } catch (err) {
                                    console.error("Auto-geolocation refinement failed:", err);
                                }
                            },
                            (error) => {
                                console.log("Geolocation prompt dismissed, using default Nashik store:", error);
                            },
                            { timeout: 5000 }
                        );
                    }
                }
            } catch (err) {
                console.error("Auto connect store error:", err);
            }
        };

        initializeStoreAndLocation();
    }, [_hasHydrated, location, activeStore]);

    // Browser session-based scroll restoration for the custom main scroll container
    useEffect(() => {
        const container = document.getElementById("main-scroll-container");
        if (!container) return;

        const savedPos = sessionStorage.getItem(`scroll-pos-${pathname}`);
        if (savedPos) {
            const targetPos = parseInt(savedPos, 10);
            const timer1 = setTimeout(() => {
                container.scrollTop = targetPos;
            }, 80);
            const timer2 = setTimeout(() => {
                container.scrollTop = targetPos;
            }, 300);

            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        } else {
            container.scrollTop = 0;
        }
    }, [pathname]);

    useEffect(() => {
        const container = document.getElementById("main-scroll-container");
        if (!container) return;

        const handleScroll = () => {
            sessionStorage.setItem(`scroll-pos-${pathname}`, container.scrollTop.toString());
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, [pathname]);


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
                className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide bg-gradient-app transition-all duration-300 overscroll-contain"
            >
                <div 
                    key={pathname} 
                    className={cn(
                        "animate-page-transition w-full min-h-full flex flex-col",
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
