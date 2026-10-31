"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAddresses, deleteAddress, Address } from "@/services/addressService";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit2, ChevronLeft, Navigation, Home, Briefcase, MapPin, Shield, Map } from "lucide-react";
import { useRouter } from "next/navigation";
import AddressForm from "@/components/features/AddressForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import AuthGuard from "@/components/auth/AuthGuard";

function AddressMapPreview({ lat, lng }: { lat?: number | null; lng?: number | null }) {
    if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`;
    return (
        <div className="relative h-28 rounded-2xl overflow-hidden mt-3 border border-emerald-100">
            <iframe
                src={mapUrl}
                className="w-full h-full scale-110 pointer-events-none"
                style={{ border: 0 }}
                loading="lazy"
                title="address-map"
            />
            {/* Green pin overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 bg-[#0b5c3e] rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(11,92,62,0.5)] border-2 border-white">
                    <MapPin className="w-4 h-4 text-white fill-white" />
                </div>
            </div>
        </div>
    );
}

function AddressTypeIcon({ type }: { type: string }) {
    switch (type?.toUpperCase()) {
        case "HOME": return <Home className="h-5 w-5" />;
        case "WORK":
        case "OFFICE": return <Briefcase className="h-5 w-5" />;
        default: return <MapPin className="h-5 w-5" />;
    }
}

export default function AddressesPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { token } = useUserStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | undefined>(undefined);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data: addresses, isLoading, isError, refetch } = useQuery({
        queryKey: ["addresses"],
        queryFn: getAddresses,
        enabled: !!token,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAddress,
        onError: () => { setDeletingId(null); },
        onSuccess: () => {
            setDeletingId(null);
            queryClient.invalidateQueries({ queryKey: ["addresses"] });
        },
    });

    const handleEdit = (addr: Address) => {
        setEditingAddress(addr);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingAddress(undefined);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        setDeletingId(id);
        deleteMutation.mutate(id);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#f8faf9] pt-28 px-5 space-y-4">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="w-full h-40 rounded-2xl bg-slate-100 animate-pulse" />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="min-h-screen bg-[#f8faf9] flex flex-col items-center justify-center p-6 gap-6">
                <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center border border-red-100">
                    <Shield className="h-8 w-8 text-red-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-slate-900 ">Couldn’t load addresses</h2>
                    <p className="text-xs text-slate-400 mt-2">Please try again in a moment.</p>
                </div>
                <Button
                    onClick={() => refetch()}
                    className="bg-[#0b5c3e] text-white font-semibold  rounded-2xl h-12 px-8"
                >
                    Try again
                </Button>
            </div>
        );
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-[#f8faf8] pb-28 text-[#17251e]">

                {/* Header */}
                <header className="flex items-center gap-3 border-b border-[#e5ebe7] bg-white px-4 py-3 sm:px-6">
                    <button
                        aria-label="Back to account"
                        onClick={() => router.push('/account')}
                        className="w-11 h-11 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200 active:scale-90 transition-all"
                    >
                        <ChevronLeft className="h-5 w-5 text-slate-700" strokeWidth={2.5} />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-[#17251e]">Addresses</h1>
                        <p className="text-xs text-[#64736b] mt-1">
                            {addresses?.length || 0} saved addresses
                        </p>
                    </div>
                </header>

                {/* Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="bg-white border-slate-200 rounded-2xl w-[95%] max-w-lg p-0 overflow-hidden shadow-2xl">
                        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                            <DialogHeader>
                                <DialogTitle className="text-base font-semibold text-slate-900  text-center">
                                    {editingAddress ? "Edit Address" : "Add New Address"}
                                </DialogTitle>
                            </DialogHeader>
                        </div>
                        <div className="p-6 pb-8">
                            <AddressForm
                                initialData={editingAddress}
                                onSuccess={() => setIsDialogOpen(false)}
                                onCancel={() => setIsDialogOpen(false)}
                            />
                        </div>
                    </DialogContent>
                </Dialog>

                <main className="px-4 py-6 max-w-4xl mx-auto space-y-5 sm:px-6">

                    {/* Add New CTA */}
                    <button
                        onClick={handleCreate}
                        className="group w-full h-14 bg-white border border-[#e5ebe7] rounded-2xl flex items-center justify-center gap-4 hover:border-[#0b5c3e] hover:bg-emerald-50 transition-all active:scale-[0.98] shadow-sm"
                    >
                        <div className="w-10 h-10 bg-[#0b5c3e] rounded-full flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                            <Plus className="h-5 w-5" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-semibold text-[#0b5c3e] ">Add a new address</span>
                    </button>

                    {deleteMutation.isError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">We couldn’t delete that address. Please try again.</p>}
                    {/* Address Cards */}
                    <div className="space-y-4">
                        {addresses?.map((addr: Address, idx: number) => (
                            <div
                                key={addr.id}
                                className={cn(
                                    "bg-white rounded-2xl p-5 border shadow-sm transition-all duration-300",
                                    addr.isDefault ? "border-emerald-200 shadow-emerald-100/60" : "border-slate-100",
                                    deletingId === addr.id ? "opacity-50 scale-95" : "opacity-100"
                                )}
                                style={{ animationDelay: `${idx * 80}ms` }}
                            >
                                {/* Top row */}
                                <div className="flex flex-wrap items-start gap-3">
                                    {/* Icon */}
                                    <div className={cn(
                                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                                        addr.isDefault
                                            ? "bg-emerald-50 text-[#0b5c3e] border border-emerald-200"
                                            : "bg-slate-50 text-slate-400 border border-slate-100"
                                    )}>
                                        <AddressTypeIcon type={addr.type} />
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-[140px]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-semibold text-slate-900 ">{addr.type || "Home"}</h3>
                                            {addr.isDefault && (
                                                <span className="text-xs bg-[#0b5c3e] text-white font-semibold px-2 py-0.5 rounded-full r">
                                                    Primary
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-slate-500  leading-relaxed">
                                            {[addr.fullAddress, addr.city, addr.state].filter(Boolean).join(", ")}
                                        </p>
                                        {addr.landmark && (
                                            <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#0b5c3e] ">
                                                <Navigation className="h-3 w-3" />
                                                Near: {addr.landmark}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => handleEdit(addr)}
                                            aria-label={`Edit ${addr.type || "saved"} address`}
                                            className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#0b5c3e] hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-90"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(addr.id)}
                                            aria-label={`Delete ${addr.type || "saved"} address`}
                                            disabled={deletingId === addr.id}
                                            className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-300 hover:text-red-500 hover:border-red-300 transition-all active:scale-90 disabled:opacity-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Map Preview — shown for default or addresses with coords */}
                                <AddressMapPreview lat={addr.latitude} lng={addr.longitude} />
                            </div>
                        ))}

                        {/* Empty state */}
                        {addresses?.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 gap-5">
                                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center border border-emerald-100">
                                    <Map className="h-9 w-9 text-emerald-300" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-semibold text-slate-500 ">No Saved Addresses</p>
                                    <p className="text-xs text-slate-400 mt-1">Add your first delivery location above</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {(addresses?.length || 0) > 0 && (
                        <div className="pt-4 pb-2">
                            <div className="bg-white border border-emerald-100 rounded-2xl p-5 flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100">
                                    <Shield className="h-5 w-5 text-[#0b5c3e]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[#0b5c3e]  leading-none">Delivery addresses</p>
                                    <p className="text-xs text-slate-400 mt-1">Keep your address details up to date for your next order.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
