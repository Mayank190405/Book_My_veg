"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendOtp, verifyOtp, checkWhatsappStatus } from "@/services/authService";
import { updateProfile } from "@/services/userService";
import { createAddress } from "@/services/addressService";
import { useUserStore } from "@/store/useUserStore";
import { getReverseGeocode } from "@/services/geocodingService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Loader2, 
    ArrowLeft, 
    ShieldCheck, 
    Smartphone, 
    CheckCircle2, 
    ExternalLink, 
    Navigation, 
    MapPin, 
    Leaf, 
    Award, 
    Edit2,
    Info
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";

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

const formatRetryAfter = (seconds: number) => {
    if (!seconds) return "later";
    if (seconds < 60) return `in ${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
        return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} and ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`;
};

const LeafyDecoration = () => (
    <svg className="absolute top-0 right-0 w-36 h-36 pointer-events-none opacity-90 z-0" viewBox="0 0 100 100" fill="none">
        {/* Delicate premium branch design */}
        <path d="M100 0 C80 20, 60 20, 50 30 C45 35, 40 45, 42 55 C44 65, 55 70, 65 65 C75 60, 85 45, 100 0" fill="#c6f6d5" fillOpacity="0.45" />
        <path d="M100 0 C70 30, 55 45, 60 55 C65 65, 75 60, 80 50 C85 40, 90 20, 100 0" fill="#68d391" fillOpacity="0.35" />
        <path d="M100 0 C85 10, 75 10, 70 15 C65 20, 68 28, 75 25 C82 22, 90 12, 100 0" fill="#38a169" fillOpacity="0.4" />
        <path d="M100 0 C80 15, 65 35, 55 55" stroke="#2f855a" strokeWidth="0.5" strokeOpacity="0.2" />
    </svg>
);

