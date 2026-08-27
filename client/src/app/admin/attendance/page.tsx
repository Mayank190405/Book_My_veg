"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Calendar, User, MapPin, Clock, Search, 
    CheckCircle2, XCircle, AlertCircle, 
    Filter, Download, ChevronLeft, ChevronRight,
    DollarSign, UserPlus, CreditCard, Sparkles, Check, Plus
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AttendancePage() {
    const { user } = useUserStore();
    const [activeTab, setActiveTab] = useState<"ATTENDANCE" | "ADVANCES" | "ONBOARD">("ATTENDANCE");
    const [attendance, setAttendance] = useState<any[]>([]);
    const [advances, setAdvances] = useState<any[]>([]);
    const [totalAdvanceAmount, setTotalAdvanceAmount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocation, setSelectedLocation] = useState(user?.locationId || "ALL");
    const [staff, setStaff] = useState<any[]>([]);

    // Salary Advance Modal state
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [advanceForm, setAdvanceForm] = useState({
        staffId: "",
        amount: "",
        paymentMethod: "CASH",
        notes: "",
        date: new Date().toISOString().split("T")[0]
    });
    const [savingAdvance, setSavingAdvance] = useState(false);

    // Onboarding Form State
    const [onboardForm, setOnboardForm] = useState({
        name: "",
        phone: "",
        email: "",
        role: "POS_OPERATOR",
        locationId: "",
        baseSalary: "",
        joiningDate: new Date().toISOString().split("T")[0],
        password: ""
    });
    const [onboarding, setOnboarding] = useState(false);

    const isStoreAdmin = user?.role === "STORE_ADMIN";

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        if (selectedLocation !== "ALL") {
            fetchStaff();
        }
        if (activeTab === "ATTENDANCE") {
            fetchAttendance();
        } else if (activeTab === "ADVANCES") {
            fetchAdvances();
        }
    }, [date, selectedLocation, activeTab]);

    const fetchLocations = async () => {
        try {
            const res = await api.get("/locations");
            setLocations(res.data || []);
            if (isStoreAdmin && user?.locationId) {
                setSelectedLocation(user.locationId);
                setOnboardForm(prev => ({ ...prev, locationId: user.locationId }));
            } else if (res.data?.length > 0 && selectedLocation === "ALL") {
                setSelectedLocation(res.data[0].id);
                setOnboardForm(prev => ({ ...prev, locationId: res.data[0].id }));
            }
        } catch { toast.error("Failed to load locations"); }
    };

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/attendance/store/${selectedLocation}?date=${date}`);
            setAttendance(res.data || []);
        } catch { toast.error("Failed to load attendance"); }
        finally { setLoading(false); }
    };

    const fetchAdvances = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedLocation !== "ALL") params.set("locationId", selectedLocation);
            const res = await api.get(`/staff-advances?${params.toString()}`);
            setAdvances(res.data?.advances || []);
            setTotalAdvanceAmount(res.data?.totalAdvanceAmount || 0);
        } catch { toast.error("Failed to load salary advances"); }
        finally { setLoading(false); }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get("/users/admin/all");
            const allUsers = res.data || [];
            const localStaff = selectedLocation === "ALL" 
                ? allUsers.filter((u: any) => u.role !== "USER")
                : allUsers.filter((u: any) => u.locationId === selectedLocation && u.role !== "USER");
            setStaff(localStaff);
        } catch { /* Silent */ }
    };

    const handleQuickMark = async (staffId: string, status: string) => {
        try {
            await api.post("/attendance/mark", {
                userId: staffId,
                locationId: selectedLocation,
                status
            });
            toast.success(`Marked as ${status}`);
            fetchAttendance();
        } catch { toast.error("Failed to mark attendance"); }
    };

    const handleRecordAdvance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!advanceForm.staffId || !advanceForm.amount) {
            return toast.error("Please select a staff member and enter advance amount");
        }

        setSavingAdvance(true);
        try {
            await api.post("/staff-advances", {
                ...advanceForm,
                locationId: selectedLocation !== "ALL" ? selectedLocation : null
            });
            toast.success("Salary advance recorded successfully!");
            setShowAdvanceModal(false);
            setAdvanceForm({
                staffId: "",
                amount: "",
                paymentMethod: "CASH",
                notes: "",
                date: new Date().toISOString().split("T")[0]
            });
            fetchAdvances();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to record advance");
        } finally {
            setSavingAdvance(false);
        }
    };

    const handleOnboardSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!onboardForm.name || !onboardForm.phone) {
            return toast.error("Name and Phone are required for onboarding.");
        }

        setOnboarding(true);
        try {
            await api.post("/users/admin/create", {
                ...onboardForm,
                baseSalary: onboardForm.baseSalary ? Number(onboardForm.baseSalary) : null
            });
            toast.success(`Staff member "${onboardForm.name}" onboarded successfully!`);
            setOnboardForm({
                name: "",
                phone: "",
                email: "",
                role: "POS_OPERATOR",
                locationId: selectedLocation !== "ALL" ? selectedLocation : "",
                baseSalary: "",
                joiningDate: new Date().toISOString().split("T")[0],
                password: ""
            });
            setActiveTab("ATTENDANCE");
            fetchStaff();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to onboard staff");
        } finally {
            setOnboarding(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-full text-teal-700 dark:text-teal-300 text-xs font-bold mb-2">
                        <Sparkles className="w-3.5 h-3.5" /> Workforce Intelligence Suite
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-teal-500" />
                        Staff Attendance & Payroll
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        1-Click daily attendance, salary advances ledger, and employee onboarding.
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab("ATTENDANCE")}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                            activeTab === "ATTENDANCE"
                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        )}
                    >
                        📋 Daily Attendance
                    </button>
                    <button
                        onClick={() => setActiveTab("ADVANCES")}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                            activeTab === "ADVANCES"
                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        )}
                    >
                        💸 Salary Advances
                    </button>
                    <button
                        onClick={() => setActiveTab("ONBOARD")}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                            activeTab === "ONBOARD"
                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        )}
                    >
                        👤 Onboard Staff
                    </button>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    {activeTab === "ATTENDANCE" && (
                        <div>
                            <input 
                                type="date" 
                                value={date} 
                                onChange={(e) => setDate(e.target.value)}
                                className="h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 font-bold text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
                            />
                        </div>
                    )}
                    <div>
                        <select 
                            disabled={isStoreAdmin}
                            value={selectedLocation} 
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            className="h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 font-bold text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
                        >
                            {!isStoreAdmin && <option value="ALL">🌐 All Stores</option>}
                            {locations.map(loc => <option key={loc.id} value={loc.id}>🏬 {loc.name}</option>)}
                        </select>
                    </div>
                </div>

                {activeTab === "ADVANCES" && (
                    <button
                        onClick={() => setShowAdvanceModal(true)}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" /> Record Salary Advance
                    </button>
                )}
            </div>

            {/* 1. ATTENDANCE TAB */}
            {activeTab === "ATTENDANCE" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-xs">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h2 className="text-base font-black text-slate-900 dark:text-white">
                            Staff Attendance Checklist for {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        </h2>
                        <span className="text-xs text-slate-400 font-bold">{staff.length} Employees Registered</span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {staff.map((member) => {
                            const record = attendance.find(a => a.userId === member.id);
                            const status = record?.status || "NOT_MARKED";

                            return (
                                <div key={member.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 flex items-center justify-center font-black text-teal-600 dark:text-teal-400 text-base">
                                            {member.name?.[0] || "S"}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-white text-sm">
                                                {member.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-medium">
                                                {member.role} • <span className="font-mono">{member.phone}</span>
                                            </p>
                                            {member.baseSalary && (
                                                <p className="text-[10px] text-teal-600 font-bold mt-0.5">
                                                    Base: ₹{Number(member.baseSalary).toLocaleString("en-IN")}/mo
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* 1-Click Status Toggles */}
                                    <div className="flex items-center gap-2">
                                        {[
                                            { key: "PRESENT", label: "Present", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
                                            { key: "HALF_DAY", label: "Half Day", color: "bg-amber-500 hover:bg-amber-600 text-white" },
                                            { key: "LEAVE", label: "Leave", color: "bg-indigo-600 hover:bg-indigo-700 text-white" },
                                            { key: "ABSENT", label: "Absent", color: "bg-rose-600 hover:bg-rose-700 text-white" }
                                        ].map((btn) => {
                                            const isSelected = status === btn.key;
                                            return (
                                                <button
                                                    key={btn.key}
                                                    onClick={() => handleQuickMark(member.id, btn.key)}
                                                    className={cn(
                                                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                                                        isSelected
                                                            ? `${btn.color} border-transparent shadow-xs scale-105`
                                                            : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                                    )}
                                                >
                                                    {isSelected && "✓ "}{btn.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 2. ADVANCES TAB */}
            {activeTab === "ADVANCES" && (
                <div className="space-y-6">
                    <div className="p-6 bg-linear-to-r from-teal-600 to-emerald-700 rounded-3xl text-white shadow-lg flex justify-between items-center">
                        <div>
                            <span className="text-xs uppercase font-bold text-teal-100 tracking-wider">Total Salary Advances Disbursed</span>
                            <h2 className="text-3xl font-black mt-1">₹{totalAdvanceAmount.toLocaleString("en-IN")}</h2>
                        </div>
                        <button
                            onClick={() => setShowAdvanceModal(true)}
                            className="px-5 py-2.5 bg-white text-teal-800 hover:bg-teal-50 font-black rounded-xl text-xs shadow-md cursor-pointer"
                        >
                            + Disburse Advance
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-xs">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-black text-slate-900 dark:text-white">Advances Ledger</h3>
                        </div>

                        {advances.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-xs">No salary advances recorded for this store.</div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                {advances.map((adv) => (
                                    <div key={adv.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white text-sm">
                                                {adv.staff?.name} ({adv.staff?.phone})
                                            </h4>
                                            <p className="text-slate-500 font-medium mt-0.5">
                                                Date: {new Date(adv.date).toLocaleDateString("en-IN")} • Mode: {adv.paymentMethod} {adv.notes && `• Note: ${adv.notes}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
                                                ₹{Number(adv.amount).toLocaleString("en-IN")}
                                            </span>
                                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full uppercase">
                                                {adv.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. ONBOARDING TAB */}
            {activeTab === "ONBOARD" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 max-w-2xl shadow-xs">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">Onboard New Staff Member</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Create employee identity with store assignment and monthly salary.</p>

                    <form onSubmit={handleOnboardSubmit} className="space-y-4 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={onboardForm.name}
                                    onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                                    placeholder="e.g. Sunil Shinde"
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Phone Number *</label>
                                <input
                                    type="tel"
                                    required
                                    value={onboardForm.phone}
                                    onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                                    placeholder="e.g. 9876543210"
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Role</label>
                                <select
                                    value={onboardForm.role}
                                    onChange={(e) => setOnboardForm({ ...onboardForm, role: e.target.value })}
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none cursor-pointer"
                                >
                                    <option value="POS_OPERATOR">POS Operator / Cashier</option>
                                    <option value="PACKING">Packing Staff</option>
                                    <option value="DELIVERY_PARTNER">Delivery Partner</option>
                                    <option value="MANAGER">Store Manager</option>
                                    <option value="STORE_ADMIN">Store Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Store Hub</label>
                                <select
                                    value={onboardForm.locationId}
                                    onChange={(e) => setOnboardForm({ ...onboardForm, locationId: e.target.value })}
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none cursor-pointer"
                                >
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Monthly Base Salary (₹)</label>
                                <input
                                    type="number"
                                    value={onboardForm.baseSalary}
                                    onChange={(e) => setOnboardForm({ ...onboardForm, baseSalary: e.target.value })}
                                    placeholder="e.g. 18000"
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Joining Date</label>
                                <input
                                    type="date"
                                    value={onboardForm.joiningDate}
                                    onChange={(e) => setOnboardForm({ ...onboardForm, joiningDate: e.target.value })}
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none cursor-pointer"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Password (Optional)</label>
                            <input
                                type="password"
                                value={onboardForm.password}
                                onChange={(e) => setOnboardForm({ ...onboardForm, password: e.target.value })}
                                placeholder="Temporary password"
                                className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={onboarding}
                            className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold uppercase rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                        >
                            {onboarding ? "Onboarding..." : "Complete Staff Onboarding"}
                        </button>
                    </form>
                </div>
            )}

            {/* Advance Record Modal */}
            {showAdvanceModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <form onSubmit={handleRecordAdvance} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-black text-slate-900 dark:text-white text-base">Record Salary Advance</h3>
                            <button type="button" onClick={() => setShowAdvanceModal(false)} className="text-slate-400 font-bold">✕</button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Staff Member *</label>
                                <select
                                    required
                                    value={advanceForm.staffId}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, staffId: e.target.value })}
                                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none cursor-pointer"
                                >
                                    <option value="">-- Select Staff Member --</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Amount (₹) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={advanceForm.amount}
                                        onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                        placeholder="e.g. 5000"
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Mode</label>
                                    <select
                                        value={advanceForm.paymentMethod}
                                        onChange={(e) => setAdvanceForm({ ...advanceForm, paymentMethod: e.target.value })}
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold outline-none cursor-pointer"
                                    >
                                        <option value="CASH">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Notes / Reason</label>
                                <input
                                    type="text"
                                    value={advanceForm.notes}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                                    placeholder="e.g. Emergency advance"
                                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button type="button" onClick={() => setShowAdvanceModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Cancel</button>
                            <button type="submit" disabled={savingAdvance} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs">Record Advance</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}