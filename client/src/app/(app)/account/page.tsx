"use client";

import Link from "next/link";
import { MapPin, LogOut, User, CreditCard, FileText, ChevronRight, Heart, Moon, RotateCcw, ShoppingBag, Headphones, Shield, Bell } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import ProfileEditForm from "@/components/account/ProfileEditForm";
import NotificationDrawer from "@/components/ui/NotificationDrawer";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getBaseURL } from "@/services/api";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

type StoreOption = { id: string; slug: string; name: string; latitude: number; longitude: number; deliveryRadius?: number; isOpen?: boolean; dist: number; hasStock: boolean };

export default function AccountPage() {
    const { user, logout, activeStore, setActiveStore, location, notificationsEnabled, setNotificationsEnabled } = useUserStore();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
    const router = useRouter();
    const [nearbyStores, setNearbyStores] = useState<StoreOption[]>([]);
    const [loadingStores, setLoadingStores] = useState(false);
    const latitude = location?.coords?.lat;
    const longitude = location?.coords?.lng;

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const fetchNearbyStores = async () => {
            if (latitude == null || longitude == null) return;
            setLoadingStores(true);
            try {
                const apiUrl = getBaseURL();
                const res = await fetch(`${apiUrl}/locations`);
                const stores: StoreOption[] = await res.json();
                const lat = latitude;
                const lng = longitude;

                // Filter to stores within delivery radius
                const eligible = stores
                    .filter((s: StoreOption) => s.latitude && s.longitude)
                    .map((s: StoreOption) => ({ ...s, dist: calculateDistance(lat, lng, s.latitude, s.longitude) }))
                    .filter((s: StoreOption) => !s.deliveryRadius || s.dist <= s.deliveryRadius)
                    .sort((a: StoreOption, b: StoreOption) => a.dist - b.dist);

                // Check stock for each eligible store
                const withStock = await Promise.all(eligible.map(async (store: StoreOption) => {
                    try {
                        const invRes = await fetch(`${apiUrl}/products?locationId=${store.id}&limit=5`);
                        const invData = await invRes.json();
                        const hasStock = invData.data?.some(
                            (p: { inventory?: { currentStock: number | string }[] }) => p.inventory?.some((inv: { currentStock: number | string }) => Number(inv.currentStock) > 0)
                        );
                        return { ...store, hasStock };
                    } catch {
                        return { ...store, hasStock: false };
                    }
                }));

                setNearbyStores(withStock);
            } catch (e) {
                console.error('Failed to fetch nearby stores', e);
            } finally {
                setLoadingStores(false);
            }
        };
        fetchNearbyStores();
    }, [latitude, longitude]);

    const handleSwitchStore = (store: StoreOption) => {
        setActiveStore({ id: store.id, slug: store.slug, name: store.name });
        toast.success(`Switched to ${store.name}`);
    };

    const handleLogout = () => {
        logout();
        router.push("/");
    };

    const accountLinks = [
        { href: "/orders", title: "My orders", description: "Track and view your past orders", icon: ShoppingBag },
        { href: "/account/addresses", title: "My addresses", description: "Manage delivery addresses", icon: MapPin },
        { href: "/wishlist", title: "Saved items", description: "Your favourite products", icon: Heart },
        { href: "/payment-flow", title: "Payment information", description: "How payments work", icon: CreditCard },
        { href: "/contact", title: "Help & support", description: "Get help with your order", icon: Headphones },
    ];
    const policies = [
        { href: "/privacy", title: "Privacy policy", icon: Shield },
        { href: "/terms", title: "Terms & conditions", icon: FileText },
        { href: "/exchange-policy", title: "Exchange policy", icon: RotateCcw },
        { href: "/returns", title: "Returns & exchanges", icon: RotateCcw },
    ];

    return (
        <AuthGuard>
            <div className="min-h-screen bg-[#f8faf8] pb-28 text-[#17251e] dark:bg-background dark:text-foreground">
                <header className="bg-[#087f5b] text-white">
                    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
                        <div className="mb-6 flex items-center justify-between">
                            <h1 className="text-xl font-semibold">Your account</h1>
                            <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-4 text-sm"><Headphones className="h-4 w-4" /> Help</Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/60 bg-white/15 text-2xl font-semibold" aria-hidden="true">{user?.name?.charAt(0).toUpperCase() || <User className="h-7 w-7" />}</div>
                            <div className="min-w-0 flex-1">
                                <h2 className="break-words text-xl font-semibold">{user?.name || "Your profile"}</h2>
                                {user?.phone && <p className="mt-1 break-words text-sm text-white/90">{user.phone}</p>}
                                {user?.email && <p className="mt-1 break-all text-sm text-white/90">{user.email}</p>}
                            </div>
                            <ProfileEditForm><button className="min-h-11 rounded-lg border border-white/50 px-3 text-sm font-medium">Edit</button></ProfileEditForm>
                        </div>
                    </div>
                </header>

                <main className="mx-auto grid max-w-4xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-2">
                    <section className="overflow-hidden rounded-2xl border border-[#e5ebe7] bg-white dark:bg-card dark:border-border md:row-span-2" aria-label="Account shortcuts">
                        {accountLinks.map(({ href, title, description, icon: Icon }) => (
                            <Link key={href} href={href} className="flex min-h-20 items-center gap-4 border-b border-[#e5ebe7] px-4 py-4 last:border-0 hover:bg-[#e8f7ef] dark:border-border dark:hover:bg-secondary">
                                <Icon className="h-5 w-5 shrink-0 text-[#087f5b] dark:text-primary" />
                                <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[#64736b] dark:text-muted-foreground">{description}</p></div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-[#64736b]" />
                            </Link>
                        ))}
                    </section>

                    <section aria-labelledby="preferences-title">
                        <h2 id="preferences-title" className="mb-3 text-base font-semibold">Preferences</h2>
                        <div className="divide-y divide-[#e5ebe7] overflow-hidden rounded-2xl border border-[#e5ebe7] bg-white dark:bg-card dark:border-border">
                            {mounted && <div className="flex min-h-16 items-center justify-between gap-4 p-4"><label htmlFor="account-dark-mode" className="flex items-center gap-3 text-sm"><Moon className="h-5 w-5 text-[#64736b]" />Dark mode</label><Switch id="account-dark-mode" checked={theme === 'dark'} onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')} /></div>}
                            <div className="flex min-h-16 items-center justify-between gap-4 p-4"><label htmlFor="account-notifications" className="flex items-center gap-3 text-sm"><Bell className="h-5 w-5 text-[#64736b]" />Notifications</label><Switch id="account-notifications" checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} /></div>
                            <button onClick={() => setNotificationDrawerOpen(true)} className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left text-sm hover:bg-[#e8f7ef] dark:hover:bg-secondary"><span>Notification inbox</span><ChevronRight className="h-4 w-4" /></button>
                        </div>
                    </section>

                    <section aria-labelledby="store-title">
                        <h2 id="store-title" className="mb-3 text-base font-semibold">Your store</h2>
                        <div className="rounded-2xl border border-[#e5ebe7] bg-white p-4 dark:bg-card dark:border-border">
                            {loadingStores ? <p role="status" className="text-sm text-[#64736b]">Finding nearby stores…</p> : nearbyStores.length === 0 ? <p className="text-sm text-[#64736b]">Choose a delivery location to see available stores.</p> : <div className="space-y-4">{nearbyStores.map(store => <div key={store.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{store.name}</p><p className="mt-1 text-xs text-[#64736b]">{store.dist.toFixed(1)} km away · {store.isOpen ? 'Open' : 'Closed'}</p><p className="mt-1 text-xs text-[#64736b]">{store.hasStock ? 'Stock available' : 'No stock found'}</p></div>{activeStore?.id === store.id ? <span className="shrink-0 rounded-full bg-[#e8f7ef] px-3 py-1 text-xs font-medium text-[#056647]">Selected</span> : <button onClick={() => handleSwitchStore(store)} className="min-h-11 rounded-lg border border-[#e5ebe7] px-3 text-sm text-[#087f5b]">Switch</button>}</div>)}</div>}
                        </div>
                    </section>

                    <section className="md:col-span-2" aria-labelledby="policies-title">
                        <h2 id="policies-title" className="mb-3 text-base font-semibold">Policies & information</h2>
                        <div className="grid overflow-hidden rounded-2xl border border-[#e5ebe7] bg-white dark:bg-card dark:border-border sm:grid-cols-2">{policies.map(({href,title,icon: Icon}) => <Link key={href} href={href} className="flex min-h-16 items-center gap-3 border-b border-[#e5ebe7] px-4 py-3 text-sm hover:bg-[#e8f7ef] dark:hover:bg-secondary dark:border-border"><Icon className="h-5 w-5 text-[#64736b]" /><span className="flex-1">{title}</span><ChevronRight className="h-4 w-4 text-[#64736b]" /></Link>)}</div>
                    </section>
                    <button onClick={handleLogout} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 md:col-span-2"><LogOut className="h-4 w-4" />Log out</button>
                    <p className="text-center text-xs text-[#64736b] md:col-span-2">Book My Veg</p>
                </main>
                <NotificationDrawer open={notificationDrawerOpen} onClose={() => setNotificationDrawerOpen(false)} />
            </div>
        </AuthGuard>
    );
}
