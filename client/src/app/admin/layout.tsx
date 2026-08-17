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
    Bell,
    Search,
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
    History,
    MessageSquare,
    Key
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useUserStore } from "@/store/useUserStore";
import { logout } from "@/services/authService";
import GlobalNotificationListener from "@/components/features/GlobalNotificationListener";

const NAV_ITEMS = [
    { label: "Overview", icon: LayoutDashboard, href: "/admin/dashboard" },
    { label: "Sales Reports", icon: TrendingUp, href: "/admin/reports" },
    { label: "Customer Dues & Sales", icon: Users, href: "/admin/reports/customers" },
    { label: "POS Terminal", icon: Monitor, href: "/pos" },
    { label: "Attendance", icon: Clock, href: "/admin/attendance" },
    { label: "Expenses", icon: Receipt, href: "/admin/expenses" },
    { label: "Categories", icon: Layers, href: "/admin/categories" },
    { label: "Units", icon: Scale, href: "/admin/units" },
    { label: "Products", icon: ShoppingCart, href: "/admin/products" },
    { label: "Product Variants", icon: Tag, href: "/admin/variants" },
    { label: "Inventory", icon: Warehouse, href: "/admin/inventory" },
    { label: "Stock Inward", icon: ArrowDownToLine, href: "/admin/inventory/inward" },
    { label: "Purchase Orders (PO)", icon: FileText, href: "/admin/purchase-orders" },
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
        const adminUser = user as any;
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

    if (!_hasHydrated) {
        return (
            <div className="h-screen w-full bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing Dashboard...</span>
                </div>
            </div>
        );
    }

    // Special case: Login page doesn't get the sidebar/shell
    if (isAdminLogin) {
        return <div className="min-h-screen bg-gray-50">{children}</div>;
    }

    // Safety: Don't render content if user is definitely not authorized
    if (!isAuthorized) {
        return null;
    }

    return (
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
            <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-500/30 selection:text-emerald-900">
                <style jsx global>{`
                    #admin-scroll-container::-webkit-scrollbar {
                        width: 6px;
                    }
                    #admin-scroll-container::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    #admin-scroll-container::-webkit-scrollbar-thumb {
                        background: #e2e8f0;
                        border-radius: 10px;
                    }
                    #admin-scroll-container::-webkit-scrollbar-thumb:hover {
                        background: #cbd5e1;
                    }
                `}</style>

                {/* Mobile Backdrop */}
                {isSidebarOpen && (
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[45] md:hidden animate-in fade-in duration-300" 
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={cn(
                    "fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 transition-all duration-500 ease-in-out",
                    isSidebarOpen ? "w-80 translate-x-0" : "w-24 -translate-x-full md:translate-x-0"
                )}>
                    {/* Sidebar Header */}
                    <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 bg-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center p-1 shadow-sm overflow-hidden">
                                <img src="/logo.png" alt="BookMyVeg" className="w-full h-full object-contain" />
                            </div>
                            <div className={cn(
                                "flex flex-col transition-all duration-300 overflow-hidden",
                                isSidebarOpen ? "w-auto opacity-100" : "w-0 opacity-0"
                            )}>
                                <span className="text-sm font-black tracking-tight text-slate-900 leading-none">BookMyVeg</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Admin Panel</span>
                            </div>
                        </div>

                        {/* Mobile Close Button */}
                        {isSidebarOpen && (
                            <button 
                                onClick={() => setIsSidebarOpen(false)}
                                className="md:hidden w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Nav Items */}
                    <nav className="p-4 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {filteredNavItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                                        isActive 
                                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" 
                                            : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
                                    )}
                                >
                                    <Icon className={cn(
                                        "h-5 w-5 transition-transform duration-500 group-hover:scale-110",
                                        isActive ? "rotate-3" : ""
                                    )} />
                                    <span className={cn(
                                        "text-xs font-semibold tracking-wide transition-all duration-300",
                                        isSidebarOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                                    )}>
                                        {item.label}
                                    </span>
                                    {isActive && isSidebarOpen && (
                                        <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="absolute bottom-0 left-0 w-full p-4 border-t border-slate-100 bg-white">
                        <button 
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all group"
                        >
                            <LogOut className="h-5 w-5" />
                            <span className={cn(
                                "text-xs font-semibold tracking-wide transition-all duration-300",
                                isSidebarOpen ? "opacity-100" : "opacity-0"
                            )}>
                                Logout Session
                            </span>
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className={cn(
                    "transition-all duration-500 ease-in-out min-h-screen",
                    isSidebarOpen ? "md:pl-80" : "md:pl-24 pl-0"
                )}>
                    {/* Top Header */}
                        <header className="h-24 border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-4 md:px-10">
                        <div className="flex items-center gap-8">
                            <button 
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                            >
                                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                            
                            <div className="hidden lg:flex items-center gap-4 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-200 group focus-within:border-emerald-500/40 transition-all focus-within:bg-white focus-within:shadow-sm focus-within:shadow-emerald-100/50">
                                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                                <input 
                                    placeholder="Search management console..." 
                                    className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest w-64 placeholder:text-slate-400 text-slate-900"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <button className="relative w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all group">
                                <Bell className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                                <span className="absolute top-3 right-3 w-2 h-2 bg-emerald-500 rounded-full ring-4 ring-white" />
                            </button>

                            <div className="h-10 w-px bg-slate-200 mx-2" />

                            <div className="flex items-center gap-3 pl-2 cursor-pointer group">
                                <div className="flex flex-col items-end text-right hidden sm:flex">
                                    <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{user?.name || "Administrator"}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                                        {user?.role === "STORE_ADMIN" ? "Regional Hub Manager" : user?.role === "SUPER_ADMIN" ? "Network Super Admin" : "Logistics Administrator"}
                                    </span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                                    {user?.name?.[0] ? <span className="font-bold">{user.name[0]}</span> : <UserCircle className="h-5 w-5" />}
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Page Content */}
                    <div 
                        id="admin-scroll-container"
                        className="p-4 md:p-10 max-h-[calc(100vh-6rem)] overflow-y-auto"
                    >
                        {children}
                    </div>
                </main>

                <Toaster richColors position="top-right" theme="light" />
                <GlobalNotificationListener />
            </div>
        </ThemeProvider>
    );
}
