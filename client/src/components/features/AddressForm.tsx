"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { createAddress, updateAddress, Address } from "@/services/addressService";
import { useQueryClient } from "@tanstack/react-query";
import { reverseGeocode } from "@/services/geocoding";
import { toast } from "sonner";

interface AddressFormProps {
    initialData?: Address;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function AddressForm({ initialData, onSuccess, onCancel }: AddressFormProps) {
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false); // For geolocation loading state
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        type: initialData?.type || "HOME",
        name: initialData?.name || "",
        phone: initialData?.phone || "",
        fullAddress: initialData?.fullAddress || "", // Street/Area/House No
        landmark: initialData?.landmark || "",
        city: initialData?.city || "",
        state: initialData?.state || "",
        pincode: initialData?.pincode || "",
        latitude: initialData?.latitude || null,
        longitude: initialData?.longitude || null,
        isDefault: initialData?.isDefault || false,
    });

    const handleGeolocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const result = await reverseGeocode(latitude, longitude);
                    if (result) {
                        setFormData(prev => ({
                            ...prev,
                            fullAddress: result.street || result.fullAddress, // Prefer specific street if available
                            city: result.city,
                            state: result.state,
                            pincode: result.pincode,
                            latitude,
                            longitude
                        }));
                        toast.success("Location detected!");
                    } else {
                        toast.error("Could not fetch address details.");
                    }
                } catch (err) {
                    console.error(err);
                    toast.error("Failed to reverse geocode.");
                } finally {
                    setLocating(false);
                }
            },
            (error) => {
                console.error(error);
                toast.error("Unable to retrieve your location.");
                setLocating(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!formData.name || !formData.phone || !formData.pincode || !formData.city || !formData.fullAddress) {
            toast.error("Please fill all required fields");
            setLoading(false);
            return;
        }

        const payload = {
            ...formData,
            latitude: formData.latitude ?? undefined,
            longitude: formData.longitude ?? undefined,
        };

        try {
            if (initialData) {
                await updateAddress(initialData.id, payload);
            } else {
                await createAddress(payload);
            }
            queryClient.invalidateQueries({ queryKey: ["addresses"] });
            toast.success(initialData ? "Address updated" : "Address added successfully");
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save address");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            {/* Geolocation Button */}
            <Button
                type="button"
                variant="outline"
                className="w-full border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                onClick={handleGeolocation}
                disabled={locating}
            >
                {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4 fill-green-700" />}
                Use Current Location
            </Button>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                        placeholder="Recipient Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input
                        placeholder="Mobile Number"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Pincode *</Label>
                <div className="flex gap-2">
                    <Input
                        placeholder="6-digit pincode"
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        maxLength={6}
                        required
                    />
                    {/* Mock Check Availability Button if we had logic */}
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-green-600">Check</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>City *</Label>
                    <Input
                        placeholder="City"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label>State *</Label>
                    <Input
                        placeholder="State"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Flat, House no., Building, Company, Apartment *</Label>
                <Input
                    placeholder=""
                    value={formData.fullAddress}
                    onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label>Landmark (Optional)</Label>
                <Input
                    placeholder="E.g. Near Apollo Hospital"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label>Address Type</Label>
                <div className="flex gap-2">
                    {["HOME", "OFFICE", "OTHER"].map((type) => (
                        <div
                            key={type}
                            className={`flex-1 p-2 border rounded-md text-center text-sm cursor-pointer transition-colors ${formData.type === type ? 'bg-green-50 border-green-500 font-medium text-green-700' : 'hover:bg-gray-50'}`}
                            onClick={() => setFormData({ ...formData, type })}
                        >
                            {type.charAt(0) + type.slice(1).toLowerCase()}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked as boolean })}
                />
                <Label htmlFor="isDefault" className="cursor-pointer">Set as default address</Label>
            </div>

            <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
                <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {initialData ? "Update Address" : "Save Address"}
                </Button>
            </div>
        </form>
    );
}
