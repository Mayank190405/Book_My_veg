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

import ShareModal from "@/components/ui/ShareModal";

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

    // Synchronize user location and connect to the nearest store on every reload, refresh, and every 1 hour
    useEffect(() => {
        if (!_hasHydrated) return;

        let isMounted = true;
        const ONE_HOUR_MS = 60 * 60 * 1000;

        const syncLocationAndStore = async (isInitialOrRefresh: boolean = false) => {
            try {
                const apiUrl = getBaseURL();
                const storesRes = await (await fetch(`${apiUrl}/locations`)).json();
                if (!isMounted || !storesRes || storesRes.length === 0) return;

                const defaultStore = storesRes[0];

                const applyStoreConnection = (
                    store: any,
                    lat: number,
                    lng: number,
                    address: string,
                    pincode: string,
                    secondary?: string,
                    distKm?: number
                ) => {
                    if (!isMounted) return;
                    const currentStore = useUserStore.getState().activeStore;
                    const dist = distKm ?? calculateDistance(lat, lng, Number(store.latitude), Number(store.longitude));
                    const inRange = !store.deliveryRadius || dist <= store.deliveryRadius;

                    setActiveStore({ id: store.id, slug: store.slug, name: store.name });
                    setServiceArea(inRange ? 'in-range' : 'out-of-range');
                    setLocation({
                        address: address || store.name,
                        pincode: pincode || store.pincode || "422002",
                        coords: { lat, lng },
                        secondary: secondary || `${address || store.name}, Nashik`
                    });

                    try {
                        localStorage.setItem("bmv_last_location_sync", Date.now().toString());
                    } catch {}

                    if (currentStore && currentStore.id !== store.id) {
                        toast.success(`Connected to nearest store: ${store.name} ⚡`);
                    }
                };

                const findNearestStore = (lat: number, lng: number) => {
                    const eligible = (storesRes || [])
                        .filter((s: any) => s.latitude && s.longitude)
                        .map((s: any) => ({
                            ...s,
                            dist: calculateDistance(lat, lng, Number(s.latitude), Number(s.longitude))
                        }))
                        .sort((a: any, b: any) => a.dist - b.dist);

                    return eligible.length > 0 ? eligible[0] : { ...defaultStore, dist: 0 };
                };

                // Attempt device GPS geolocation on every reload, refresh, or 1h tick
                if (typeof navigator !== "undefined" && "geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            if (!isMounted) return;
                            const { latitude, longitude } = position.coords;
                            try {
                                const geoResult = await getReverseGeocode(latitude, longitude);
                                const nearest = findNearestStore(latitude, longitude);

                                let area = nearest.name;
                                let pin = nearest.pincode || "422002";
                                let secondary = "";

                                if (geoResult) {
                                    const context = (geoResult as any).context || [];
                                    const serverArea = context.find((c: any) => c.id === "area")?.text;
                                    const serverPincode = context.find((c: any) => c.id === "pincode")?.text;
                                    const parts = geoResult.place_name?.split(",") || [];
                                    area = serverArea || parts[0]?.trim() || nearest.name;
                                    pin = serverPincode || (geoResult.place_name?.match(/\b\d{6}\b/)?.[0] || nearest.pincode || "422002");
                                    secondary = geoResult.place_name || "";
                                }

                                applyStoreConnection(nearest, latitude, longitude, area, pin, secondary, nearest.dist);
                            } catch (geoErr) {
                                console.warn("[LocationSync] Reverse geocoding failed, connecting with coordinates:", geoErr);
                                const nearest = findNearestStore(latitude, longitude);
                                applyStoreConnection(nearest, latitude, longitude, nearest.name, nearest.pincode, undefined, nearest.dist);
                            }
                        },
                        (posError) => {
                            if (!isMounted) return;
                            console.log("[LocationSync] Geolocation unavailable or permission pending, connecting nearest store to known/default coords:", posError.message);
                            // Fallback to known location coords or default store coords
                            const currLocation = useUserStore.getState().location;
                            if (currLocation?.coords?.lat && currLocation?.coords?.lng) {
                                const { lat, lng } = currLocation.coords;
                                const nearest = findNearestStore(lat, lng);
                                applyStoreConnection(nearest, lat, lng, currLocation.address, currLocation.pincode, currLocation.secondary, nearest.dist);
                            } else {
                                const defLat = Number(defaultStore.latitude) || 19.9922;
                                const defLng = Number(defaultStore.longitude) || 73.7753;
                                applyStoreConnection(defaultStore, defLat, defLng, defaultStore.name, defaultStore.pincode || "422002", undefined, 0);
                            }
                        },
                        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                    );
                } else {
                    // Browser does not support geolocation
                    const currLocation = useUserStore.getState().location;
                    const lat = currLocation?.coords?.lat || Number(defaultStore.latitude) || 19.9922;
                    const lng = currLocation?.coords?.lng || Number(defaultStore.longitude) || 73.7753;
                    const nearest = findNearestStore(lat, lng);
                    applyStoreConnection(nearest, lat, lng, currLocation?.address || nearest.name, currLocation?.pincode || nearest.pincode, currLocation?.secondary, nearest.dist);
                }
            } catch (err) {
                console.error("[LocationSync] Location & nearest store sync error:", err);
            }
        };

        // 1. Run immediately on every page reload / refresh mount
        syncLocationAndStore(true);

        // 2. Run every 1 hour (3600000 ms)
        const intervalId = setInterval(() => {
            console.log("[LocationSync] 1-hour interval triggered. Synchronizing location & connecting to nearest store...");
            syncLocationAndStore(false);
        }, ONE_HOUR_MS);

        // 3. Check when user returns to the tab/window after 1 hour or more
        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === "visible") {
                try {
                    const lastSyncStr = localStorage.getItem("bmv_last_location_sync");
                    const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
                    if (Date.now() - lastSync >= ONE_HOUR_MS) {
                        console.log("[LocationSync] Tab resumed after >= 1 hour. Synchronizing location & nearest store...");
                        syncLocationAndStore(false);
                    }
                } catch {}
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityOrFocus);
        window.addEventListener("focus", handleVisibilityOrFocus);
        window.addEventListener("online", () => syncLocationAndStore(false));

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
            window.removeEventListener("focus", handleVisibilityOrFocus);
        };
    }, [_hasHydrated]);

    // Browser session-based scroll restoration for the custom main scroll container
    useEffect(() => {
        const container = document.getElementById("main-scroll-container");
        if (!container) return;

        const savedPos = sessionStorage.getItem(`scroll-pos-${pathname}`);
        if (savedPos) {
            const targetPos = parseInt(savedPos, 10);
            if (targetPos > 0) {
                let attempts = 0;
                const intervalId = setInterval(() => {
                    if (container) {
                        container.scrollTop = targetPos;
                        attempts++;
                        
                        // Stop trying after 20 attempts (2 seconds) or if we successfully reached the target
                        if (attempts >= 20 || Math.abs(container.scrollTop - targetPos) < 5) {
                            clearInterval(intervalId);
                        }
                    }
                }, 100);

                return () => clearInterval(intervalId);
            }
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
        pathname.startsWith("/search") || pathname.startsWith("/payment/");
    const isExcludedFromCartAndNav = ["/checkout", "/cart", "/payment-flow", "/payment/success", "/payment/mock-gateway"].includes(pathname) ||
        pathname.startsWith("/products/") || pathname.startsWith("/orders/");
    const isPolicy = ["/privacy", "/terms", "/exchange-policy", "/payment-flow"].includes(pathname) || pathname.startsWith("/pages/");
    const showHeader = !isChat && !isHeaderExcluded && !isPolicy;
    const isCatalogRoute = ["/", "/products", "/categories", "/search", "/wishlist"].includes(pathname) || pathname.startsWith("/category/");
    const showFloatingCart = !isChat && !isExcludedFromCartAndNav && isCatalogRoute;

    return (
        <div className="customer-ui bmv-theme flex h-full min-h-0 flex-col">
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
            {showHeader && <Header />}
            <WelcomeFlow />
            <main 
                id="main-scroll-container"
                className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide bg-[#f8faf8] overscroll-contain"
            >
                <div 
                    key={pathname} 
                    className={cn(
                        "w-full min-h-full flex flex-col",
                        showHeader ? (pathname === "/" ? "pt-0" : "pt-[176px]") : "pt-0",
                        !isChat && !isExcludedFromCartAndNav ? (showFloatingCart && totalItems > 0 ? "pb-44" : "pb-24") : "pb-0"
                    )}
                >
                    {children}
                </div>
            </main>
            {showFloatingCart && <FloatingCart />}
            {!isChat && !isExcludedFromCartAndNav && <BottomNav />}
            <ShareModal />
        </div>
    );
}
