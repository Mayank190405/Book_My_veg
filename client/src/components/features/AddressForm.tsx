"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MapPin, Navigation, Map } from "lucide-react";
import { createAddress, updateAddress, Address } from "@/services/addressService";
import { useQueryClient } from "@tanstack/react-query";
import { reverseGeocode } from "@/services/geocoding";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

interface AddressFormProps {
    initialData?: Address;
    onSuccess: () => void;
    onCancel: () => void;
}

// Leaflet CDN URLs
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

export default function AddressForm({ initialData, onSuccess, onCancel }: AddressFormProps) {
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const queryClient = useQueryClient();
    const { user } = useUserStore();

    const [formData, setFormData] = useState({
        type: initialData?.type || "HOME",
        name: initialData?.name || (user?.name !== "Guest" ? user?.name : "") || "",
        phone: initialData?.phone || user?.phone || "",
        fullAddress: initialData?.fullAddress || "",
        landmark: initialData?.landmark || "",
        city: initialData?.city || "",
        state: initialData?.state || "",
        pincode: initialData?.pincode || "",
        latitude: initialData?.latitude || null,
        longitude: initialData?.longitude || null,
        isDefault: initialData?.isDefault || false,
    });

    useEffect(() => {
        if (user && !initialData) {
            setFormData(prev => ({
                ...prev,
                name: prev.name || (user.name !== "Guest" ? user.name : "") || "",
                phone: prev.phone || user.phone || ""
            }));
        }
    }, [user, initialData]);

    // Leaflet map refs
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markerInstance = useRef<any>(null);
    const [leafletLoaded, setLeafletLoaded] = useState(false);

    // Dynamic Leaflet Loader
    useEffect(() => {
        if (typeof window === "undefined") return;

        if ((window as any).L) {
            setLeafletLoaded(true);
            return;
        }

        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href = LEAFLET_CSS_URL;
        document.head.appendChild(cssLink);

        const jsScript = document.createElement("script");
        jsScript.src = LEAFLET_JS_URL;
        jsScript.async = true;
        jsScript.onload = () => {
            setLeafletLoaded(true);
        };
        document.body.appendChild(jsScript);
    }, []);

    // Initialize Map
    useEffect(() => {
        if (!leafletLoaded || !mapRef.current || typeof window === "undefined") return;
        const L = (window as any).L;
        if (!L) return;

        const defaultLat = formData.latitude || 19.0760; // Mumbai default
        const defaultLng = formData.longitude || 72.8777;

        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }

        const map = L.map(mapRef.current, {
            center: [defaultLat, defaultLng],
            zoom: 13,
            zoomControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        }).addTo(map);

        const customIcon = L.icon({
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
        });

        const marker = L.marker([defaultLat, defaultLng], {
            draggable: true,
            icon: customIcon,
        }).addTo(map);

        marker.on("dragend", async () => {
            const position = marker.getLatLng();
            const { lat, lng } = position;
            setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
            await handleLocationDetails(lat, lng);
        });

        map.on("click", async (e: any) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
            await handleLocationDetails(lat, lng);
        });

        mapInstance.current = map;
        markerInstance.current = marker;

        setTimeout(() => {
            map.invalidateSize();
        }, 150);

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [leafletLoaded]);

    const handleLocationDetails = async (lat: number, lng: number) => {
        try {
            const result = await reverseGeocode(lat, lng);
            if (result) {
                setFormData(prev => ({
                    ...prev,
                    fullAddress: result.street || result.fullAddress,
                    city: result.city,
                    state: result.state,
                    pincode: result.pincode,
                }));
            }
        } catch (err) {
            console.error("Geocoding failed:", err);
        }
    };

    const handleGeolocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setFormData(prev => ({ ...prev, latitude, longitude }));

                if (mapInstance.current && markerInstance.current) {
                    mapInstance.current.setView([latitude, longitude], 15);
                    markerInstance.current.setLatLng([latitude, longitude]);
                }

                await handleLocationDetails(latitude, longitude);
                toast.success("Location matched successfully!");
                setLocating(false);
            },
            (error) => {
                console.error(error);
                toast.error("Unable to retrieve location settings.");
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
            toast.success(initialData ? "Address updated" : "Address saved successfully");
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save address");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#f8faf9] text-slate-800 overflow-hidden animate-slide-up flex flex-col w-full">
            {/* Elegant Light Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 shadow-sm">
                        <MapPin className="h-6 w-6 text-[#0b5c3e]" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Delivery Address</h2>
                        <p className="text-[10px] font-black text-[#0b5c3e] uppercase tracking-widest mt-0.5">Where should we deliver?</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-hide flex-1">
                
                {/* Geolocation Button */}
                <button
                    type="button"
                    onClick={handleGeolocation}
                    disabled={locating}
                    className="w-full h-13 bg-white border border-emerald-100 text-[#0b5c3e] rounded-full flex items-center justify-center gap-2.5 hover:bg-emerald-50/50 transition-all active:scale-[0.98] shadow-sm"
                >
                    {locating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#0b5c3e]" />
                    ) : (
                        <Navigation className="h-4 w-4 text-[#0b5c3e] rotate-45" />
                    )}
                    <span className="font-bold text-xs uppercase tracking-widest">
                        {locating ? "Locating..." : "Use Current Location"}
                    </span>
                </button>

                {/* Map Container */}
                <div className="relative rounded-[2rem] overflow-hidden border border-slate-200/80 shadow-sm bg-slate-100">
                    <div ref={mapRef} className="h-48 w-full z-10" />
                    <div className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-slate-100 pointer-events-none shadow-sm">
                        <Map className="w-3.5 h-3.5 text-[#0b5c3e]" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-700">Interactive Map</span>
                    </div>
                </div>

                {/* Grid inputs */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-widest font-black text-slate-400 ml-1">Recipient Name</Label>
                        <Input
                            placeholder="John Doe"
                            className="h-13 bg-white border-slate-200 rounded-2xl focus:border-[#0b5c3e] focus:ring-1 focus:ring-[#0b5c3e]/20 transition-all text-slate-800 placeholder:text-slate-300 text-xs px-4"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-widest font-black text-slate-400 ml-1">Phone Number</Label>
                        <Input
                            placeholder="+91 00000 00000"
                            className="h-13 bg-white border-slate-200 rounded-2xl focus:border-[#0b5c3e] focus:ring-1 focus:ring-[#0b5c3e]/20 transition-all text-slate-800 placeholder:text-slate-300 text-xs px-4"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[9px] uppercase tracking-widest font-black text-slate-400 ml-1">Flat / House / Area</Label>
                    <Input
                        placeholder="House No. 123, Green Valley"
                        className="h-13 bg-white border-slate-200 rounded-2xl focus:border-[#0b5c3e] focus:ring-1 focus:ring-[#0b5c3e]/20 transition-all text-slate-800 placeholder:text-slate-300 text-xs px-4"
                        value={formData.fullAddress}
                        onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[9px] uppercase tracking-widest font-black text-slate-400 ml-1">Landmark (Optional)</Label>
                    <Input
                        placeholder="e.g. Near City Park"
                        className="h-13 bg-white border-slate-200 rounded-2xl focus:border-[#0b5c3e] focus:ring-1 focus:ring-[#0b5c3e]/20 transition-all text-slate-800 placeholder:text-slate-300 text-xs px-4"
                        value={formData.landmark}
                        onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-widest font-black text-slate-400 ml-1">Pincode</Label>
                        <Input
                            placeholder="400001"
                            maxLength={6}
                            className="h-13 bg-white border-slate-200 rounded-2xl focus:border-[#0b5c3e] focus:ring-1 focus:ring-[#0b5c3e]/20 transition-all text-slate-800 placeholder:text-slate-300 text-xs px-4"
                            value={formData.pincode}
                            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-widest font-black text-slate-400 ml-1">City</Label>
                        <Input
                            placeholder="Mumbai"
                            className="h-13 bg-white border-slate-200 rounded-2xl focus:border-[#0b5c3e] focus:ring-1 focus:ring-[#0b5c3e]/20 transition-all text-slate-800 placeholder:text-slate-300 text-xs px-4"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            required
                        />
                    </div>
                </div>

                {/* Save As Selection (Match tabs) */}
                <div className="space-y-2">
                    <Label className="text-[9px] uppercase tracking-widest font-black text-slate-400 ml-1">Save As</Label>
                    <div className="flex gap-2.5">
                        {["HOME", "OFFICE", "OTHER"].map((type) => (
                            <button
                                key={type}
                                type="button"
                                className={cn(
                                    "flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                    formData.type === type
                                        ? "bg-[#0b5c3e] text-white border-transparent shadow-[0_4px_12px_rgba(11,92,62,0.15)]"
                                        : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
                                )}
                                onClick={() => setFormData({ ...formData, type })}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Set as Primary Checkbox */}
                <div className="flex items-center space-x-3 bg-white p-4 rounded-[1.5rem] border border-slate-200/60 shadow-sm">
                    <Checkbox
                        id="isDefault"
                        className="border-slate-300 data-[state=checked]:bg-[#0b5c3e] data-[state=checked]:border-[#0b5c3e]"
                        checked={formData.isDefault}
                        onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked as boolean })}
                    />
                    <Label htmlFor="isDefault" className="text-[11px] font-bold text-slate-600 cursor-pointer">Set as primary address</Label>
                </div>
            </form>

            {/* Sticky/Fixed Footer Actions */}
            <div className="px-6 py-6 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
                <button
                    type="button"
                    className="flex-1 h-13 rounded-full text-slate-400 hover:text-slate-600 font-black uppercase tracking-[0.2em] text-[10px]"
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <Button
                    type="submit"
                    className="flex-1 h-13 bg-[#0b5c3e] hover:bg-[#094d34] text-white rounded-full font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_4px_16px_rgba(11,92,62,0.2)] transition-all active:scale-95 disabled:opacity-50"
                    disabled={loading}
                    onClick={handleSubmit}
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Address
                </Button>
            </div>
        </div>
    );
}
