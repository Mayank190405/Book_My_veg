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
import { Loader2, ArrowLeft, ShieldCheck, Smartphone, CheckCircle2, ExternalLink, Navigation, MapPin } from "lucide-react";
import { toast } from "sonner";

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
            // 1. Update Profile (Name) - omit email so it doesn't fail validation
            await updateProfile({ name: name.trim() });

            // 2. Create Address using both complete address and map resolved address
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

            // 3. Update Zustand User Store User
            const user = useUserStore.getState().user;
            if (user) {
                useUserStore.getState().setUser({ ...user, name: name.trim() });
            }

            // 4. Set active location in Zustand Store
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

    return (
        <div className="w-full max-w-md mx-auto px-6 animate-slide-up">
            <div className="glass p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-500" />

                <div className="relative z-10">
                    <div className="flex flex-col items-center mb-10 text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-emerald-100 shadow-inner group-hover:scale-110 transition-all duration-700 ease-out">
                            {step === "PHONE" ? (
                                <div className="relative">
                                    <Smartphone className="h-10 w-10 text-emerald-600 relative z-10" />
                                    <div className="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-pulse" />
                                </div>
                            ) : step === "OTP" ? (
                                <div className="relative">
                                    <ShieldCheck className="h-10 w-10 text-emerald-600 relative z-10" />
                                    <div className="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-pulse" />
                                </div>
                            ) : (
                                <div className="relative">
                                    <MapPin className="h-10 w-10 text-emerald-600 relative z-10" />
                                    <div className="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-pulse" />
                                </div>
                            )}
                        </div>
                        <h1 className="text-4xl font-heading font-black text-slate-900 tracking-tight mb-3">
                            {step === "PHONE" ? "Welcome Back" : step === "OTP" ? "Security Check" : "Complete Profile"}
                        </h1>
                        <p className="text-slate-500 text-base leading-relaxed px-2 max-w-[280px]">
                            {step === "PHONE"
                                ? "Experience the future of farm-fresh essentials with Book My Veg."
                                : step === "OTP"
                                    ? (whatsappUrl
                                        ? "Almost there! One-tap verification via WhatsApp requested."
                                        : `Enter the 6-digit verification code sent to +91 ${phone}`)
                                    : "Enter your details so we can deliver farm-fresh veg to your doorstep."
                            }
                        </p>
                    </div>

                    {step === "PHONE" ? (
                        <form onSubmit={handleSendOtp} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">
                                    Mobile Number
                                </Label>
                                <div className="relative group/input">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 border-r pr-3 py-1 border-gray-100 group-focus-within/input:border-primary/30 transition-colors">
                                        <span className="text-gray-500 font-medium">🇮🇳</span>
                                        <span className="text-gray-400 text-sm font-semibold">+91</span>
                                    </div>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="9876543210"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="pl-24 h-14 rounded-2xl border-gray-100 bg-white/50 focus:bg-white focus:ring-primary/20 transition-all text-lg font-medium"
                                        required
                                        minLength={10}
                                        maxLength={10}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full h-15 rounded-[22px] bg-gradient-to-br from-emerald-600 to-green-600 text-white font-bold text-xl shadow-[0_12px_24px_-8px_rgba(16,185,129,0.4)] hover:shadow-[0_16px_32px_-8px_rgba(16,185,129,0.5)] active:scale-[0.97] transition-all duration-300 disabled:opacity-50 disabled:scale-100 py-8 border-none"
                                disabled={loading || phone.length < 10}
                            >
                                {loading ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>Continue safely</span>
                                        <div className="w-4 h-[1px] bg-white/30" />
                                    </div>
                                )}
                            </Button>
                        </form>
                    ) : step === "OTP" ? (
                        <div className="space-y-6">
                            {whatsappUrl ? (
                                <div className="space-y-4">
                                    <Button
                                        onClick={() => window.open(whatsappUrl, '_blank')}
                                        className="w-full h-16 rounded-2xl bg-[#25D366] hover:bg-[#20bd5c] text-white font-bold text-lg shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                    >
                                        <ExternalLink className="h-6 w-6" />
                                        Verify on WhatsApp
                                    </Button>

                                    <div className="flex flex-col items-center gap-3 py-4">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <span className="text-xs font-bold text-primary uppercase tracking-widest animate-pulse">
                                                Waiting for WhatsApp confirm...
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 text-center px-6">
                                            Click the button above to send the verification message. We'll automatically log you in once you send it.
                                        </p>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100" /></div>
                                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400 font-medium tracking-widest">Or try code</span></div>
                                    </div>
                                </div>
                            ) : null}

                            <form onSubmit={handleVerifyOtp} className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-1">
                                        <Label htmlFor="otp" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                            Verification Code
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStep("PHONE");
                                                setWhatsappUrl(null);
                                                setMagicToken(null);
                                            }}
                                            className="text-primary text-xs font-bold hover:underline flex items-center gap-1"
                                        >
                                            <ArrowLeft className="h-3 w-3" /> Change Number
                                        </button>
                                    </div>
                                    <Input
                                        id="otp"
                                        type="text"
                                        placeholder="0 0 0 0 0 0"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="h-14 rounded-2xl border-gray-100 bg-white/50 focus:bg-white focus:ring-primary/20 transition-all text-center tracking-[1em] text-2xl font-bold pl-[1em]"
                                        required={!whatsappUrl}
                                        minLength={6}
                                        maxLength={6}
                                        autoFocus={!whatsappUrl}
                                    />
                                </div>

                                <Button type="submit" className="w-full h-14 rounded-2xl premium-gradient text-white font-bold text-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100" disabled={loading || otp.length < 6}>
                                    {loading ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        "Verify & Login"
                                    )}
                                </Button>

                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        disabled={loading}
                                        className="text-gray-400 text-sm font-medium hover:text-primary transition-colors disabled:opacity-50"
                                    >
                                        Didn't receive the code? <span className="text-primary font-bold">Resend</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <form onSubmit={handleProfileSetupSubmit} className="space-y-6 animate-fade-in">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    Your Full Name
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-14 rounded-2xl border-gray-100 bg-white/50 focus:bg-white focus:ring-primary/20 transition-all text-lg font-medium"
                                    required
                                    minLength={2}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="completeAddress" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    House / Flat No. / Building / Street
                                </Label>
                                <Input
                                    id="completeAddress"
                                    type="text"
                                    placeholder="e.g. Flat 104, Royal Crest, College Road"
                                    value={completeAddress}
                                    onChange={(e) => setCompleteAddress(e.target.value)}
                                    className="h-14 rounded-2xl border-gray-100 bg-white/50 focus:bg-white focus:ring-primary/20 transition-all text-lg font-medium"
                                    required
                                    minLength={5}
                                />
                            </div>

                            <div className="space-y-2 relative">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    Drop Pin for Delivery Address
                                </Label>
                                
                                <div className="relative">
                                    <div id="login-map" className="w-full h-52 rounded-2xl border border-gray-100 overflow-hidden shadow-inner relative z-0" />
                                    
                                    {/* Central Pin Indicator */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[400] pointer-events-none flex flex-col items-center">
                                        <MapPin className="h-8 w-8 text-primary fill-primary/20 animate-bounce" />
                                        <div className="w-2 h-2 bg-primary/40 rounded-full blur-[2px] -mt-1" />
                                    </div>

                                    {/* Auto Detect GPS button */}
                                    <button
                                        type="button"
                                        onClick={handleAutoDetect}
                                        className="absolute bottom-4 right-4 z-[400] w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-700 shadow-md hover:scale-105 active:scale-95 transition-all"
                                        title="Use Current Location"
                                    >
                                        <Navigation className="h-5 w-5 text-primary" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 space-y-1">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block">
                                    Selected Address
                                </span>
                                {geoLoading ? (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                                        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                                        <span>Resolving coordinates...</span>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium text-slate-700 leading-relaxed">
                                        {resolvedAddress || "Move map to drop pin"} {resolvedPincode ? `(${resolvedPincode})` : ""}
                                    </p>
                                )}
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full h-15 rounded-[22px] bg-gradient-to-br from-emerald-600 to-green-600 text-white font-bold text-xl shadow-[0_12px_24px_-8px_rgba(16,185,129,0.4)] hover:shadow-[0_16px_32px_-8px_rgba(16,185,129,0.5)] active:scale-[0.97] transition-all duration-300 disabled:opacity-50 disabled:scale-100 py-8 border-none"
                                disabled={setupLoading || geoLoading || name.trim().length < 2 || completeAddress.trim().length < 5 || !resolvedAddress}
                            >
                                {setupLoading ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    "Complete Registration"
                                )}
                            </Button>
                        </form>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100/50">
                    <button
                        type="button"
                        onClick={() => router.push(redirect)}
                        className="w-full text-center text-gray-400 text-sm font-semibold hover:text-primary transition-colors py-2"
                    >
                        Skip for now & browse
                    </button>
                </div>
            </div>

            <p className="mt-12 text-center text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                BMV Market • Safe • Secure • Reliable
            </p>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                <p className="text-gray-400 font-medium animate-pulse text-sm">Preparing secure login...</p>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
