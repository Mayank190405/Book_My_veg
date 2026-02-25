"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminStats } from "@/services/adminService";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Users, ShoppingBag, Package, IndianRupee,
    AlertTriangle, ArrowRight,
} from "lucide-react";
import Link from "next/link";

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-72 rounded-2xl" />
        </div>
    );
}

export default function AdminDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ["adminStats"],
        queryFn: getAdminStats,
        refetchInterval: 30000, // Refresh every 30s for "Live" feel
    });

    if (isLoading) return <DashboardSkeleton />;

    const stats = [
        {
            label: "Total Revenue",
            value: `₹${Number(data?.stats?.revenue || 0).toLocaleString("en-IN")}`,
            icon: IndianRupee,
            iconBg: "from-emerald-400 to-emerald-600",
            trend: 12.5,
        },
        {
            label: "Today's Orders",
            value: (data?.stats?.orders || 0).toLocaleString(),
            icon: ShoppingBag,
            iconBg: "from-blue-500 to-blue-700",
            trend: 8.2,
        },
        {
            label: "Inventory Items",
            value: (data?.stats?.products || 0).toLocaleString(),
            icon: Package,
            iconBg: "from-amber-400 to-amber-600",
            trend: 3.1,
        },
        {
            label: "Active Customers",
            value: (data?.stats?.users || 0).toLocaleString(),
            icon: Users,
            iconBg: "from-indigo-500 to-indigo-700",
            trend: 5.8,
        },
    ];

    const orderColumns = [
        {
            key: "id",
            header: "Order",
            render: (row: any) => (
                <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-gray-400">#{row.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-[10px] text-gray-400">
                        {new Date(row.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
            ),
        },
        {
            key: "customer",
            header: "Customer",
            render: (row: any) => (
                <div>
                    <p className="font-bold text-gray-900 text-xs">{row.user?.name || "Guest User"}</p>
                    <p className="text-[10px] text-gray-500">{row.user?.phone}</p>
                </div>
            ),
        },
        {
            key: "totalAmount",
            header: "Total",
            render: (row: any) => (
                <span className="font-black text-gray-900 text-sm">₹{Number(row.totalAmount).toLocaleString("en-IN")}</span>
            ),
        },
        {
            key: "status",
            header: "Status",
            render: (row: any) => <StatusBadge status={row.status} dot />,
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <StatCard key={s.label} {...s} />
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Recent Orders — Live Feed Style */}
                <div className="xl:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-gray-900">Recent Orders</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Live feed of incoming orders</p>
                        </div>
                        <Link
                            href="/admin/orders"
                            className="bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1"
                        >
                            Manage All <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
                        <DataTable
                            columns={orderColumns}
                            rows={data?.recentOrders ?? []}
                            emptyTitle="Awaiting first order"
                            emptyDescription="Incoming orders will appear here automatically."
                        />
                    </div>
                </div>

                {/* Priority Alerts */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        Priority Alerts
                        {data?.lowStockProducts?.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                                {data.lowStockProducts.length}
                            </span>
                        )}
                    </h2>
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 p-6 space-y-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Low Stock Inventory</p>
                        {data?.lowStockProducts && data.lowStockProducts.length > 0 ? (
                            data.lowStockProducts.map((p: any) => (
                                <div key={p.id} className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-black text-red-500">
                                                ONLY {p.inventory?.[0]?.currentStock ?? 0} LEFT
                                            </span>
                                            <div className="h-1 w-24 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-red-500 rounded-full"
                                                    style={{ width: `${(p.inventory?.[0]?.currentStock / 5) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/admin/products?id=${p.id}`}
                                        className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-gray-900 transition-all"
                                    >
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                                    <ShoppingBag className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">All sets clear!</p>
                                    <p className="text-xs text-gray-500">Inventory is well stocked.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
