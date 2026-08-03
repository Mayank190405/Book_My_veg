"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
    User, Phone, Mail, MapPin, Loader2, CheckCircle2, ShieldCheck, Building 
} from "lucide-react";
import api from "@/services/api";

function OnboardContent() {
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form inputs
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");

    useEffect(() => {
        // Pre-fill phone from URL param
        const urlPhone = searchParams.get("phone") || "";
        const cleanPhone = urlPhone.replace(/\D/g, "");
        if (cleanPhone.length === 10) {
            setPhone(cleanPhone);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError("Full Name is required.");
            return;
        }

        const cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length !== 10) {
            setError("Please enter a valid 10-digit phone number.");
            return;
        }

        if (!address.trim()) {
            setError("Delivery address is required.");
            return;
        }

        setLoading(true);
        try {
            await api.post("/pay/onboard", {
                name,
                phone: cleanPhone,
                email: email || undefined,
                address
            });
            setSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.message || "Registration failed. Please check your details and try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />
                
                <div className="max-w-md w-full space-y-6 bg-slate-900 border border-emerald-500/20 p-8 rounded-[2.5rem] shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-emerald-600/30 ring-8 ring-emerald-500/10">
                        <CheckCircle2 className="w-10 h-10 stroke-[3]" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black tracking-tight text-white uppercase">Onboarding Complete!</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Thank you for completing your profile, <strong className="text-white">{name}</strong>. Your registration is complete and your delivery address is saved.
                        </p>
                    </div>

                    <div className="h-px bg-slate-800" />

                    <div className="text-left text-xs space-y-2.5 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                        <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Your Profile Summary</p>
                        <p className="text-slate-300 font-medium flex justify-between"><span>Name:</span> <span className="text-white font-bold">{name}</span></p>
                        <p className="text-slate-300 font-medium flex justify-between"><span>Phone:</span> <span className="text-white font-bold">{phone}</span></p>
                        {email && <p className="text-slate-300 font-medium flex justify-between"><span>Email:</span> <span className="text-white font-bold">{email}</span></p>}
                        <p className="text-slate-300 font-medium flex flex-col gap-0.5"><span className="text-slate-500">Delivery Address:</span> <span className="text-white font-semibold leading-relaxed mt-0.5">{address}</span></p>
                    </div>

                    <p className="text-[11px] text-slate-500 font-bold uppercase">You can close this tab now</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-y-auto font-sans">
            {/* Background Ambient Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="max-w-md mx-auto w-full space-y-6 relative z-10 py-6 my-auto">
                
                {/* Brand Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 ring-4 ring-emerald-500/10">
                            <Building className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                                Book My Veg
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">Client Onboarding Portal</p>
                        </div>
                    </div>
                    <div className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Secure Onboarding
                    </div>
                </div>

                {/* Form Card */}
                <div className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-[2rem] space-y-6 shadow-xl">
                    <div className="space-y-1">
                        <h3 className="text-xl font-black uppercase tracking-tight text-white">Create Your Profile</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Fill in your details below to activate your account. This ensures fast, secure organic delivery straight to your doorstep.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold leading-relaxed">
                                {error}
                            </div>
                        )}

                        {/* Name Input */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Full Name *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><User className="w-4 h-4" /></span>
                                <input 
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your first and last name"
                                    className="w-full h-12 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-700"
                                />
                            </div>
                        </div>

                        {/* Phone Input */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Phone Number *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Phone className="w-4 h-4" /></span>
                                <input 
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="10-digit mobile number"
                                    className="w-full h-12 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-700"
                                />
                            </div>
                        </div>

                        {/* Email Input */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Email Address (Optional)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Mail className="w-4 h-4" /></span>
                                <input 
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full h-12 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-700"
                                />
                            </div>
                        </div>

                        {/* Address Input */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Delivery Address *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-slate-500"><MapPin className="w-4 h-4" /></span>
                                <textarea 
                                    required
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Street, Building/House No, Area, Locality, Pincode"
                                    rows={3}
                                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-700 resize-none leading-relaxed"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl shadow-emerald-500/10 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" /> Saving Profile...
                                </>
                            ) : (
                                "Complete Onboarding"
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center pt-2 text-[10px] text-slate-600 font-semibold tracking-wide uppercase">
                    Book My Veg • Fresh Produce Delivered Fast
                </div>
            </div>
        </div>
    );
}

export default function OnboardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
        }>
            <OnboardContent />
        </Suspense>
    );
}
