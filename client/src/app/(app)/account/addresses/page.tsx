"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAddresses, deleteAddress, Address } from "@/services/addressService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Trash2, Edit2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AddressForm from "@/components/features/AddressForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AddressesPage() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | undefined>(undefined);

    const { data: addresses, isLoading } = useQuery({
        queryKey: ["addresses"],
        queryFn: getAddresses,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAddress,
        onSuccess: () => {
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

    if (isLoading) return <Skeleton className="w-full h-screen" />;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/account">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <h1 className="text-xl font-bold">Saved Addresses</h1>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingAddress ? "Edit Address" : "Add New Address"}</DialogTitle>
                    </DialogHeader>
                    <AddressForm
                        initialData={editingAddress}
                        onSuccess={() => setIsDialogOpen(false)}
                        onCancel={() => setIsDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <Button className="w-full dashed border-2 bg-transparent text-primary hover:bg-primary/5" onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add New Address
            </Button>

            <div className="space-y-4">
                {addresses?.map((addr: Address) => (
                    <div key={addr.id} className="bg-white p-4 rounded-lg shadow-sm border relative group">
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${addr.isDefault ? "bg-green-100" : "bg-gray-100"}`}>
                                <MapPin className={`h-5 w-5 ${addr.isDefault ? "text-green-600" : "text-gray-500"}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold flex items-center gap-2">
                                        {addr.type}
                                        {addr.isDefault && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>}
                                    </h3>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEdit(addr)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteMutation.mutate(addr.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{addr.fullAddress}</p>
                                {addr.landmark && <p className="text-xs text-gray-500 mt-0.5">Landmark: {addr.landmark}</p>}
                            </div>
                        </div>
                    </div>
                ))}

                {addresses?.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        No saved addresses found.
                    </div>
                )}
            </div>
        </div>
    );
}
