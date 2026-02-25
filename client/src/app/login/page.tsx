"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendOtp, verifyOtp, checkWhatsappStatus } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, ShieldCheck, Smartphone, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get("redirect") || "/";

    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    // WhatsApp Fallback state
    const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
    const [magicToken, setMagicToken] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);

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
            toast.error(error.response?.data?.message || "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await verifyOtp(phone, otp);
            toast.success("Welcome back!", {
                icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
            });
            router.push(redirect);
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || "Invalid OTP");
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
                        router.push(redirect);
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

    return (
        <div className="w-full max-w-md mx-auto px-6 animate-slide-up">
            <div className="glass p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-500" />

                <div className="relative z-10">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-primary/20 group-hover:scale-110 transition-transform duration-500">
                            {step === "PHONE" ? (
                                <Smartphone className="h-8 w-8 text-primary" />
                            ) : (
                                <ShieldCheck className="h-8 w-8 text-primary" />
                            )}
                        </div>
                        <h1 className="text-3xl font-heading font-bold text-gray-900 tracking-tight">
                            {step === "PHONE" ? "Welcome" : "Verify It's You"}
                        </h1>
                        <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed px-4">
                            {step === "PHONE"
                                ? "Enter your mobile number to get access to BMV Markets."
                                : whatsappUrl
                                    ? "Verification link generated. Send it on WhatsApp to continue."
                                    : `We've sent a 6-digit code to your mobile number +91 ${phone}`
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

                            <Button type="submit" className="w-full h-14 rounded-2xl premium-gradient text-white font-bold text-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100" disabled={loading || phone.length < 10}>
                                {loading ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    "Continue"
                                )}
                            </Button>
                        </form>
                    ) : (
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
