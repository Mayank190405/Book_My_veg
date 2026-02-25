"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    LayoutDashboard, Package, ShoppingBag, Users, LogOut,
    Menu, X, Bell, ChevronRight, ImageIcon, Settings, QrCode
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUPER_ADMIN_NAV = [
    { name: "Global Overview", href: "/admin/super-admin?tab=overview", icon: LayoutDashboard },
    { name: "Global Inventory", href: "/admin/super-admin?tab=inventory", icon: Package },
    { name: "CRM & Users", href: "/admin/super-admin?tab=crm", icon: Users },
    { name: "Staff Operations", href: "/admin/super-admin?tab=staff", icon: Users },
    { name: "Marketing Banners", href: "/admin/super-admin?tab=marketing", icon: ImageIcon },
];

const getStoreAdminNav = (slug: string) => [
    { name: "Store Dashboard", href: `/admin/${slug}/admin`, icon: LayoutDashboard },
    { name: "Launch POS", href: `/pos/${slug}`, icon: QrCode },
    { name: "Packer Hub", href: `/packer/${slug}`, icon: Package },
    { name: "Driver Hub", href: `/driver`, icon: ShoppingBag },
];

function SidebarContent({
    pathname,
    onLogout,
    onClose,
}: {
    pathname: string;
    onLogout: () => void;
    onClose?: () => void;
}) {
    return (
        <div className="flex flex-col h-full">
            {/* Logo / Brand */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                        <span className="text-white font-extrabold text-sm">B</span>
                    </div>
                    <div>
                        <p className="font-extrabold text-gray-900 leading-none text-sm">BMV Admin</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Quick Commerce</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 lg:hidden transition-colors">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Main Menu</p>
                {(() => {
                    const isSuperAdmin = pathname.includes("/super-admin");
                    const storeMatch = pathname.match(/^\/admin\/([^\/]+)\/admin/);
                    const storeSlug = storeMatch ? storeMatch[1] : null;

                    const activeNavItems = isSuperAdmin ? SUPER_ADMIN_NAV :
                        storeSlug ? getStoreAdminNav(storeSlug) :
                            [{ name: "Store View", href: pathname, icon: LayoutDashboard }];

                    return activeNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href.split('?')[0] && (
                            !item.href.includes('tab=') ||
                            (typeof window !== 'undefined' && window.location.search.includes(item.href.split('?')[1]))
                        );
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={cn(
                                    "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-green-50 text-green-700"
                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                                )}
                            >
                                {/* Active left border indicator */}
                                {isActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-green-500 rounded-r-full" />
                                )}
                                <Icon className={cn(
                                    "h-4.5 w-4.5 shrink-0 transition-transform duration-200 h-5 w-5",
                                    isActive && "scale-110",
                                    !isActive && "group-hover:scale-105"
                                )} />
                                <span>{item.name}</span>
                                {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-green-400" />}
                            </Link>
                        );
                    });
                })()}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-gray-100 space-y-1">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-all"
                >
                    <LogOut className="h-5 w-5" />
                    Logout
                </button>
            </div>
        </div>
    );
}

function TopNavbar({ page }: { page: string }) {
    return (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex items-center gap-4">
            {/* Page title */}
            <div className="flex-1">
                <h1 className="text-lg font-extrabold text-gray-900">{page}</h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Notifications */}
                <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <Bell className="h-5 w-5 text-gray-500" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                </button>

                {/* Admin avatar */}
                <div className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xs">A</span>
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-xs font-semibold text-gray-800 leading-none">Admin</p>
                        <p className="text-[10px] text-gray-400">Super Admin</p>
                    </div>
                </div>
            </div>
        </header>
    );
}

function getPageTitle(pathname: string) {
    if (pathname.includes("/super-admin")) return "Super Control";
    const storeMatch = pathname.match(/^\/admin\/([^\/]+)\/admin/);
    if (storeMatch) return `Store Management`;
    return "Admin";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, _hasHydrated } = useUserStore();
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const allowedRoles = ["ADMIN", "MANAGER", "POS_OPERATOR"];
        if (_hasHydrated && (!user || !allowedRoles.includes(user.role))) {
            router.push("/");
        }
    }, [user, _hasHydrated, router]);

    // Close mobile drawer on route change
    useEffect(() => setMobileOpen(false), [pathname]);

    const allowedRoles = ["ADMIN", "MANAGER", "POS_OPERATOR"];
    if (!_hasHydrated || !user || !allowedRoles.includes(user.role)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl animate-pulse" />
                    <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                </div>
            </div>
        );
    }

    const handleLogout = () => {
        logout();
        toast.success("Logged out successfully");
        router.push("/");
    };

    const pageTitle = getPageTitle(pathname);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* ── Desktop Sidebar ─────────────────────────── */}
            <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 shadow-sm shrink-0">
                <SidebarContent pathname={pathname} onLogout={handleLogout} />
            </aside>

            {/* ── Mobile Drawer Backdrop ─────────────────── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Mobile Sidebar Drawer ─────────────────── */}
            <aside className={cn(
                "fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-2xl lg:hidden flex flex-col transition-transform duration-300",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <SidebarContent
                    pathname={pathname}
                    onLogout={handleLogout}
                    onClose={() => setMobileOpen(false)}
                />
            </aside>

            {/* ── Main Area ─────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile menu trigger in topbar */}
                <div className="flex items-center lg:hidden px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 gap-3">
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                        <Menu className="h-5 w-5 text-gray-600" />
                    </button>
                    <p className="font-extrabold text-gray-900">{pageTitle}</p>
                </div>

                {/* Desktop topbar */}
                <div className="hidden lg:block">
                    <TopNavbar page={pageTitle} />
                </div>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-in fade-in duration-200">
                    {children}
                </main>
            </div>
        </div>
    );
}
