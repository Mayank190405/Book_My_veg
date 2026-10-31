"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithPassword } from "@/services/authService";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ShieldCheck, User as UserIcon, Eye, EyeOff, Leaf, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { useUserStore } from "@/store/useUserStore";

export default function AdminLogin() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get("redirect") || "/admin/dashboard";

    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user } = useUserStore();

    // Already logged in as Admin? Redirect.
    useEffect(() => {
        if (user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "STORE_ADMIN")) {
            router.push(redirect);
        }
    }, [user, router, redirect]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await loginWithPassword(phone, password);
            if (res.user.role !== "ADMIN" && res.user.role !== "SUPER_ADMIN" && res.user.role !== "STORE_ADMIN") {
                toast.error("Access Denied: Insufficient Privileges");
                useUserStore.getState().logout();
                return;
            }
            toast.success("Login Successful", {
                description: `Accessed as ${res.user.role}`,
                icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />
            });

            // Role-based institutional routing
            if (res.user.role === "STORE_ADMIN" && res.user.slug) {
                router.push(`/admin/stores/${res.user.slug}`);
            } else {
                router.push(redirect);
            }
        } catch (error: unknown) {
            toast.error((isAxiosError(error) && error.response?.data?.message) || "Invalid admin credentials");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bmv-theme bmv-admin h-dvh overflow-y-auto bg-[var(--bmv-bg)] text-[var(--bmv-text)]">
            <header className="bmv-topbar border-b border-white/10">
                <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
                    <Link href="/" className="inline-flex min-h-11 items-center gap-3 text-base font-semibold"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bmv-accent)] text-[#004b30]"><Leaf className="h-5 w-5" /></span>Book My Veg</Link>
                    <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-green-100/80 hover:text-white"><span className="hidden sm:inline">Visit store</span><ArrowRight className="h-4 w-4" /></Link>
                </div>
            </header>
            <main className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-8 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:py-16">
                <section className="hidden lg:block" aria-labelledby="workspace-heading">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bmv-border)] bg-white px-4 py-2 text-xs font-medium text-[var(--bmv-accent-strong)]"><Leaf className="h-3.5 w-3.5" />Book My Veg management</span>
                    <h2 id="workspace-heading" className="mt-6 max-w-lg text-5xl font-semibold leading-[1.12] tracking-tight">Fresh thinking.<br /><span className="text-[var(--bmv-accent-strong)]">Every day.</span></h2>
                    <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--bmv-muted)]">Your workspace for products, orders, inventory and the people behind every delivery.</p>
                    <div className="relative mt-8 h-64 max-w-lg overflow-hidden rounded-[2rem] border border-[var(--bmv-border)] bg-[var(--bmv-raised)]"><Image src="/images/fresh_produce_banner.png" alt="A selection of vegetables" fill sizes="(min-width:1024px) 500px, 1px" className="object-cover" /></div>
                </section>
                <section className="mx-auto w-full max-w-md rounded-[1.75rem] border border-[var(--bmv-border)] bg-[var(--bmv-surface)] p-6 sm:p-9" aria-labelledby="login-heading">
                    <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bmv-raised)] text-[var(--bmv-accent-strong)]"><ShieldCheck className="h-6 w-6" /></span>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-[var(--bmv-accent-strong)]">Management workspace</p>
                    <h1 id="login-heading" className="text-3xl font-semibold tracking-tight">Welcome back</h1>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--bmv-muted)]">Sign in with your administrator account to continue.</p>
                    <form onSubmit={handleLogin} className="mt-8 space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="admin-phone" className="text-sm font-medium text-[var(--bmv-text)]">Phone number</Label>
                            <div className="relative"><UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bmv-muted)]" /><input id="admin-phone" type="tel" inputMode="tel" autoComplete="username" placeholder="Enter phone number" value={phone} onChange={event => setPhone(event.target.value)} required className="h-13 w-full rounded-xl border border-[var(--bmv-border)] bg-[var(--bmv-bg)] pl-11 pr-4 text-sm text-[var(--bmv-text)] placeholder:text-[var(--bmv-muted)] focus:border-[var(--bmv-accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--bmv-accent)]" /></div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-password" className="text-sm font-medium text-[var(--bmv-text)]">Password</Label>
                            <div className="relative"><Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bmv-muted)]" /><input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter password" value={password} onChange={event => setPassword(event.target.value)} required className="h-13 w-full rounded-xl border border-[var(--bmv-border)] bg-[var(--bmv-bg)] pl-11 pr-14 text-sm text-[var(--bmv-text)] placeholder:text-[var(--bmv-muted)] focus:border-[var(--bmv-accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--bmv-accent)]" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--bmv-muted)] hover:bg-[var(--bmv-raised)]">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                        </div>
                        <button type="submit" disabled={loading} className="mt-2 flex min-h-13 w-full items-center justify-center gap-3 rounded-full bg-[var(--bmv-accent-strong)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#005236] disabled:cursor-wait disabled:opacity-60">{loading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</> : <>Sign in<ArrowRight className="h-4 w-4" /></>}</button>
                        <p className="border-t border-[var(--bmv-border)] pt-5 text-center text-xs leading-relaxed text-[var(--bmv-muted)]">For authorized Book My Veg team members.</p>
                    </form>
                </section>
            </main>
        </div>
    );
}
