"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Search, Plus, User, Phone, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CreateOrderSelectCustomerPage() {
    const router = useRouter();

    const [searchQuery, setSearchQuery] = useState("");
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const res = await api.get("/users?role=USER");
                const list = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.data || []);
                setCustomers(list);
            } catch (error: any) {
                toast.error("Failed to load customers");
                setCustomers([]);
            } finally {
                setLoading(false);
            }
        };
        fetchCustomers();
    }, []);

    const filteredCustomers = customers.filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const nameMatch = (c.name || "").toLowerCase().includes(q);
        const phoneMatch = (c.phone || "").includes(q);
        return nameMatch || phoneMatch;
    });

    const handleSelectCustomer = (customer: any) => {
        router.push(`/packer/create-order/products?customerId=${customer.id}&name=${encodeURIComponent(customer.name || "Customer")}&phone=${customer.phone || ""}`);
    };

    const handleWalkInCustomer = () => {
        router.push(`/packer/create-order/products?customerId=walkin&name=${encodeURIComponent("Walk-in Customer")}&phone=`);
    };

    return (
        <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Top Bar (Screen 3) */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 sticky top-0 bg-white z-10">
                <button onClick={() => router.push("/packer")} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h3 className="text-base font-black text-slate-900">Create New Order</h3>
            </div>

            <div className="p-5 space-y-5 flex-1 overflow-y-auto pb-24">
                <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Customer</h4>
                    {/* Search Bar (Screen 3) */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search by name or mobile number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-12 pl-10 rounded-2xl bg-slate-100 border-none text-xs font-bold focus:bg-white transition-all shadow-inner"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Recent Customers List (Screen 3) */}
                <div className="space-y-3">
                    <p className="text-xs font-black text-slate-700">Recent Customers</p>

                    {loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="h-7 w-7 animate-spin mx-auto text-purple-600" />
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs font-bold text-slate-400">No customers found</p>
                        </div>
                    ) : (
                        filteredCustomers.slice(0, 15).map(customer => (
                            <div 
                                key={customer.id}
                                onClick={() => handleSelectCustomer(customer)}
                                className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-purple-200 transition-all cursor-pointer active:scale-98"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm shadow-sm">
                                        {customer.name?.charAt(0) || "C"}
                                    </div>
                                    <div>
                                        <h5 className="text-xs font-bold text-slate-900">{customer.name || "Unnamed Customer"}</h5>
                                        <p className="text-[11px] font-semibold text-slate-400">{customer.phone || "No mobile"}</p>
                                    </div>
                                </div>

                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectCustomer(customer);
                                    }}
                                    className="w-9 h-9 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center justify-center transition-all"
                                >
                                    <Plus className="h-4 w-4 stroke-[3]" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Bottom Walk-in Customer Button (Screen 3) */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white p-4 border-t border-slate-100 z-20 shadow-2xl">
                <Button 
                    variant="outline"
                    onClick={handleWalkInCustomer}
                    className="w-full h-13 rounded-2xl border-2 border-dashed border-purple-600 text-purple-700 font-bold text-xs hover:bg-purple-50 active:scale-95 flex items-center justify-center gap-2"
                >
                    <Plus className="h-4 w-4 stroke-[3]" />
                    Walk-in Customer
                </Button>
            </div>
        </div>
    );
}
