"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
    MapPin,
    Navigation,
    ChevronDown,
    ChevronRight,
    X,
    Search,
    Sparkles,
    Check,
    Crosshair,
    Building2,
    Loader2,
    Zap,
    Home,
    Briefcase,
    Plus,
    MoreHorizontal,
    Share2,
    Trash2,
    ArrowLeft
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { getReverseGeocode, getAutocompleteSuggestions, GeocodingFeature } from "@/services/geocodingService";
import { getAddresses, createAddress, deleteAddress, Address } from "@/services/addressService";
import { cn } from "@/lib/utils";
import { getBaseURL } from "@/services/api";

interface LocationSelectorProps {
    isCompact?: boolean;
    variant?: "default" | "hero";
}

export default function LocationSelector({ isCompact, variant = "default" }: LocationSelectorProps) {
    const { user, location, setLocation, setActiveStore } = useUserStore();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // View Mode: "list" (Zepto/Blinkit saved addresses & quick actions) vs "add" (smaller map & new address form)
    const [viewMode, setViewMode] = useState<"list" | "add">("list");

    // Saved addresses list
    const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
    const [addressLoading, setAddressLoading] = useState(false);

    // Precise Address State (Main Title + Detailed Secondary Address)
    const [mapCenter, setMapCenter] = useState({ lat: 20.0083, lng: 73.7452 });
    const [resolvedAddress, setResolvedAddress] = useState("Kale Nagar");
    const [resolvedSecondary, setResolvedSecondary] = useState("Kale Nagar, Anandvalli, Nashik");
    const [resolvedPincode, setResolvedPincode] = useState("422013");
    const [geoLoading, setGeoLoading] = useState(false);

    // Levels 4 & 5: Doorstep details (Flat / Floor & Gate entrance / Landmark)
    const [flatNo, setFlatNo] = useState("");
    const [landmarkNote, setLandmarkNote] = useState("");
    const [receiverPhone, setReceiverPhone] = useState(user?.phone || "");
    const [addressTag, setAddressTag] = useState<"Home" | "Work" | "Other">("Home");

    // Live Search Autocomplete State
    const [searchQuery, setSearchQuery] = useState("");
    const [liveSuggestions, setLiveSuggestions] = useState<GeocodingFeature[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const mapRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        loadSavedAddresses();
    }, []);

    // Load saved addresses from API or localStorage (No dummy/sample data)
    const loadSavedAddresses = async () => {
        setAddressLoading(true);
        try {
            let list: Address[] = [];
            try {
                list = await getAddresses();
            } catch (e) {
                // Ignore auth error for guest
            }
            if (!list || list.length === 0) {
                const local = localStorage.getItem("bookmyveg_saved_addresses");
                if (local) {
                    const parsed = JSON.parse(local);
                    // Filter out any previous sample seed addresses
                    list = Array.isArray(parsed) 
                        ? parsed.filter((a: Address) => 
                            !a.id?.includes("sheetal-villa") && 
                            !a.id?.includes("anand-heritage") && 
                            !a.id?.includes("sapshrungi")
                        ) 
                        : [];
                    localStorage.setItem("bookmyveg_saved_addresses", JSON.stringify(list));
                } else {
                    list = [];
                }
            } else {
                list = list.filter((a: Address) => 
                    !a.id?.includes("sheetal-villa") && 
                    !a.id?.includes("anand-heritage") && 
                    !a.id?.includes("sapshrungi")
                );
            }
            setSavedAddresses(list || []);
        } catch (err) {
            console.error("Failed to load saved addresses:", err);
            setSavedAddresses([]);
        } finally {
            setAddressLoading(false);
        }
    };

    // Prevent body scrolling when drawer is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            loadSavedAddresses();
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape") setOpen(false);
            };
            window.addEventListener("keydown", handleKeyDown);
            return () => {
                document.body.style.overflow = "";
                window.removeEventListener("keydown", handleKeyDown);
            };
        } else {
            document.body.style.overflow = "";
            setViewMode("list");
        }
    }, [open]);

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

    const formatDistance = (destLat?: number, destLng?: number) => {
        if (!destLat || !destLng) return "0 m";
        const currentLat = location?.coords?.lat || mapCenter.lat;
        const currentLng = location?.coords?.lng || mapCenter.lng;
        const distKm = calculateDistance(currentLat, currentLng, destLat, destLng);
        if (distKm < 0.1) return "0 m";
        if (distKm < 1.0) return `${Math.round(distKm * 1000)} m`;
        return `${distKm.toFixed(1)} km`;
    };

    const NASHIK_AREAS = [
        { name: "Kale Nagar", lat: 20.0083, lng: 73.7452, pincode: "422013", secondary: "Gangapur Road, Anandvalli, Nashik" },
        { name: "Canada Corner", lat: 19.9975, lng: 73.7718, pincode: "422001", secondary: "Sharanpur Road, Nashik" },
        { name: "College Road", lat: 19.9998, lng: 73.7621, pincode: "422005", secondary: "Near BYK & RYK College, Nashik" },
        { name: "Jehan Circle", lat: 20.0121, lng: 73.7645, pincode: "422013", secondary: "Gangapur Road, Nashik" },
        { name: "Serene Meadows", lat: 20.0245, lng: 73.7388, pincode: "422013", secondary: "Anandvalli, Gangapur Road, Nashik" },
        { name: "Govind Nagar", lat: 19.9830, lng: 73.7702, pincode: "422002", secondary: "Symbiosis School Road, Nashik" },
        { name: "Untwadi", lat: 19.9845, lng: 73.7634, pincode: "422002", secondary: "Near City Center Mall, Nashik" },
        { name: "Mahatma Nagar", lat: 19.9936, lng: 73.7548, pincode: "422005", secondary: "Cricket Ground & Jogging Track, Nashik" },
        { name: "Indira Nagar", lat: 19.9678, lng: 73.7915, pincode: "422009", secondary: "Rathchakra Chowk / Jogging Track, Nashik" },
        { name: "CIDCO", lat: 19.9685, lng: 73.7580, pincode: "422008", secondary: "Trimurti Chowk / Pawan Nagar, Nashik" },
        { name: "Ashoka Marg", lat: 19.9750, lng: 73.8120, pincode: "422006", secondary: "Kalpataru Nagar / Ashoka School, Nashik" },
        { name: "Panchavati", lat: 20.0084, lng: 73.7958, pincode: "422003", secondary: "Ramkund, Godavari River, Nashik" },
        { name: "Thatte Nagar", lat: 20.0034, lng: 73.7662, pincode: "422005", secondary: "College Road Cross, Nashik" },
        { name: "Pathardi Phata", lat: 19.9482, lng: 73.7749, pincode: "422010", secondary: "Mumbai-Agra Highway, Nashik" },
        { name: "Nashik Road", lat: 19.9634, lng: 73.8378, pincode: "422101", secondary: "Railway Station Terminal, Nashik" }
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

    // Live search debouncing
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.trim().length < 2) {
            setLiveSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const suggestions = await getAutocompleteSuggestions(searchQuery.trim());
                setLiveSuggestions(suggestions || []);
            } catch (err) {
                console.error("Search suggestions error:", err);
            } finally {
                setSearchLoading(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [searchQuery]);

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
    }, [open]);

    // Initialize Map Instance (Only when in "add" view mode)
    useEffect(() => {
        if (!open || !isMapLoaded || viewMode !== "add") return;

        const timer = setTimeout(() => {
            const L = (window as any).L;
            if (!L) return;

            const mapEl = document.getElementById("zomato-map-container");
            if (!mapEl) return;

            const initialLat = mapCenter.lat || location?.coords?.lat || 20.0083;
            const initialLng = mapCenter.lng || location?.coords?.lng || 73.7452;

            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }

            const map = L.map("zomato-map-container", {
                zoomControl: false,
                attributionControl: false
            }).setView([initialLat, initialLng], 16);

            // Watermark-free OpenStreetMap tiles
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19
            }).addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);
            mapRef.current = map;

            map.invalidateSize();

            resolveAddress(initialLat, initialLng);

            // Tap anywhere on map to pan and select location
            map.on("click", (e: any) => {
                if (e && e.latlng) {
                    map.panTo([e.latlng.lat, e.latlng.lng]);
                }
            });

            let debounceTimer: any;
            map.on("moveend", () => {
                const center = map.getCenter();
                setMapCenter({ lat: center.lat, lng: center.lng });

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    resolveAddress(center.lat, center.lng);
                }, 300);
            });
        }, 150);

        return () => {
            clearTimeout(timer);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [open, isMapLoaded, viewMode]);

    // High Precision Reverse Geocode
    const resolveAddress = async (lat: number, lng: number) => {
        setGeoLoading(true);
        try {
            const geoResult = await getReverseGeocode(lat, lng);
            if (geoResult) {
                const mainTitle = geoResult.main_title ||
                    geoResult.context?.find(c => c.id === "area")?.text ||
                    geoResult.place_name.split(",")[0].trim();

                const secondary = geoResult.secondary_text ||
                    geoResult.context?.find(c => c.id === "secondary")?.text ||
                    geoResult.place_name;

                const pincode = geoResult.pincode ||
                    geoResult.context?.find(c => c.id === "pincode")?.text ||
                    (geoResult.place_name.match(/\b\d{6}\b/) ? geoResult.place_name.match(/\b\d{6}\b/)![0] : "");

                setResolvedAddress(mainTitle);
                setResolvedSecondary(secondary);
                setResolvedPincode(pincode);
            } else {
                const fallback = getFallbackArea(lat, lng);
                setResolvedAddress(fallback.name);
                setResolvedSecondary(fallback.secondary);
                setResolvedPincode(fallback.pincode);
            }
        } catch (error) {
            const fallback = getFallbackArea(lat, lng);
            setResolvedAddress(fallback.name);
            setResolvedSecondary(fallback.secondary);
            setResolvedPincode(fallback.pincode);
        } finally {
            setGeoLoading(false);
        }
    };

    // Selecting a quick chip area
    const handleSelectArea = (area: typeof NASHIK_AREAS[0]) => {
        setMapCenter({ lat: area.lat, lng: area.lng });
        setResolvedAddress(area.name);
        setResolvedSecondary(area.secondary);
        setResolvedPincode(area.pincode);
        if (mapRef.current) {
            mapRef.current.setView([area.lat, area.lng], 16);
        }
    };

    // Selecting a live search suggestion
    const handleSelectSuggestion = (item: GeocodingFeature) => {
        const [lng, lat] = item.center;
        setMapCenter({ lat, lng });
        const mainTitle = item.main_title || item.place_name.split(",")[0].trim();
        const secondary = item.secondary_text || item.place_name;
        const pincode = item.pincode || (item.place_name.match(/\b\d{6}\b/) ? item.place_name.match(/\b\d{6}\b/)![0] : "");

        setResolvedAddress(mainTitle);
        setResolvedSecondary(secondary);
        setResolvedPincode(pincode);
        setSearchQuery("");
        setLiveSuggestions([]);

        // Switch to add mode to allow fine-tuning pin & entering flat details
        setViewMode("add");

        if (mapRef.current) {
            mapRef.current.setView([lat, lng], 17);
        }
    };

    // Auto detect GPS position with high accuracy
    const handleAutoDetect = () => {
        setLoading(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    setMapCenter({ lat: latitude, lng: longitude });
                    if (mapRef.current) {
                        mapRef.current.setView([latitude, longitude], 17);
                    }
                    await resolveAddress(latitude, longitude);
                    setLoading(false);
                    toast.success("Location locked with GPS sensor!");
                },
                (error) => {
                    console.error("GPS detection error:", error);
                    setLoading(false);
                    toast.error("Could not access device GPS sensor.");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            setLoading(false);
            toast.error("GPS geolocation is not supported by your browser.");
        }
    };

    // Route nearest store
    const routeNearestStore = async (lat: number, lng: number) => {
        try {
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
        } catch (err) {
            console.error("Nearest store search error:", err);
        }
    };

    // Direct selection of an existing saved address
    const handleSelectSavedAddress = async (addr: Address) => {
        const lat = addr.latitude || 20.0083;
        const lng = addr.longitude || 73.7452;

        await routeNearestStore(lat, lng);

        const cleanArea = addr.fullAddress.split(",")[0] || addr.type || "Home";
        setLocation({
            address: cleanArea,
            pincode: addr.pincode || "422013",
            coords: { lat, lng },
            secondary: addr.fullAddress
        });

        toast.success(`Delivering to ${addr.type}: ${cleanArea} 🥬`);
        setOpen(false);
    };

    // Delete a saved address
    const handleDeleteAddress = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            try {
                await deleteAddress(id);
            } catch (err) {
                // Ignore API error for guest/local
            }
            const updated = savedAddresses.filter(a => a.id !== id);
            setSavedAddresses(updated);
            localStorage.setItem("bookmyveg_saved_addresses", JSON.stringify(updated));
            toast.success("Address removed");
        } catch (err) {
            toast.error("Could not remove address");
        }
    };

    // Save New Address from "add" mode
    const handleSaveNewAddress = async () => {
        setLoading(true);
        try {
            const lat = mapCenter.lat;
            const lng = mapCenter.lng;

            await routeNearestStore(lat, lng);

            const completeFullAddress = [
                flatNo.trim(),
                landmarkNote.trim(),
                resolvedAddress,
                resolvedSecondary,
                resolvedPincode ? `PIN: ${resolvedPincode}` : ""
            ].filter(Boolean).join(", ");

            const newAddrPayload: Omit<Address, "id"> = {
                type: addressTag,
                fullAddress: completeFullAddress || `${resolvedAddress}, Nashik`,
                landmark: landmarkNote.trim() || undefined,
                city: "Nashik",
                pincode: resolvedPincode || "422013",
                phone: receiverPhone.trim() || user?.phone || "",
                latitude: lat,
                longitude: lng,
                isDefault: savedAddresses.length === 0
            };

            let createdId = `addr-${Date.now()}`;
            try {
                const res = await createAddress(newAddrPayload);
                if (res && res.id) createdId = res.id;
            } catch (apiErr) {
                // Fallback for guest
            }

            const newSavedItem: Address = {
                id: createdId,
                ...newAddrPayload
            };

            const updatedList = [newSavedItem, ...savedAddresses];
            setSavedAddresses(updatedList);
            localStorage.setItem("bookmyveg_saved_addresses", JSON.stringify(updatedList));

            setLocation({
                address: resolvedAddress || "Kale Nagar",
                pincode: resolvedPincode || "422013",
                coords: { lat, lng },
                secondary: resolvedSecondary || `${resolvedAddress || "Nashik"}, Maharashtra`
            });

            toast.success(`Address saved! Delivering to ${resolvedAddress} 🥬`);
            setOpen(false);
            setViewMode("list");
        } catch (error) {
            console.error("Save address error:", error);
            toast.error("Error saving delivery address.");
        } finally {
            setLoading(false);
        }
    };

    // DRAWER PORTAL CONTENT
    const drawerPortal = (mounted && open) ? (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end">
            {/* Backdrop Blur */}
            <div
                onClick={() => setOpen(false)}
                className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            />

            {/* Bottom Sheet Drawer Container */}
            <div className="relative z-[410] w-full max-w-lg mx-auto bg-white dark:bg-[#18191e] text-slate-900 dark:text-white rounded-t-[2.2rem] shadow-[0_-20px_80px_rgba(0,0,0,0.6)] border-t border-slate-200 dark:border-white/10 flex flex-col max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom duration-300 ease-out">

                {/* Pull Bar */}
                <div className="w-full flex justify-center pt-2.5 pb-1 shrink-0">
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/20 rounded-full" />
                </div>

                {/* Drawer Header (Exact Match to Screenshot: Down chevron on left + "Select a location") */}
                <div className="px-5 pt-2 pb-3 shrink-0 flex items-center gap-3 border-b border-slate-100 dark:border-white/5">
                    {viewMode === "add" ? (
                        <button
                            type="button"
                            onClick={() => setViewMode("list")}
                            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/15 transition-all cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/15 transition-all cursor-pointer"
                        >
                            <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                        </button>
                    )}
                    <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                        {viewMode === "add" ? "Add new address" : "Select a location"}
                    </h2>
                </div>

                {/* Scrollable Drawer Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                    {/* VIEW MODE 1: LIST VIEW (Screenshot 1-to-1 Match) */}
                    {viewMode === "list" ? (
                        <>
                            {/* 1. Search Bar */}
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search for area, street name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-11 pl-10 pr-9 text-xs font-semibold rounded-2xl bg-slate-100 dark:bg-[#202228] text-slate-900 dark:text-white placeholder:text-slate-400 border border-transparent dark:border-white/5 outline-none focus:border-emerald-500 transition-all"
                                />
                                {searchLoading ? (
                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                                    </div>
                                ) : searchQuery ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setLiveSuggestions([]);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                ) : null}

                                {/* Live Autocomplete Suggestions Overlay */}
                                {liveSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-12 z-50 bg-white dark:bg-[#202228] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-white/5 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                                        {liveSuggestions.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelectSuggestion(item)}
                                                className="p-3 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-start gap-2.5 cursor-pointer group"
                                            >
                                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 shrink-0 mt-0.5">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                                                        {item.main_title || item.place_name.split(",")[0]}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                        {item.secondary_text || item.place_name}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 2. Quick Actions Group (Use current location + Add Address) */}
                            <div className="rounded-2xl bg-slate-50 dark:bg-[#202228] border border-slate-200/80 dark:border-white/5 divide-y divide-slate-200/60 dark:divide-white/5 overflow-hidden">

                                {/* Row 1: Use Current Location */}
                                <div
                                    onClick={() => {
                                        handleAutoDetect();
                                        setViewMode("add");
                                    }}
                                    className="p-3.5 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-white/5 transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                            <Crosshair className={cn("w-4 h-4", loading && "animate-spin")} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-400 leading-tight">
                                                Use current location
                                            </h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                {resolvedAddress ? `${resolvedAddress}, ${resolvedSecondary}` : "Kale Nagar, Anandvalli, Nashik, Maharashtra, India"}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                </div>

                                {/* Row 2: Add Address */}
                                <div
                                    onClick={() => setViewMode("add")}
                                    className="p-3.5 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-white/5 transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                            <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                                        </div>
                                        <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                                            Add Address
                                        </h4>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>

                            {/* 3. "SAVED ADDRESSES" Section (Exact Visual Match to Screenshot) */}
                            <div className="space-y-2.5 pt-1">
                                <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500 px-1">
                                    SAVED ADDRESSES
                                </div>

                                {addressLoading ? (
                                    <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                        <span className="text-xs font-semibold">Loading saved addresses...</span>
                                    </div>
                                ) : savedAddresses.length === 0 ? (
                                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#202228] text-center border border-dashed border-slate-200 dark:border-white/10">
                                        <Home className="w-6 h-6 text-slate-400 mx-auto mb-2 opacity-60" />
                                        <p className="text-xs font-bold text-slate-500">No saved addresses yet</p>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("add")}
                                            className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1 hover:underline"
                                        >
                                            + Add your first address
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {savedAddresses.map((addr) => {
                                            const dist = formatDistance(addr.latitude, addr.longitude);
                                            const isSelected = location?.address === addr.fullAddress.split(",")[0] || location?.secondary === addr.fullAddress;

                                            return (
                                                <div
                                                    key={addr.id}
                                                    onClick={() => handleSelectSavedAddress(addr)}
                                                    className={cn(
                                                        "p-4 rounded-2xl bg-slate-50 dark:bg-[#202228] border transition-all cursor-pointer group flex items-start gap-3.5",
                                                        isSelected
                                                            ? "border-emerald-500 dark:border-emerald-500/40 ring-1 ring-emerald-500/20"
                                                            : "border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15"
                                                    )}
                                                >
                                                    {/* Left: Icon & Distance (e.g. 0 m, 3.3 km under home icon) */}
                                                    <div className="flex flex-col items-center justify-center shrink-0 w-10 pt-0.5">
                                                        <div className="w-9 h-9 rounded-xl bg-slate-200/60 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-slate-200">
                                                            {addr.type?.toLowerCase() === "work" ? (
                                                                <Briefcase className="w-4 h-4 stroke-[2]" />
                                                            ) : (
                                                                <Home className="w-4.5 h-4.5 stroke-[2]" />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 whitespace-nowrap">
                                                            {dist}
                                                        </span>
                                                    </div>

                                                    {/* Right: Tag, Full Address, Phone & Actions */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                                                                {addr.type || "Home"}
                                                            </h4>
                                                            {isSelected && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                                    Selected
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-1 line-clamp-2">
                                                            {addr.fullAddress}
                                                        </p>
                                                        {addr.phone && (
                                                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                                                                Phone number: {addr.phone}
                                                            </p>
                                                        )}

                                                        {/* Action Icons Row: ···, share, delete */}
                                                        <div className="flex items-center gap-3 mt-2.5 pt-1 border-t border-slate-200/50 dark:border-white/5">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDeleteAddress(e, addr.id)}
                                                                className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors"
                                                                title="Delete address"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (navigator.share) {
                                                                        navigator.share({ title: addr.type, text: addr.fullAddress });
                                                                    } else {
                                                                        navigator.clipboard.writeText(addr.fullAddress);
                                                                        toast.success("Address copied to clipboard!");
                                                                    }
                                                                }}
                                                                className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
                                                                title="Share address"
                                                            >
                                                                <Share2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* VIEW MODE 2: COMPACT MAP & ADD ADDRESS FORM */
                        <div className="space-y-3.5">

                            {/* Quick Popular Area Chips */}
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                {NASHIK_AREAS.slice(0, 8).map((area) => (
                                    <button
                                        key={area.name}
                                        type="button"
                                        onClick={() => handleSelectArea(area)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border",
                                            resolvedAddress === area.name
                                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                                : "bg-slate-100 dark:bg-[#202228] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:border-emerald-400"
                                        )}
                                    >
                                        {area.name}
                                    </button>
                                ))}
                            </div>

                            {/* Smaller Compact Map (User: "make map little smaller") */}
                            <div className="relative w-full h-36 sm:h-40 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-inner bg-slate-100 dark:bg-[#202228]">
                                {!isMapLoaded ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 z-20">
                                        <Navigation className="h-5 w-5 animate-spin text-emerald-600" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Loading Map...</span>
                                    </div>
                                ) : (
                                    <div id="zomato-map-container" className="w-full h-full z-10" />
                                )}

                                {/* Center Pin Marker with Floating Bubble */}
                                {isMapLoaded && (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(100%+2px)] z-[1000] pointer-events-none flex flex-col items-center">
                                        <div className="bg-slate-900/95 dark:bg-black/95 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-2xl border border-white/20 whitespace-nowrap mb-1 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                            <span>Deliver here</span>
                                        </div>
                                        <div className="bg-emerald-600 text-white rounded-full p-2 shadow-2xl border-2 border-white">
                                            <MapPin className="h-4 w-4 stroke-[3]" />
                                        </div>
                                        <div className="w-3 h-3 bg-black/40 rounded-full border border-white/60 -mt-1 blur-[1px]" />
                                    </div>
                                )}

                                {/* Floating Re-center GPS Button */}
                                {isMapLoaded && (
                                    <button
                                        type="button"
                                        className="absolute bottom-2.5 right-2.5 z-[1001] w-8 h-8 bg-white dark:bg-[#18191e] border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all text-emerald-600 cursor-pointer"
                                        onClick={handleAutoDetect}
                                        disabled={loading}
                                        title="Center on my GPS position"
                                    >
                                        <Crosshair className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                                    </button>
                                )}
                            </div>

                            {/* Detected Locality Card */}
                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#202228] border border-slate-200 dark:border-white/5 flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20 mt-0.5">
                                    <MapPin className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                            Pinned Locality
                                        </span>
                                        {resolvedPincode && (
                                            <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5">
                                                PIN: {resolvedPincode}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                                        {resolvedAddress || "Kale Nagar"}
                                    </h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                        {resolvedSecondary || "Kale Nagar, Anandvalli, Nashik, Maharashtra"}
                                    </p>
                                </div>
                            </div>

                            {/* Doorstep Precision Input Fields */}
                            <div className="space-y-2 pt-0.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Complete Address Details
                                </label>
                                <input
                                    type="text"
                                    placeholder="Flat / House no. / Floor / Building Name *"
                                    value={flatNo}
                                    onChange={(e) => setFlatNo(e.target.value)}
                                    className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-[#202228] border border-slate-200 dark:border-white/10 outline-none focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nearby Landmark / Gate No."
                                        value={landmarkNote}
                                        onChange={(e) => setLandmarkNote(e.target.value)}
                                        className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-[#202228] border border-slate-200 dark:border-white/10 outline-none focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Receiver Phone Number"
                                        value={receiverPhone}
                                        onChange={(e) => setReceiverPhone(e.target.value)}
                                        className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-[#202228] border border-slate-200 dark:border-white/10 outline-none focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                                    />
                                </div>

                                {/* Save As Tag Pills */}
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[10px] font-bold text-slate-400">Save as:</span>
                                    {(["Home", "Work", "Other"] as const).map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setAddressTag(tag)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer border",
                                                addressTag === tag
                                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                                    : "bg-slate-50 dark:bg-[#202228] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-emerald-400"
                                            )}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer mt-2"
                                onClick={handleSaveNewAddress}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Navigation className="w-4 h-4 animate-spin" />
                                        <span>Saving Address...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 stroke-[3]" />
                                        <span>Save Address & Deliver Here</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            {/* Header / Trigger Badge (Zepto Signature Match: ⚡ 15 minutes | Area - Secondary) */}
            <div
                onClick={() => setOpen(true)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(true); } }}
                role="button"
                tabIndex={0}
                aria-label="Choose delivery location"
                className="min-h-11 min-w-0 max-w-full cursor-pointer flex items-center"
            >
                {variant === "hero" ? (
                    <div className="flex items-center gap-2.5 active:scale-95 transition-all duration-300 group select-none text-white min-w-0 w-full max-w-full">
                        <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/15 shadow-xs">
                            <MapPin className="h-4 w-4 stroke-[2.5] text-[#bef264]" />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] font-black text-[#bef264] tracking-tight">
                                <Zap className="w-3.5 h-3.5 fill-current" />
                                <span>Deliver to</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                <h2 className="font-black text-sm sm:text-base text-white leading-tight tracking-tight truncate">
                                    {location?.address === "Select Location" || !location?.address ? "Set Location" : location.address}
                                </h2>
                                <span className="hidden sm:inline text-white/60 font-semibold text-xs">-</span>
                                <span className="hidden sm:inline text-xs text-white/80 font-medium truncate max-w-[130px] sm:max-w-xs">
                                    {location?.secondary || "Nashik"}
                                </span>
                                <ChevronDown className="h-4 w-4 text-white/90 stroke-[3] shrink-0" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5 active:scale-95 transition-all duration-300 group select-none">
                        {!isCompact && (
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-800 dark:text-emerald-400">
                                <Zap className="h-4.5 w-4.5 fill-current" />
                            </div>
                        )}

                        <div className="flex flex-col text-left min-w-0">
                            <div className="flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400 tracking-tight leading-none">
                                <Zap className="w-3 h-3 fill-current inline" />
                                <span>Deliver to</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                <h2 className={cn(
                                    "font-black text-slate-900 dark:text-white leading-none tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate",
                                    isCompact ? "text-xs" : "text-sm sm:text-base"
                                )}>
                                    {location?.address === "Select Location" || !location?.address ? "Set Location" : location.address}
                                </h2>
                                <span className="text-slate-400 dark:text-slate-500 font-semibold text-xs leading-none">-</span>
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-none truncate max-w-[120px] sm:max-w-xs">
                                    {location?.secondary || `Nashik - ${location?.pincode || "422013"}`}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-700 dark:text-white stroke-[3] shrink-0" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Portal-Mounted Zomato/Blinkit Bottom Sheet Drawer */}
            {typeof document !== "undefined" && createPortal(drawerPortal, document.body)}
        </>
    );
}
