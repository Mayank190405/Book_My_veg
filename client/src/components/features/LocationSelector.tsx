"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { MapPin, Navigation, ChevronDown } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { getReverseGeocode } from "@/services/geocodingService";
import { cn } from "@/lib/utils";
import { getBaseURL } from "@/services/api";

interface LocationSelectorProps {
    isCompact?: boolean;
}

export default function LocationSelector({ isCompact }: LocationSelectorProps) {
    const { location, setLocation, setActiveStore } = useUserStore();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    const [mapCenter, setMapCenter] = useState({ lat: 19.9830, lng: 73.7702 });
    const [resolvedAddress, setResolvedAddress] = useState("");
    const [resolvedPincode, setResolvedPincode] = useState("");
    const [geoLoading, setGeoLoading] = useState(false);
    
    const mapRef = useRef<any>(null);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const NASHIK_AREAS = [
        { name: "College Road", lat: 19.9998, lng: 73.7621, pincode: "422005" },
        { name: "Jehan Circle", lat: 20.0121, lng: 73.7645, pincode: "422013" },
        { name: "Mahatma Nagar", lat: 19.9936, lng: 73.7548, pincode: "422005" },
        { name: "Canada Corner", lat: 19.9975, lng: 73.7718, pincode: "422001" },
        { name: "Serene Meadows", lat: 20.0245, lng: 73.7388, pincode: "422013" },
        { name: "Anandvalli", lat: 20.0194, lng: 73.7381, pincode: "422013" },
        { name: "Chandshi", lat: 20.0361, lng: 73.7352, pincode: "422013" },
        { name: "Thatte Nagar", lat: 20.0034, lng: 73.7662, pincode: "422005" },
        { name: "Bhosala Military School", lat: 20.0114, lng: 73.7552, pincode: "422005" },
        { name: "KTHM College District", lat: 20.0028, lng: 73.7739, pincode: "422002" },
        { name: "Sharanpur Road", lat: 19.9952, lng: 73.7741, pincode: "422001" },
        { name: "Krishi Nagar", lat: 19.9958, lng: 73.7589, pincode: "422005" },
        { name: "D'Souza Colony", lat: 19.9984, lng: 73.7651, pincode: "422005" },
        { name: "Pathardi Phata", lat: 19.9482, lng: 73.7749, pincode: "422010" },
        { name: "Indira Nagar", lat: 19.9678, lng: 73.7915, pincode: "422009" },
        { name: "Govind Nagar", lat: 19.9830, lng: 73.7702, pincode: "422002" },
        { name: "Untwadi", lat: 19.9845, lng: 73.7634, pincode: "422002" },
        { name: "Trimurti Chowk", lat: 19.9725, lng: 73.7610, pincode: "422009" },
        { name: "Uttam Nagar", lat: 19.9711, lng: 73.7485, pincode: "422009" },
        { name: "Kamatwade", lat: 19.9664, lng: 73.7452, pincode: "422009" },
        { name: "Deepali Nagar", lat: 19.9681, lng: 73.7842, pincode: "422009" },
        { name: "Khutwad Nagar", lat: 19.9765, lng: 73.7531, pincode: "422009" },
        { name: "Rane Nagar", lat: 19.9572, lng: 73.7844, pincode: "422009" },
        { name: "Cidco Lekha Nagar", lat: 19.9694, lng: 73.7712, pincode: "422009" },
        { name: "Pawan Nagar", lat: 19.9748, lng: 73.7554, pincode: "422009" },
        { name: "Sambhaji Chowk", lat: 19.9691, lng: 73.7638, pincode: "422009" },
        { name: "Dwarka Circle", lat: 19.9882, lng: 73.7972, pincode: "422011" },
        { name: "Mumbai Naka", lat: 19.9818, lng: 73.7876, pincode: "422001" },
        { name: "Shalimar Chowk", lat: 19.9941, lng: 73.7845, pincode: "422001" },
        { name: "CBS (Central Bus Stand)", lat: 19.9964, lng: 73.7781, pincode: "422001" },
        { name: "Ashok Stambh", lat: 20.0012, lng: 73.7814, pincode: "422001" },
        { name: "Saraf Bazaar", lat: 19.9972, lng: 73.7881, pincode: "422001" },
        { name: "Ganjmal", lat: 19.9887, lng: 73.7864, pincode: "422001" },
        { name: "Ravivar Peth", lat: 19.9991, lng: 73.7892, pincode: "422001" },
        { name: "Main Road", lat: 19.9954, lng: 73.7861, pincode: "422001" },
        { name: "Bhadrakali", lat: 19.9928, lng: 73.7894, pincode: "422001" },
        { name: "Multanpura", lat: 19.9961, lng: 73.7932, pincode: "422001" },
        { name: "Ramkund", lat: 20.0084, lng: 73.7958, pincode: "422003" },
        { name: "Nimani", lat: 20.0142, lng: 73.7981, pincode: "422003" },
        { name: "Mhasrul", lat: 20.0416, lng: 73.8012, pincode: "422004" },
        { name: "Adgaon", lat: 20.0354, lng: 73.8361, pincode: "422003" },
        { name: "Makhmalabad", lat: 20.0322, lng: 73.7744, pincode: "422003" },
        { name: "Peth Road", lat: 20.0191, lng: 73.7825, pincode: "422003" },
        { name: "Nandur Naka", lat: 20.0041, lng: 73.8294, pincode: "422003" },
        { name: "Panchak", lat: 19.9842, lng: 73.8341, pincode: "422003" },
        { name: "Hirawadi", lat: 20.0211, lng: 73.8122, pincode: "422003" },
        { name: "MERI Colony", lat: 20.0289, lng: 73.7964, pincode: "422003" },
        { name: "Katya Maruti", lat: 20.0061, lng: 73.8028, pincode: "422003" },
        { name: "Dindori Naka", lat: 20.0175, lng: 73.7941, pincode: "422003" },
        { name: "Sharadchandra Pawar Market", lat: 20.0165, lng: 73.8164, pincode: "422003" },
        { name: "Satpur MIDC", lat: 19.9944, lng: 73.7297, pincode: "422007" },
        { name: "Ambad MIDC", lat: 19.9495, lng: 73.7331, pincode: "422010" },
        { name: "NICE Area", lat: 19.9881, lng: 73.7364, pincode: "422007" },
        { name: "Vilholi", lat: 19.9231, lng: 73.7128, pincode: "422010" },
        { name: "Symbiosis Campus", lat: 19.9798, lng: 73.7224, pincode: "422010" },
        { name: "Trimbak Naka", lat: 19.9931, lng: 73.7758, pincode: "422001" },
        { name: "Papaya Circle", lat: 19.9415, lng: 73.7289, pincode: "422010" },
        { name: "Nashik Road Terminal", lat: 19.9634, lng: 73.8378, pincode: "422101" },
        { name: "Jail Road", lat: 19.9752, lng: 73.8415, pincode: "422101" },
        { name: "Deolali Camp", lat: 19.9412, lng: 73.8436, pincode: "422101" },
        { name: "Bytco Point", lat: 19.9578, lng: 73.8306, pincode: "422101" },
        { name: "Upanagar", lat: 19.9741, lng: 73.8189, pincode: "422006" },
        { name: "Shinde Gaon", lat: 19.9194, lng: 73.8702, pincode: "422102" },
        { name: "Gandhinagar Airport", lat: 19.9684, lng: 73.8152, pincode: "422006" },
        { name: "Deolali Gaon", lat: 19.9511, lng: 73.8398, pincode: "422101" }
    ];

    const getFallbackArea = (lat: number, lng: number) => {
        let nearestArea = NASHIK_AREAS[0];
        let minDistance = Infinity;
        
        NASHIK_AREAS.forEach(area => {
            const dist = calculateDistance(lat, lng, area.lat, area.lng);
            if (dist < minDistance) {
                minDistance = dist;
                nearestArea = area;
            }
        });
        
        return nearestArea;
    };

    // Load Leaflet dynamically on mount or open
    useEffect(() => {
        if (!open) return;

        if ((window as any).L) {
            setIsMapLoaded(true);
            return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
            setIsMapLoaded(true);
        };

        return () => {
            // Leave Leaflet scripts cached for fast reopening
        };
    }, [open]);

    // Initialize Map Instance
    useEffect(() => {
        if (!open || !isMapLoaded) return;

        const timer = setTimeout(() => {
            const L = (window as any).L;
            if (!L) return;

            const mapEl = document.getElementById("map-container");
            if (!mapEl) return;

            // Resolve starting coordinates
            const initialLat = location?.coords?.lat || 19.9830;
            const initialLng = location?.coords?.lng || 73.7702;

            setMapCenter({ lat: initialLat, lng: initialLng });

            // Clean up old instance if any
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }

            const map = L.map("map-container", {
                zoomControl: false,
                attributionControl: false
            }).setView([initialLat, initialLng], 15);

            L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
                maxZoom: 19
            }).addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);
            mapRef.current = map;

            // Resolve initial address
            resolveAddress(initialLat, initialLng);

            // Bind moveend event with a debounced reverse lookup
            let debounceTimer: any;
            map.on("moveend", () => {
                const center = map.getCenter();
                setMapCenter({ lat: center.lat, lng: center.lng });
                
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    resolveAddress(center.lat, center.lng);
                }, 400);
            });
        }, 150);

        return () => {
            clearTimeout(timer);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [open, isMapLoaded]);

    const resolveAddress = async (lat: number, lng: number) => {
        setGeoLoading(true);
        try {
            const geoResult = await getReverseGeocode(lat, lng);
            if (geoResult) {
                const context = (geoResult as any).context || [];
                const serverArea = context.find((c: any) => c.id === "area")?.text;
                const serverPincode = context.find((c: any) => c.id === "pincode")?.text;

                const parts = geoResult.place_name.split(",");
                const area = serverArea || parts[0].trim();
                const pincodeMatch = geoResult.place_name.match(/\b\d{6}\b/);
                const foundPincode = serverPincode || (pincodeMatch ? pincodeMatch[0] : "");

                setResolvedAddress(foundPincode === "422002" ? "Govind Nagar" : area);
                setResolvedPincode(foundPincode);
            } else {
                setResolvedAddress("Unknown Location");
                setResolvedPincode("");
            }
        } catch (error) {
            console.error("Reverse geocoding error:", error);
            const fallback = getFallbackArea(lat, lng);
            setResolvedAddress(fallback.name);
            setResolvedPincode(fallback.pincode);
        } finally {
            setGeoLoading(false);
        }
    };

    const handleAutoDetect = () => {
        setLoading(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    if (mapRef.current) {
                        mapRef.current.setView([latitude, longitude], 16);
                    } else {
                        setMapCenter({ lat: latitude, lng: longitude });
                        resolveAddress(latitude, longitude);
                    }
                    setLoading(false);
                    toast.success("Location centered on GPS position!");
                },
                (error) => {
                    console.error("GPS detection error:", error);
                    setLoading(false);
                    toast.error("Could not access device GPS.");
                }
            );
        } else {
            setLoading(false);
            toast.error("GPS geolocation is not supported by your browser.");
        }
    };

    const handleConfirmLocation = async () => {
        setLoading(true);
        try {
            const lat = mapCenter.lat;
            const lng = mapCenter.lng;

            // Fetch physical stores for proximity hub routing
            const apiUrl = getBaseURL();
            const storesRes = await (await fetch(`${apiUrl}/locations`)).json();
            
            let nearestStore = null;
            if (storesRes && storesRes.length > 0) {
                let minDistance = Infinity;
                storesRes.forEach((store: any) => {
                    if (store.latitude && store.longitude) {
                        const dist = calculateDistance(lat, lng, store.latitude, store.longitude);
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearestStore = store;
                        }
                    }
                });
            }

            if (nearestStore) {
                setActiveStore({
                    id: (nearestStore as any).id,
                    slug: (nearestStore as any).slug,
                    name: (nearestStore as any).name
                });
            }

            setLocation({
                address: resolvedAddress || "Govind Nagar",
                pincode: resolvedPincode || "422002",
                coords: { lat, lng }
            });

            toast.success(`Connected to ${resolvedAddress}!`);
            setOpen(false);
        } catch (error) {
            console.error("Proximity store search failed:", error);
            toast.error("Error setting nearest vegetable store.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer active:scale-95 transition-all duration-500 group select-none">
                    {!isCompact && (
                        <div className="">
                            <MapPin className="h-8 w-8 stroke-[2.5] text-emerald-800 dark:text-emerald-400" />
                        </div>
                    )}
                    
                    <div className="flex flex-col text-left">
                        {!isCompact && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 leading-none">DELIVERING TO</span>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                            <h2 className={cn(
                                "font-extrabold text-slate-700 dark:text-slate-200 leading-none tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1",
                                isCompact ? "text-sm" : "text-base"
                            )}>
                                {isCompact && <MapPin className="inline h-4 w-4 mb-0.5 text-emerald-700 dark:text-emerald-400" />}
                                {location?.address === "Select Location" || !location?.address ? "Set Location" : location.address}
                            </h2>
                            <ChevronDown className={cn("text-emerald-700 dark:text-emerald-400 stroke-[3] shrink-0", isCompact ? "h-3.5 w-3.5 text-slate-400 dark:text-white/40" : "h-4.5 w-4.5")} />
                        </div>
                        {!isCompact && (
                            <span className="text-[9px] font-black tracking-wider uppercase text-emerald-700 dark:text-emerald-400/80 leading-none mt-0.5">
                                ZONE - {location?.pincode || "422002"}
                            </span>
                        )}
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="w-[92vw] sm:max-w-xl h-[80vh] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[2.5rem] border border-border bg-card shadow-2xl p-0 overflow-hidden flex flex-col">
                <div className="relative h-16 bg-primary flex items-center px-6 shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-black/20" />
                    <MapPin className="h-12 w-12 text-white/10 absolute -right-4 -bottom-4 rotate-12" />
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-primary-foreground uppercase tracking-tight">Choose delivery location</DialogTitle>
                    </DialogHeader>
                </div>
                
                <div className="flex-1 w-full relative bg-muted">
                    {!isMapLoaded ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-foreground/30 z-20 bg-muted">
                            <Navigation className="h-8 w-8 animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Loading Map...</span>
                        </div>
                    ) : (
                        <div id="map-container" className="w-full h-full z-10" />
                    )}

                    {/* Centered static pin marker */}
                    {isMapLoaded && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(100%-4px)] z-[1000] pointer-events-none flex flex-col items-center">
                            <div className="bg-emerald-600 text-white rounded-full p-2.5 shadow-xl border-2 border-white">
                                <MapPin className="h-6 w-6 stroke-[3]" />
                            </div>
                            <div className="w-3 h-3 bg-emerald-950/20 rounded-full border border-white/50 -mt-1.5 blur-[1px]" />
                        </div>
                    )}

                    {/* Floating Geolocation Button (Small & Clean) */}
                    {isMapLoaded && (
                        <button
                            type="button"
                            className="absolute bottom-4 right-4 z-[1001] w-12 h-12 bg-white hover:bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all text-emerald-600"
                            onClick={handleAutoDetect}
                            disabled={loading}
                            title="Detect my position"
                        >
                            <Navigation className={cn("h-5 w-5", loading && "animate-pulse")} />
                        </button>
                    )}
                </div>

                <div className="p-6 bg-card border-t border-border shrink-0 space-y-4">
                    {/* Detect Current Location Text Button */}
                    <button
                        type="button"
                        onClick={handleAutoDetect}
                        disabled={loading}
                        className="w-full flex items-center gap-2 justify-center py-2.5 text-[11px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-500/10 rounded-xl transition-all uppercase tracking-wider active:scale-95 shrink-0"
                    >
                        <Navigation className={cn("h-3.5 w-3.5", loading && "animate-pulse")} />
                        {loading ? "Accessing GPS..." : "Detect Current Location"}
                    </button>

                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-emerald-600/10 rounded-2xl text-emerald-600 shrink-0">
                            <MapPin className="h-5 w-5 stroke-[2.5]" />
                        </div>
                        <div className="space-y-1 text-left min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Selected Address</span>
                            {geoLoading ? (
                                <div className="h-8 flex items-center">
                                    <span className="text-xs text-foreground/40 font-bold uppercase tracking-wider animate-pulse">Resolving location...</span>
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    <h4 className="text-sm font-extrabold text-foreground truncate">
                                        {resolvedAddress || "Move pin to select"}
                                    </h4>
                                    {resolvedPincode && (
                                        <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider">
                                            Zone / Pincode: {resolvedPincode}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 bg-primary hover:bg-primary/95 text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-primary/20"
                        onClick={handleConfirmLocation}
                        disabled={geoLoading || loading || !resolvedAddress}
                    >
                        Confirm Location
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
