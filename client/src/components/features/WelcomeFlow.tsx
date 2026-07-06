"use client";

import { useState, useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { MapPin, User, Mail, ChevronRight, CheckCircle2, Sparkles, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function WelcomeFlow() {
    const { user, setUser, location, setLocation, hasSeenWelcome, setHasSeenWelcome, _hasHydrated } = useUserStore();
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(1);

    // Form states
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [pincode, setPincode] = useState("");
    const [landmark, setLandmark] = useState("");

    useEffect(() => {
        if (_hasHydrated && !hasSeenWelcome) {
            // Show if either user info or location is missing
            const isMissingUser = !user || !user.name || user.name === "Guest";
            const isMissingLocation = !location || !location.address || location.address === "Select Location";
            
            if (isMissingUser || isMissingLocation) {
                // Don't show on admin or search pages to avoid interruption
                const isExcludedPage = window.location.pathname.startsWith('/admin') || window.location.pathname === '/search';
                if (!isExcludedPage) {
                    setShow(true);
                }
                if (user?.name && user.name !== "Guest") {
                    setName(user.name);
                    setEmail(user.email || "");
                    setPhone(user.phone || "");
                    setStep(2); // Skip to address if user exists
                }
            }
        }
    }, [_hasHydrated, user, location, hasSeenWelcome]);

    if (!show) return null;

    const handleNext = () => {
        if (step === 1) {
            if (!name || !email || !phone) {
                toast.error("Please fill your basic details");
                return;
            }
            setStep(2);
        } else {
            if (!address || pincode.length !== 6) {
                toast.error("Please provide a valid delivery address");
                return;
            }
            saveAndClose();
        }
    };

    const saveAndClose = () => {
        setUser({
            id: user?.id || `guest_${Date.now()}`,
            name,
            email,
            phone,
            role: "USER"
        });

        setLocation({
            address: `${address}${landmark ? `, ${landmark}` : ""}`,
            pincode,
        });

        setHasSeenWelcome(true);
        toast.success(`Welcome to BookMyVeg, ${name}!`);
        setShow(false);
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
            {/* Immersive Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" />

            {/* Bottom Sheet Card - Dark Emerald Theme */}
            <div className={cn(
                "relative w-full max-w-xl bg-[#061512] rounded-t-[2rem] shadow-[0_-20px_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in slide-in-from-bottom-full duration-700 cubic-bezier(0.16, 1, 0.3, 1)",
                "max-h-[85vh] border-t border-white/5"
            )}>
                {/* Visual Header / Handle wrapper */}
                <div className="relative pt-4 pb-3 border-b border-white/5 bg-[#0b2820]/30">
                    <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-3" />
                    <div className="px-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <Sparkles className="h-4 w-4 fill-current" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black uppercase tracking-tighter leading-none text-white">
                                    Welcome
                                </h1>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 mt-0.5">
                                    Step {step} of 2
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Indicators */}
                <div className="flex gap-1.5 px-8 py-3">
                    <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step >= 1 ? "bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-white/5")} />
                    <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step >= 2 ? "bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-white/5")} />
                </div>

                {/* Step Content */}
                <div className="px-6 py-3 flex-1 overflow-y-auto scrollbar-hide space-y-6">
                    {step === 1 ? (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-1 text-center">
                                <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">Your Profile</h2>
                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1.5">Create your fresh account</p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="space-y-1.5 group">
                                    <label className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest px-1 group-focus-within:text-emerald-500 transition-colors">
                                        <User className="h-3 w-3" /> Name
                                    </label>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="KESHAV SHARMA"
                                        className="w-full bg-white/5 border border-white/5 focus:border-emerald-500/20 focus:bg-white/10 rounded-xl h-12 px-5 text-[13px] font-black uppercase tracking-tight outline-none placeholder:text-white/10 transition-all text-white"
                                    />
                                </div>
                                <div className="space-y-1.5 group">
                                    <label className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest px-1 group-focus-within:text-emerald-500 transition-colors">
                                        <Mail className="h-3 w-3" /> Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="HELLO@EXAMPLE.COM"
                                        className="w-full bg-white/5 border border-white/5 focus:border-emerald-500/20 focus:bg-white/10 rounded-xl h-12 px-5 text-[13px] font-black uppercase tracking-tight outline-none placeholder:text-white/10 transition-all text-white"
                                    />
                                </div>
                                <div className="space-y-1.5 group">
                                    <label className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest px-1 group-focus-within:text-emerald-500 transition-colors">
                                        <CheckCircle2 className="h-3 w-3" /> Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="+91 00000 00000"
                                        className="w-full bg-white/5 border border-white/5 focus:border-emerald-500/20 focus:bg-white/10 rounded-xl h-12 px-5 text-[13px] font-black uppercase tracking-tight outline-none placeholder:text-white/10 transition-all text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-1 text-center">
                                <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">Delivery Spot</h2>
                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1.5">Where veggies reach you</p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="space-y-1.5 group">
                                    <label className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest px-1 group-focus-within:text-emerald-500 transition-colors">
                                        <MapPinned className="h-3 w-3" /> Full Address
                                    </label>
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="FLAT 102, SAPPHIRE HEIGHTS"
                                        className="w-full bg-white/5 border border-white/5 focus:border-emerald-500/20 focus:bg-white/10 rounded-xl min-h-[100px] p-5 text-[13px] font-black uppercase tracking-tight outline-none placeholder:text-white/10 transition-all resize-none text-white shadow-inner"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5 group">
                                        <label className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest px-1 group-focus-within:text-emerald-500 transition-colors">
                                            <MapPin className="h-3 w-3" /> Pincode
                                        </label>
                                        <input
                                            value={pincode}
                                            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="452001"
                                            className="w-full bg-white/5 border border-white/5 focus:border-emerald-500/20 focus:bg-white/10 rounded-xl h-12 px-5 text-[13px] font-black uppercase tracking-tight outline-none placeholder:text-white/10 transition-all text-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5 group">
                                        <label className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest px-1 group-focus-within:text-emerald-500 transition-colors">
                                            Landmark
                                        </label>
                                        <input
                                            value={landmark}
                                            onChange={(e) => setLandmark(e.target.value)}
                                            placeholder="E.G. NEAR BANK"
                                            className="w-full bg-white/5 border border-white/5 focus:border-emerald-500/20 focus:bg-white/10 rounded-xl h-12 px-5 text-[13px] font-black uppercase tracking-tight outline-none placeholder:text-white/10 transition-all text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Fixed Footer with Button */}
                <div className="px-6 pb-10 pt-4 bg-[#0b1c19] border-t border-white/5">
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleNext}
                            className="w-full bg-emerald-600 text-white h-14 rounded-xl font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all group"
                        >
                            <span className="italic text-sm">{step === 1 ? "Confirm Profile" : "Start Shopping Now"}</span>
                            <ChevronRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-1", step === 2 && "rotate-[-45deg]")} />
                        </button>
                        
                        <button 
                            onClick={() => {
                                setHasSeenWelcome(true);
                                setShow(false);
                            }}
                            className="w-full h-10 text-[9px] font-black text-white/20 hover:text-white/40 uppercase tracking-[0.4em] transition-colors italic"
                        >
                            Skip for now
                        </button>
                    </div>

                    <p className="text-[8px] text-center font-black text-white/5 uppercase tracking-[0.5em] mt-6">
                        Freshness Protocol Enabled
                    </p>
                </div>
            </div>
        </div>
    );
}
