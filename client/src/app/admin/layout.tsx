"use client"; // Admin Root Entry

import { 
    LayoutDashboard, 
    TrendingUp,
    Store, 
    Ticket, 
    Warehouse, 
    ShoppingCart, 
    Users, 
    Image as ImageIcon,
    Settings,
    LogOut,
    ChevronRight,
    Menu,
    X,
    UserCircle,
    Layers,
    Scale,
    Monitor,
    Clock,
    Receipt,
    ArrowDownToLine,
    FileText,
    Skull,
    Tag,
    MessageSquare,
    Key,
    Truck,
    Leaf
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { useUserStore } from "@/store/useUserStore";
import { logout } from "@/services/authService";
import GlobalNotificationListener from "@/components/features/GlobalNotificationListener";

const NAV_ITEMS = [
    { label: "Overview", icon: LayoutDashboard, href: "/admin/dashboard" },
    { label: "Sales Reports", icon: TrendingUp, href: "/admin/reports" },
    { label: "Daily Product Report", icon: TrendingUp, href: "/admin/reports/daily-products" },
    { label: "Customer Dues & Sales", icon: Users, href: "/admin/reports/customers" },
    { label: "POS Terminal", icon: Monitor, href: "/pos" },
    { label: "Attendance & Advances", icon: Clock, href: "/admin/attendance" },
    { label: "Expenses", icon: Receipt, href: "/admin/expenses" },
    { label: "WhatsApp Templates", icon: MessageSquare, href: "/admin/templates" },
    { label: "Vendors & Suppliers", icon: Truck, href: "/admin/vendors" },
    { label: "Purchase Orders (PO)", icon: FileText, href: "/admin/purchase-orders" },
    { label: "Categories", icon: Layers, href: "/admin/categories" },
    { label: "Units", icon: Scale, href: "/admin/units" },
    { label: "Products", icon: ShoppingCart, href: "/admin/products" },
    { label: "Product Variants", icon: Tag, href: "/admin/variants" },
    { label: "Inventory", icon: Warehouse, href: "/admin/inventory" },
    { label: "Stock Inward", icon: ArrowDownToLine, href: "/admin/inventory/inward" },
    { label: "Stock Transfer", icon: ChevronRight, href: "/admin/inventory/transfer" },
    { label: "Mortality (Wastage)", icon: Skull, href: "/admin/inventory/mortality" },
    { label: "Orders", icon: ShoppingCart, href: "/admin/orders" },
    { label: "Coupons", icon: Ticket, href: "/admin/coupons" },
    { label: "Support Chat", icon: MessageSquare, href: "/admin/chat" },
    { label: "Banners", icon: ImageIcon, href: "/admin/banners" },
    { label: "Users", icon: Users, href: "/admin/users" },
    { label: "Stores", icon: Store, href: "/admin/stores" },
    { label: "Manage Pages", icon: Settings, href: "/admin/policies" },
    { label: "API Console", icon: Key, href: "/admin/api-console" },
];

import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const { user, _hasHydrated } = useUserStore();
    const isAdminLogin = pathname === "/admin/login";

    const handleLogout = async () => {
        if (confirm("Are you sure you want to log out of the admin panel?")) {
            await logout();
            router.push("/admin/login");
        }
    };

    // Institutional Navigation Orchestration (Role-based filtering)
    const filteredNavItems = NAV_ITEMS.filter(item => {
        if (user?.role === "PURCHASE_MANAGER") {
            // Dedicated UI for Purchase Managers: Procurement & Inventory operations only
            const allowed = [
                "/admin/purchase-orders",
                "/admin/vendors",
                "/admin/reports/daily-products",
                "/admin/inventory",
                "/admin/inventory/inward",
                "/admin/inventory/transfer",
                "/admin/inventory/mortality",
                "/admin/products",
                "/admin/categories",
                "/admin/units",
                "/admin/variants"
            ];
            return allowed.includes(item.href);
        }
        if (user?.role === "STORE_ADMIN") {
            // Store Hub Operators focus on fulfillment, localization, and local team management
            const restricted = ["/admin/banners", "/admin/stores", "/admin/units", "/admin/categories", "/admin/policies"];
            return !restricted.includes(item.href);
        }
        return true;
    }).map(item => {
        const adminUser = user as typeof user & { slug?: string };
        if (adminUser?.role === "STORE_ADMIN" && item.label === "Overview" && adminUser.slug) {
            // Re-route localized overview to the store's specific hub
            return { ...item, href: `/admin/stores/${adminUser.slug}` };
        }
        return item;
    });

    // Auth Guard: Ensure user is logged in before accessing admin
    const isAuthorized = user && ["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "PURCHASE_MANAGER"].includes(user.role);

    useEffect(() => {
        if (_hasHydrated) {
            if (!user && !isAdminLogin) {
                router.push(`/admin/login?redirect=${pathname}`);
            } else if (!isAuthorized && !isAdminLogin) {
                // If not an admin/manager of any kind, redirect to home
                router.push("/");
            } else if (user?.role === "PURCHASE_MANAGER" && (pathname === "/admin/dashboard" || pathname === "/admin")) {
                // Auto-redirect Purchase Manager to their dedicated Purchase Orders workspace
                router.push("/admin/purchase-orders");
            }
        }
    }, [user, _hasHydrated, pathname, router, isAdminLogin, isAuthorized]);

    const currentPage = [...filteredNavItems].sort((a, b) => b.href.length - a.href.length).find(item => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label || "Management";

    useEffect(() => {
        if (!isSidebarOpen) return;
        const firstLink = sidebarRef.current?.querySelector<HTMLAnchorElement>("nav a");
        firstLink?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsSidebarOpen(false);
                menuButtonRef.current?.focus();
            }
            if (event.key === "Tab" && window.matchMedia("(max-width: 1023px)").matches) {
                const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
                if (!focusable?.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isSidebarOpen]);

    if (!_hasHydrated) {
        return <div className="bmv-theme bmv-admin flex min-h-screen items-center justify-center"><div className="flex items-center gap-3 text-sm text-[var(--bmv-muted)]" role="status"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--bmv-border)] border-t-[var(--bmv-accent-strong)]" />Loading management workspace…</div></div>;
    }
    if (isAdminLogin) return <div className="bmv-theme bmv-admin min-h-screen">{children}</div>;
    if (!isAuthorized) return null;

    return (
        <div className="bmv-theme bmv-admin h-dvh min-h-0 overflow-hidden bg-[var(--bmv-bg)] text-[var(--bmv-text)]">
            {isSidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-[45] bg-black/40 lg:hidden" onClick={() => { setIsSidebarOpen(false); menuButtonRef.current?.focus(); }} />}
            <aside ref={sidebarRef} id="admin-navigation" aria-label="Management navigation" className={cn("fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] flex-col border-r border-white/10 bg-[#004b30] text-white lg:flex lg:w-64", isSidebarOpen ? "flex" : "hidden")}>
                <div className="flex min-h-24 items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
                    <Link href="/admin" className="flex min-h-11 items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--bmv-accent)] text-[#004b30]"><Leaf className="h-6 w-6" /></span>
                        <span><span className="block text-base font-semibold tracking-tight">Book My Veg</span><span className="mt-1 block text-xs text-green-100/70">Management workspace</span></span>
                    </Link>
                    <button type="button" aria-label="Close navigation" onClick={() => { setIsSidebarOpen(false); menuButtonRef.current?.focus(); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
                </div>
                <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5">
                    <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-green-100/50">Workspace</p>
                    {filteredNavItems.map(item => {
                        const active = pathname === item.href || (pathname.startsWith(`${item.href}/`) && !filteredNavItems.some(other => other.href !== item.href && other.href.startsWith(`${item.href}/`) && (pathname === other.href || pathname.startsWith(`${other.href}/`))));
                        const Icon = item.icon;
                        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setIsSidebarOpen(false)} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors", active ? "bg-[var(--bmv-accent)] text-[#004b30]" : "text-green-50/80 hover:bg-white/10 hover:text-white")}><Icon className="h-[18px] w-[18px] shrink-0" /><span className="leading-snug">{item.label}</span>{active && <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}</Link>;
                    })}
                </nav>
                <div className="border-t border-white/10 p-3"><button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-green-50/80 hover:bg-white/10 hover:text-white"><LogOut className="h-5 w-5" />Log out</button></div>
            </aside>
            <div className="flex h-full min-h-0 min-w-0 flex-col lg:pl-64">
                <header className="bmv-topbar sticky top-0 z-40 shrink-0 border-b border-white/10">
                    <div className="flex min-h-20 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3">
                            <button ref={menuButtonRef} type="button" aria-label="Open navigation" aria-controls="admin-navigation" aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 hover:bg-white/10 lg:hidden"><Menu className="h-5 w-5" /></button>
                            <div className="min-w-0"><p className="text-xs text-green-100/70">Book My Veg / Management</p><h1 className="truncate text-lg font-semibold sm:text-xl">{currentPage}</h1></div>
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="hidden min-w-0 text-right sm:block"><p className="max-w-48 truncate text-sm font-medium">{user?.name || "Administrator"}</p><p className="mt-1 text-xs text-green-100/70">{user?.role === "STORE_ADMIN" ? "Store manager" : user?.role === "SUPER_ADMIN" ? "Super admin" : user?.role === "PURCHASE_MANAGER" ? "Purchase manager" : "Administrator"}</p></div>
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold">{user?.name?.[0]?.toUpperCase() || <UserCircle className="h-5 w-5" />}</span>
                        </div>
                    </div>
                </header>
                <main id="admin-scroll-container" className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
            <Toaster richColors position="top-right" theme="light" />
            <GlobalNotificationListener />
        </div>
    );
}
