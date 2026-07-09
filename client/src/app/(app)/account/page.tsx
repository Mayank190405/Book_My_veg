"use client";

import Link from "next/link";
import { 
    MapPin, 
    LogOut, 
    User, 
    CreditCard, 
    FileText, 
    ChevronRight, 
    Phone, 
    Mail, 
    Heart, 
    Sun, 
    Moon, 
    RotateCcw,
    MoreVertical,
    ArrowLeft,
    ShoppingBag,
    Headphones,
    Shield,
    Camera,
    Bell,
    Store,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import ProfileEditForm from "@/components/account/ProfileEditForm";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getBaseURL } from "@/services/api";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

export default function AccountPage() {
    const { user, logout, activeStore, setActiveStore, location, notificationsEnabled, setNotificationsEnabled } = useUserStore();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const router = useRouter();
    const [nearbyStores, setNearbyStores] = useState<any[]>([]);
    const [loadingStores, setLoadingStores] = useState(false);

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
            if (!location?.coords) return;
            setLoadingStores(true);
            try {
                const apiUrl = getBaseURL();
                const res = await fetch(`${apiUrl}/locations`);
                const stores = await res.json();
                const { lat, lng } = location.coords;

                // Filter to stores within delivery radius
                const eligible = stores
                    .filter((s: any) => s.latitude && s.longitude)
                    .map((s: any) => ({ ...s, dist: calculateDistance(lat, lng, s.latitude, s.longitude) }))
                    .filter((s: any) => !s.deliveryRadius || s.dist <= s.deliveryRadius)
                    .sort((a: any, b: any) => a.dist - b.dist);

                // Check stock for each eligible store
                const withStock = await Promise.all(eligible.map(async (store: any) => {
                    try {
                        const invRes = await fetch(`${apiUrl}/products?locationId=${store.id}&limit=5`);
                        const invData = await invRes.json();
                        const hasStock = invData.data?.some(
                            (p: any) => p.inventory?.some((inv: any) => Number(inv.currentStock) > 0)
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
    }, [location?.coords?.lat, location?.coords?.lng]);

    const handleSwitchStore = (store: any) => {
        setActiveStore({ id: store.id, slug: store.slug, name: store.name });
        toast.success(`Switched to ${store.name}`);
    };

    const handleLogout = () => {
        logout();
        router.push("/");
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background pb-32">
                
                {/* 1. Curved Green Header (Hero Section) */}
                <div className="bg-gradient-to-br from-[#023324] via-[#034430] to-[#044c36] rounded-b-[3.5rem] p-6 pt-6 pb-12 text-white relative shadow-xl overflow-hidden">
                    
                    {/* Abstract design vector accent overlay */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-200 via-emerald-100 to-transparent pointer-events-none" />

                    {/* Top Action Bar */}
                    <div className="flex justify-between items-center w-full relative z-10">
                        <button
                            onClick={() => router.push('/')}
                            className="w-10 h-10 flex items-center justify-center active:scale-90 transition-all hover:opacity-80"
                        >
                            <ArrowLeft className="h-6 w-6 text-white" />
                        </button>
                        
                        <div className="flex items-center gap-4">
                            <Link 
                                href="/contact"
                                className="border border-amber-400 text-amber-400 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/5 active:scale-95 transition-all shadow-sm"
                            >
                                <Headphones className="h-3.5 w-3.5" />
                                Help
                            </Link>
                            <button className="w-10 h-10 flex items-center justify-center active:scale-90 transition-all hover:opacity-80">
                                <MoreVertical className="h-6 w-6 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Profile details & photo container */}
                    <div className="flex items-center justify-between mt-10 px-4 relative z-10">
                        {/* Profile Photo (Left aligned avatar circle) */}
                        <ProfileEditForm>
                            <div className="flex flex-col items-center shrink-0 cursor-pointer group relative">
                                <div className="h-24 w-24 rounded-full border-2 border-white flex items-center justify-center bg-white/10 shadow-lg relative overflow-hidden transition-all group-hover:scale-105 duration-300">
                                    {user?.name?.charAt(0).toUpperCase() || <User className="h-12 w-12 text-white" />}
                                </div>
                                {/* Camera overlay icon bottom-right */}
                                <div className="absolute bottom-1 right-1 bg-amber-400 text-[#023324] rounded-full p-1.5 border border-white shadow-md">
                                    <Camera className="h-3.5 w-3.5" />
                                </div>
                            </div>
                        </ProfileEditForm>

                        {/* Right Details Column */}
                        <div className="flex-1 pl-6 space-y-1.5">
                            <h2 className="font-black text-2xl tracking-tight leading-tight uppercase italic text-white break-all">
                                {user?.name || ""}
                            </h2>
                            {user?.email && (
                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80 flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5 text-white/60" /> {user.email}
                                </p>
                            )}
                            {user?.phone && (
                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80 flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5 text-white/60" /> {user.phone}
                                </p>
                            )}
                        </div>
                    </div>

                </div>

                {/* 2. Quick Access Section */}
                <div className="px-6 mt-8 max-w-2xl mx-auto space-y-4">
                    <div className="relative">
                        <h3 className="text-xs font-black text-[#034a34] dark:text-emerald-400 uppercase tracking-[0.25em] pl-1 relative z-10 flex flex-col gap-1">
                            Quick Access
                            <span className="w-10 h-0.5 bg-amber-400 rounded-full" />
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Addresses */}
                        <Link 
                            href="/account/addresses" 
                            className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-[0.98] group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#023324] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-xs font-black text-foreground uppercase tracking-wider">Addresses</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Manage Locations</span>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                        {/* My Orders */}
                        <Link 
                            href="/orders" 
                            className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-[0.98] group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#d97706] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <ShoppingBag className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-xs font-black text-foreground uppercase tracking-wider">My Orders</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">View History</span>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                        {/* Payment Flow */}
                        <Link 
                            href="/payment-flow" 
                            className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-[0.98] group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#d97706] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-xs font-black text-foreground uppercase tracking-wider">Payment Flow</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">How Payments Work</span>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                        {/* Wishlist */}
                        <Link 
                            href="/wishlist" 
                            className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-[0.98] group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#023324] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <Heart className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-xs font-black text-foreground uppercase tracking-wider">Wishlist</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Your Saved Items</span>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                    </div>
                </div>

                {/* Nearby Stores Section */}
                <div className="px-6 mt-8 max-w-2xl mx-auto space-y-4">
                    <div className="relative">
                        <h3 className="text-xs font-black text-[#034a34] dark:text-emerald-400 uppercase tracking-[0.25em] pl-1 relative z-10 flex flex-col gap-1">
                            Nearby Stores
                            <span className="w-10 h-0.5 bg-amber-400 rounded-full" />
                        </h3>
                    </div>

                    {loadingStores ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-5 h-5 border-2 border-[#034a34] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : nearbyStores.length === 0 ? (
                        <div className="bg-card border border-border rounded-2xl p-5 text-center">
                            <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No stores in your area</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {nearbyStores.map((store) => (
                                <div
                                    key={store.id}
                                    className={cn(
                                        "bg-card border rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all",
                                        activeStore?.id === store.id
                                            ? "border-[#034a34]/30 bg-emerald-50/50 dark:bg-emerald-950/20"
                                            : "border-border"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm",
                                            activeStore?.id === store.id ? "bg-[#034a34]" : "bg-slate-500"
                                        )}>
                                            <Store className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-foreground uppercase tracking-wider">{store.name}</span>
                                                {activeStore?.id === store.id && (
                                                    <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <CheckCircle2 className="h-2.5 w-2.5" />
                                                        ACTIVE
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[9px] text-muted-foreground font-medium">
                                                {store.dist.toFixed(1)} km away · {store.isOpen ? 'Open' : 'Closed'}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] font-bold mt-0.5",
                                                store.hasStock ? "text-emerald-600" : "text-amber-600"
                                            )}>
                                                {store.hasStock ? '● Stock Available' : '● Out of Stock'}
                                            </span>
                                        </div>
                                    </div>
                                    {activeStore?.id !== store.id && (
                                        <button
                                            onClick={() => handleSwitchStore(store)}
                                            className="text-xs font-bold bg-[#023324] text-white px-4 py-2 rounded-full active:scale-95 transition-all shrink-0 shadow-sm"
                                        >
                                            Switch
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. Settings & Support Section */}
                <div className="px-6 mt-8 max-w-2xl mx-auto space-y-4">
                    <h3 className="text-xs font-black text-[#034a34] dark:text-emerald-400 uppercase tracking-[0.25em] pl-1 flex flex-col gap-1">
                        Settings & Support
                        <span className="w-10 h-0.5 bg-amber-400 rounded-full" />
                    </h3>

                    <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border/60 shadow-sm">
                        
                        <Link 
                            href="/privacy" 
                            className="p-5 flex items-center justify-between hover:bg-secondary/50 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <Shield className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Privacy Policy</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                        <Link 
                            href="/terms" 
                            className="p-5 flex items-center justify-between hover:bg-secondary/50 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Terms of Service</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                        <Link 
                            href="/exchange-policy" 
                            className="p-5 flex items-center justify-between hover:bg-secondary/50 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <RotateCcw className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Exchange Policy</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                        <Link 
                            href="/returns" 
                            className="p-5 flex items-center justify-between hover:bg-secondary/50 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <RotateCcw className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Returns & Exchange Policy</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                        <Link 
                            href="/contact" 
                            className="p-5 flex items-center justify-between hover:bg-secondary/50 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <Headphones className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Contact Us</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </Link>

                    </div>
                </div>

                {/* 4. App Preferences (Dark Mode & Alerts) */}
                <div className="px-6 mt-6 max-w-2xl mx-auto">
                    <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border/60 shadow-sm">
                        
                        {/* Boutique Dark Mode */}
                        {mounted && (
                            <div className="p-5 flex items-center justify-between text-xs font-bold text-foreground uppercase tracking-wide">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                                        {theme === 'dark' ? <Moon className="h-4 w-4 text-emerald-300" /> : <Sun className="h-4 w-4 text-amber-500" />}
                                    </div>
                                    <span>Boutique Dark Mode</span>
                                </div>
                                <Switch 
                                    checked={theme === 'dark'} 
                                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                                    className="data-[state=checked]:bg-emerald-500" 
                                />
                            </div>
                        )}

                        {/* App Notifications */}
                        <div className="p-5 flex items-center justify-between text-xs font-bold text-foreground uppercase tracking-wide">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                                    <Bell className="h-4 w-4" />
                                </div>
                                <span>App Notifications</span>
                            </div>
                            <Switch 
                                checked={notificationsEnabled} 
                                onCheckedChange={setNotificationsEnabled}
                                className="data-[state=checked]:bg-emerald-500" 
                            />
                        </div>

                    </div>
                </div>

                {/* 5. Log Out button */}
                <div className="px-6 mt-8 max-w-2xl mx-auto">
                    <button
                        onClick={handleLogout}
                        className="w-full h-14 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-500 text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 hover:bg-red-500 hover:text-white transition-all shadow-inner active:scale-[0.98]"
                    >
                        <LogOut className="h-4 w-4" />
                        Log Out
                    </button>
                </div>

                {/* Footer Brand */}
                <div className="pt-12 pb-8 text-center space-y-2 opacity-25">
                    <p className="text-[10px] font-black text-foreground uppercase tracking-[0.4em]">Verified Premium Protocol</p>
                    <p className="text-[8px] font-bold text-foreground uppercase tracking-[0.2em]">Build 2026.06 • Book My Veg</p>
                </div>

            </div>
        </AuthGuard>
    );
}