const AppLogo = () => (
    <div className="w-16 h-16 bg-white border border-slate-100 rounded-3xl flex items-center justify-center shadow-[0_8px_30px_rgba(4,64,48,0.04)] mb-8 shrink-0 relative z-10">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Soft rounded bag body */}
            <path d="M5 8V18C5 20.2091 6.79086 22 9 22H15C17.2091 22 19 20.2091 19 18V8" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M9 8V6C9 4.34315 10.3431 3 12 3C13.6569 3 15 4.34315 15 6V8" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"/>
            {/* Delicate green leaf detail in center */}
            <path d="M12 11C12 14.5 13.5 16 15 16C15 14 13.5 12.5 12 11Z" fill="#10b981" />
            <path d="M12 11C12 14.5 10.5 16 9 16C9 14 10.5 12.5 12 11Z" fill="#047857" />
        </svg>
    </div>
);

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get("redirect") || "/";

    const [step, setStep] = useState<"PHONE" | "OTP" | "PROFILE_SETUP">("PHONE");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    // WhatsApp Fallback state
    const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
    const [magicToken, setMagicToken] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    // Profile Setup states
    const [name, setName] = useState("");
    const [completeAddress, setCompleteAddress] = useState("");
    const [setupLoading, setSetupLoading] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [mapCenter, setMapCenter] = useState({ lat: 19.9830, lng: 73.7702 });
    const [resolvedAddress, setResolvedAddress] = useState("");
    const [resolvedPincode, setResolvedPincode] = useState("");
    const [geoLoading, setGeoLoading] = useState(false);
    const mapRef = useRef<any>(null);

    // OTP refs for individual boxes
    const otpRefs = [
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
    ];

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setWhatsappUrl(null);
        setMagicToken(null);

        try {
            const res = await sendOtp(phone);

            if (res.whatsappUrl) {
                setWhatsappUrl(res.whatsappUrl);
                setMagicToken(res.magicToken);
                toast.warning("OTP delivery issue", {
                    description: "Please use the WhatsApp verification method below."
                });
            } else {
                toast.success("OTP sent successfully", {
                    description: "Please check your WhatsApp"
                });
            }

            setStep("OTP");
            if (res.otp) {
                console.log("DEV: OTP is", res.otp);
            }
        } catch (error: any) {
            console.error(error);
            if (error.response?.status === 429) {
                const retryAfter = error.response?.data?.retryAfter;
                const timeStr = retryAfter ? formatRetryAfter(retryAfter) : "later";
                toast.error(`Too many requests. Please try again ${timeStr}.`);
            } else {
                toast.error(error.response?.data?.message || "Failed to send OTP");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await verifyOtp(phone, otp);
            toast.success("Welcome back!", {
                icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
            });
            if (res.user && !res.user.name) {
                setStep("PROFILE_SETUP");
            } else {
                router.push(redirect);
            }
        } catch (error: any) {
            console.error(error);
            if (error.response?.status === 429) {
                const retryAfter = error.response?.data?.retryAfter;
                const timeStr = retryAfter ? formatRetryAfter(retryAfter) : "later";
                toast.error(`Too many requests. Please try again ${timeStr}.`);
            } else {
                toast.error(error.response?.data?.message || "Invalid OTP");
            }
        } finally {
            setLoading(false);
        }
    };

    // Polling logic for WhatsApp magic link
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (magicToken && step === "OTP") {
            setIsPolling(true);
            interval = setInterval(async () => {
                try {
                    const res = await checkWhatsappStatus(phone, magicToken);
                    if (res.verified) {
                        toast.success("WhatsApp Verified!", {
                            icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
                        });
                        if (res.user && !res.user.name) {
                            setStep("PROFILE_SETUP");
                        } else {
                            router.push(redirect);
                        }
                    }
                } catch (err) {
                    // Fail silently during polling
                }
            }, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
            setIsPolling(false);
        };
    }, [magicToken, step, phone, router, redirect]);

    // Load Leaflet dynamically on profile setup
    useEffect(() => {
        if (step !== "PROFILE_SETUP") return;

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
    }, [step]);

    // Initialize Map Instance
    useEffect(() => {
        if (step !== "PROFILE_SETUP" || !isMapLoaded) return;

        const timer = setTimeout(() => {
            const L = (window as any).L;
            if (!L) return;

            const mapEl = document.getElementById("login-map");
            if (!mapEl) return;

            const initialLat = 19.9830;
            const initialLng = 73.7702;
            setMapCenter({ lat: initialLat, lng: initialLng });

            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }

            const map = L.map("login-map", {
                zoomControl: false,
                attributionControl: false
            }).setView([initialLat, initialLng], 15);

            L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
                maxZoom: 19
            }).addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);
            mapRef.current = map;

            resolveAddress(initialLat, initialLng);

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
    }, [step, isMapLoaded]);

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
                    toast.success("Location centered on GPS position!");
                },
                (error) => {
                    console.error("GPS detection error:", error);
                    toast.error("Could not access device GPS.");
                }
            );
        } else {
            toast.error("GPS geolocation is not supported by your browser.");
        }
    };

    const handleProfileSetupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim().length < 2) {
            toast.error("Name must be at least 2 characters");
            return;
        }
        if (!completeAddress.trim() || completeAddress.trim().length < 5) {
            toast.error("Please enter a complete address (at least 5 characters)");
            return;
        }
        if (!resolvedAddress) {
            toast.error("Please drop a pin to select your address");
            return;
        }

        setSetupLoading(true);
        try {
            await updateProfile({ name: name.trim() });

            const fullAddress = `${completeAddress.trim()}, ${resolvedAddress}`;
            await createAddress({
                type: "HOME",
                fullAddress: fullAddress,
                pincode: resolvedPincode || "422002",
                latitude: mapCenter.lat,
                longitude: mapCenter.lng,
                isDefault: true,
                name: name.trim(),
                phone: phone
            });

            const user = useUserStore.getState().user;
            if (user) {
                useUserStore.getState().setUser({ ...user, name: name.trim() });
            }

            const { setLocation: setUserLocation } = useUserStore.getState();
            setUserLocation({
                address: fullAddress,
                pincode: resolvedPincode || "422002",
                coords: { lat: mapCenter.lat, lng: mapCenter.lng }
            });

            toast.success("Profile setup complete!");
            router.push(redirect);
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to save profile");
        } finally {
            setSetupLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        const cleanVal = value.replace(/\D/g, "");
        if (!cleanVal) return;

        const valArray = cleanVal.split("");
        let currentIdx = index;

        const newOtp = otp.split("");
        for (let i = 0; i < valArray.length; i++) {
            if (currentIdx < 6) {
                newOtp[currentIdx] = valArray[i];
                currentIdx++;
            }
        }
        const updatedOtp = newOtp.join("").slice(0, 6);
        setOtp(updatedOtp);

        const nextFocus = Math.min(currentIdx, 5);
        otpRefs[nextFocus].current?.focus();
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            const newOtp = otp.split("");
            if (newOtp[index]) {
                newOtp[index] = "";
                setOtp(newOtp.join(""));
            } else if (index > 0) {
                newOtp[index - 1] = "";
                setOtp(newOtp.join(""));
                otpRefs[index - 1].current?.focus();
            }
            e.preventDefault();
        }
    };

    return (
        <div className="w-full flex flex-col min-h-screen md:min-h-[850px] md:h-[850px] justify-between relative overflow-hidden bg-gradient-to-b from-[#fafdfa] to-[#f5f9f6] animate-in fade-in duration-500">
            
            {/* Header decor logic */}
            {step === "PHONE" && <LeafyDecoration />}

            {/* Main content viewport wrapper */}
            <div className="flex-1 flex flex-col px-7 pt-12 pb-6 relative z-10 w-full min-w-0">
                {step === "PHONE" ? (
                    <div className="flex-1 flex flex-col justify-between">
                        {/* Upper Intro panel */}
                        <div className="relative">
                            <AppLogo />
                            <h1 className="text-4xl font-black text-[#0f342a] tracking-tight leading-[1.05] italic uppercase text-left">
                                Welcome<br />Back!
                            </h1>
                            <p className="text-[10px] font-bold text-[#8ba29a] uppercase tracking-[0.18em] leading-relaxed mt-4 max-w-[280px] text-left">
                                Experience the future of farm-fresh essentials with Book My Veg.
                            </p>

                            {/* Overflowing basket render */}
                            <div className="absolute top-[80px] -right-20 w-60 h-60 pointer-events-none select-none mix-blend-multiply opacity-95">
                                <Image 
                                    src="/images/login_basket.png" 
                                    alt="Fresh Vegetables Basket"
                                    width={240}
                                    height={240}
                                    priority
                                    className="object-contain"
                                />
                            </div>
                        </div>

                        {/* Mid form panel */}
                        <form onSubmit={handleSendOtp} className="space-y-6 mt-6">
                            <div className="space-y-2 text-left">
                                <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8ba29a] pl-1">
                                    Mobile Number
                                </Label>
                                <div className="flex items-center bg-white border border-slate-100 rounded-3xl px-4 py-1.5 shadow-[0_8px_30px_rgba(4,64,48,0.015)] focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all">
                                    {/* Country Selector Mockup */}
                                    <div className="flex items-center gap-2 border-r border-slate-100 pr-3 mr-3 select-none">
                                        <span className="text-base">🇮🇳</span>
                                        <span className="text-xs font-black text-slate-800 tracking-wider">+91</span>
                                        <span className="text-[9px] font-bold text-slate-400">▼</span>
                                    </div>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="Enter mobile number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="h-10 border-0 bg-transparent px-0 text-sm font-bold text-slate-800 placeholder-slate-300 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                        required
                                        minLength={10}
                                        maxLength={10}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                className="w-full h-14 bg-[#10b981] rounded-3xl flex items-center justify-between pl-6 pr-3.5 text-white active:scale-[0.98] transition-all hover:bg-[#0e9d6d] shadow-[0_12px_24px_rgba(16,185,129,0.15)] disabled:opacity-50 disabled:scale-100"
                                disabled={loading || phone.length < 10}
                            >
                                <span className="text-xs font-black uppercase tracking-[0.2em]">Continue Safely</span>
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                            <polyline points="12 5 19 12 12 19" />
                                        </svg>
                                    )}
                                </div>
                            </button>

                            <div className="relative flex items-center justify-center py-2 select-none">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                                <span className="relative bg-gradient-to-b from-[#fafdfa] to-[#f5f9f6] px-3.5 text-[8px] font-black text-slate-300 uppercase tracking-widest">or</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => router.push(redirect)}
                                className="w-full text-center text-[10px] font-black text-[#10b981] uppercase tracking-[0.2em] py-2 hover:opacity-80 active:scale-95 transition-all"
                            >
                                Skip for now & browse
                            </button>
                        </form>

                        {/* Badges footer list */}
                        <div className="grid grid-cols-3 gap-2 mt-8 pt-6 border-t border-slate-100/60 text-left">
                            <div className="space-y-1.5">
                                <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                                <h5 className="text-[9px] font-black uppercase tracking-wider text-slate-700">Safe & Secure</h5>
                                <p className="text-[7.5px] font-semibold text-slate-400 leading-normal uppercase">Your data is protected</p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                    <Leaf className="h-4 w-4" />
                                </div>
                                <h5 className="text-[9px] font-black uppercase tracking-wider text-slate-700">Farm Fresh</h5>
                                <p className="text-[7.5px] font-semibold text-slate-400 leading-normal uppercase">Handpicked for you</p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                    <Award className="h-4 w-4" />
                                </div>
                                <h5 className="text-[9px] font-black uppercase tracking-wider text-slate-700">Reliable</h5>
                                <p className="text-[7.5px] font-semibold text-slate-400 leading-normal uppercase">Trusted by millions</p>
                            </div>
                        </div>
                    </div>
                ) : step === "OTP" ? (
                    <div className="flex-1 flex flex-col justify-between">
                        {/* Status notification toast */}
                        <div className="w-full bg-[#f0fbf8] border border-emerald-500/10 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top duration-300 shadow-[0_8px_30px_rgba(4,64,48,0.015)] mb-6 text-left">
                            <div className="w-8 h-8 bg-emerald-500/15 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                                <CheckCircle2 className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex-1">
                                <h5 className="text-[10px] font-black text-emerald-950 uppercase tracking-wide">OTP sent successfully</h5>
                                <p className="text-[8px] font-bold text-emerald-800/80 uppercase tracking-wider mt-0.5">Please check your WhatsApp</p>
                            </div>
                        </div>

                        {/* Top Group info card */}
                        <div className="text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-white border border-slate-100 rounded-3xl flex items-center justify-center shadow-[0_8px_30px_rgba(4,64,48,0.04)] mb-6 shrink-0 relative z-10 text-emerald-600">
                                <ShieldCheck className="h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-black text-[#0f342a] tracking-tight uppercase italic">Verify Your Number</h2>
                            <p className="text-[10px] font-semibold text-[#8ba29a] uppercase tracking-wider leading-relaxed mt-2.5 max-w-[280px]">
                                Enter the 6-digit verification code sent to <span className="text-[#10b981] font-black">+91 {phone}</span>
                            </p>
                        </div>

                        {/* Custom inputs code block form */}
                        <div className="space-y-6 mt-6">
                            {whatsappUrl && (
                                <div className="space-y-4">
                                    <Button
                                        onClick={() => window.open(whatsappUrl, '_blank')}
                                        className="w-full h-14 rounded-3xl bg-[#25D366] hover:bg-[#20bd5c] text-white font-black text-xs uppercase tracking-widest shadow-md flex items-center justify-center gap-3 border-none"
                                    >
                                        <ExternalLink className="h-4.5 w-4.5" />
                                        Verify on WhatsApp
                                    </Button>

                                    <div className="flex flex-col items-center gap-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#10b981]" />
                                            <span className="text-[9px] font-black text-[#10b981] uppercase tracking-widest animate-pulse">
                                                Waiting for WhatsApp confirm...
                                            </span>
                                        </div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center px-4 leading-normal">
                                            Click the button above to send the verification message. We will automatically log you in once sent.
                                        </p>
                                    </div>

                                    <div className="relative flex items-center justify-center py-2 select-none">
                                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                                        <span className="relative bg-gradient-to-b from-[#fafdfa] to-[#f5f9f6] px-3.5 text-[8px] font-black text-slate-300 uppercase tracking-widest">or try code</span>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleVerifyOtp} className="space-y-6">
                                <div className="space-y-2 text-left">
                                    <div className="flex justify-between items-center pl-1">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8ba29a]">
                                            Verification Code
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStep("PHONE");
                                                setWhatsappUrl(null);
                                                setMagicToken(null);
                                                setOtp("");
                                            }}
                                            className="text-[#10b981] text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                                        >
                                            <Edit2 className="h-2.5 w-2.5" /> Change Number
                                        </button>
                                    </div>

                                    {/* Six separate inputs block */}
                                    <div className="flex justify-between items-center gap-2 select-none">
                                        {[0, 1, 2, 3, 4, 5].map((idx) => (
                                            <input
                                                key={idx}
                                                ref={otpRefs[idx]}
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={1}
                                                value={otp[idx] || ""}
                                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                                placeholder="0"
                                                className={cn(
                                                    "w-12 h-14 bg-white border border-slate-100 rounded-2xl text-center text-lg font-black text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-[0_8px_30px_rgba(4,64,48,0.01)]",
                                                    otp[idx] && "border-emerald-600 ring-2 ring-emerald-500/5"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full h-14 bg-[#10b981] rounded-3xl flex items-center justify-between pl-6 pr-3.5 text-white active:scale-[0.98] transition-all hover:bg-[#0e9d6d] shadow-[0_12px_24px_rgba(16,185,129,0.15)] disabled:opacity-50 disabled:scale-100"
                                    disabled={loading || otp.length < 6}
                                >
                                    <span className="text-xs font-black uppercase tracking-[0.2em]">Verify & Login</span>
                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                        {loading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                                <polyline points="12 5 19 12 12 19" />
                                            </svg>
                                        )}
                                    </div>
                                </button>

                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        disabled={loading}
                                        className="text-[#8ba29a] text-[10px] font-bold uppercase tracking-wider hover:text-[#10b981] transition-colors disabled:opacity-50"
                                    >
                                        Didn't receive the code? <span className="text-[#10b981] font-black">Resend</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => router.push(redirect)}
                                    className="w-full text-center text-[10px] font-black text-[#10b981] uppercase tracking-[0.2em] py-2 hover:opacity-80 active:scale-95 transition-all"
                                >
                                    Skip for now & browse
                                </button>
                            </form>
                        </div>

                        {/* Crate graphic at bottom */}
                        <div className="w-full relative mt-8 select-none pointer-events-none mix-blend-multiply opacity-90 flex justify-center">
                            <Image 
                                src="/images/login_crate.png" 
                                alt="Fresh Vegetables Crate"
                                width={320}
                                height={220}
                                className="object-contain"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col justify-between animate-fade-in text-left">
                        {/* Profile Setup Intro */}
                        <div>
                            <div className="w-16 h-16 bg-white border border-slate-100 rounded-3xl flex items-center justify-center shadow-[0_8px_30px_rgba(4,64,48,0.04)] mb-6 shrink-0 text-emerald-600">
                                <MapPin className="h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-black text-[#0f342a] tracking-tight uppercase italic">Complete Profile</h2>
                            <p className="text-[10px] font-semibold text-[#8ba29a] uppercase tracking-wider leading-relaxed mt-2.5">
                                Enter your details so we can deliver farm-fresh veg to your doorstep.
                            </p>
                        </div>

                        <form onSubmit={handleProfileSetupSubmit} className="space-y-5 mt-6">
                            <div className="space-y-1.5">
                                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8ba29a] pl-1">
                                    Your Full Name
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-12 rounded-2xl border-slate-100 bg-white/50 focus:bg-white text-slate-800 font-bold placeholder-slate-300"
                                    required
                                    minLength={2}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="completeAddress" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8ba29a] pl-1">
                                    House / Flat No. / Building / Street
                                </Label>
                                <Input
                                    id="completeAddress"
                                    type="text"
                                    placeholder="e.g. Flat 104, Royal Crest, College Road"
                                    value={completeAddress}
                                    onChange={(e) => setCompleteAddress(e.target.value)}
                                    className="h-12 rounded-2xl border-slate-100 bg-white/50 focus:bg-white text-slate-800 font-bold placeholder-slate-300"
                                    required
                                    minLength={5}
                                />
                            </div>

                            <div className="space-y-1.5 relative">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8ba29a] pl-1">
                                    Drop Pin for Delivery Address
                                </Label>
                                
                                <div className="relative rounded-2xl border border-slate-100 overflow-hidden shadow-inner">
                                    <div id="login-map" className="w-full h-44 relative z-0" />
                                    
                                    {/* Central Pin Indicator */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[400] pointer-events-none flex flex-col items-center">
                                        <MapPin className="h-7 w-7 text-[#10b981] fill-[#10b981]/20 animate-bounce" />
                                        <div className="w-1.5 h-1.5 bg-[#10b981]/40 rounded-full blur-[2px] -mt-1" />
                                    </div>

                                    {/* Auto Detect GPS button */}
                                    <button
                                        type="button"
                                        onClick={handleAutoDetect}
                                        className="absolute bottom-3 right-3 z-[400] w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all text-slate-700"
                                        title="Use Current Location"
                                    >
                                        <Navigation className="h-4.5 w-4.5 text-[#10b981]" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/30 space-y-1">
                                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">
                                    Selected Address Area
                                </span>
                                {geoLoading ? (
                                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                                        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                                        <span>Resolving GPS coordinates...</span>
                                    </div>
                                ) : (
                                    <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase tracking-wider">
                                        {resolvedAddress || "Move map to drop pin"} {resolvedPincode ? `(${resolvedPincode})` : ""}
                                    </p>
                                )}
                            </div>

                            <button 
                                type="submit" 
                                className="w-full h-14 bg-[#10b981] rounded-3xl flex items-center justify-between pl-6 pr-3.5 text-white active:scale-[0.98] transition-all hover:bg-[#0e9d6d] shadow-[0_12px_24px_rgba(16,185,129,0.15)] disabled:opacity-50 disabled:scale-100 mt-2"
                                disabled={setupLoading || geoLoading || name.trim().length < 2 || completeAddress.trim().length < 5 || !resolvedAddress}
                            >
                                <span className="text-xs font-black uppercase tracking-[0.2em]">Complete Registration</span>
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                    {setupLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                            <polyline points="12 5 19 12 12 19" />
                                        </svg>
                                    )}
                                </div>
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Sticky footer text */}
            <div className="pb-8 z-10 w-full text-center select-none bg-transparent">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.25em] leading-none">
                    BMV MARKET • SAFE • SECURE • RELIABLE
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center gap-4 py-32 justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-[#10b981] opacity-25" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Preparing secure login...</p>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
