
"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { 
    Calendar, User, MapPin, Clock, Search, 
    CheckCircle2, XCircle, AlertCircle, 
    Filter, Download, ChevronLeft, ChevronRight
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AttendancePage() {
    const { user } = useUserStore();
    const [attendance, setAttendance] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocation, setSelectedLocation] = useState(user?.locationId || "ALL");
    const [staff, setStaff] = useState<any[]>([]);
    const [showMarkModal, setShowMarkModal] = useState(false);
    const [manualEntry, setManualEntry] = useState({ userId: "", status: "PRESENT" });

    const isStoreAdmin = user?.role === "STORE_ADMIN";

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        if (selectedLocation !== "ALL") {
            fetchAttendance();
            fetchStaff();
        }
    }, [date, selectedLocation]);

    const fetchLocations = async () => {
        try {
            const res = await api.get("/locations");
            setLocations(res.data);
            
            // Sovereignty Enforcement: Hub managers locked to local node
            if (isStoreAdmin && user?.locationId) {
                setSelectedLocation(user.locationId);
            } else if (!selectedLocation || selectedLocation === "ALL") {
                if (res.data.length > 0) setSelectedLocation(res.data[0].id);
            }
        } catch { toast.error("Failed to load locations"); }
    };

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/attendance/store/${selectedLocation}?date=${date}`);
            setAttendance(res.data);
        } catch { toast.error("Failed to load attendance"); }
        finally { setLoading(false); }
    };

    const fetchStaff = async () => {
        try {
            // Re-using users endpoint but filtering locally
            const res = await api.get("/users/admin/all");
            const localStaff = res.data.filter((u: any) => u.locationId === selectedLocation);
            setStaff(localStaff);
        } catch { /* Silent */ }
    };

    const handleManualMark = async () => {
        if (!manualEntry.userId) return toast.error("Select a staff member");
        try {
            await api.post("/attendance/mark", {
                ...manualEntry,
                locationId: selectedLocation
            });
            toast.success("Attendance marked manually");
            fetchAttendance();
            setShowMarkModal(false);
        } catch { toast.error("Failed to mark attendance"); }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-teal-500" />
                        Workforce Attendance
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Real-time staff presence monitoring across Hub nodes</p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)}
                        className="h-11 bg-white border border-slate-200 rounded-xl px-4 font-bold text-slate-900 outline-none focus:ring-2 ring-teal-500/20"
                    />
                    <select 
                        disabled={isStoreAdmin}
                        value={selectedLocation} 
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className={cn(
                            "h-11 bg-white border border-slate-200 rounded-xl px-4 font-bold text-slate-900 outline-none focus:ring-2 ring-teal-500/20",
                            isStoreAdmin && "opacity-50 cursor-not-allowed bg-slate-50"
                        )}
                    >
                        {!isStoreAdmin && <option value="ALL">All Hubs</option>}
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                    <Button 
                        onClick={() => setShowMarkModal(true)}
                        disabled={selectedLocation === "ALL"}
                        className="h-11 bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] uppercase rounded-xl shadow-lg shadow-teal-500/20"
                    >
                        Mark Presence
                    </Button>
                    <Button variant="outline" className="h-11 rounded-xl gap-2 font-bold">
                        <Download className="h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Scheduled</p>
                    <p className="text-3xl font-black text-slate-900">{attendance.length}</p>
                </div>
                <div className="bg-teal-50 border border-teal-100 rounded-3xl p-6">
                    <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">Present Today</p>
                    <p className="text-3xl font-black text-teal-700">{attendance.filter(a => a.status === "PRESENT").length}</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-3xl p-6">
                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Late Arrivals</p>
                    <p className="text-3xl font-black text-orange-700">{attendance.filter(a => a.status === "LATE").length}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-3xl p-6">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Absent/Unmarked</p>
                    <p className="text-3xl font-black text-red-700">{attendance.filter(a => a.status === "ABSENT").length}</p>
                </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Member</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Check-In Time</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Check-Out</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest">Loading records...</td></tr>
                        ) : attendance.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No attendance records for this date</td></tr>
                        ) : (
                            attendance.map((record) => (
                                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-teal-600">
                                                {record.user?.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900">{record.user?.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{record.user?.phone}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-600 font-bold tabular-nums">
                                            <Clock className="h-4 w-4 text-slate-300" />
                                            {new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold tabular-nums">
                                            <Clock className="h-4 w-4 text-slate-200" />
                                            {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Active"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                            record.status === "PRESENT" ? "bg-teal-100 text-teal-700" :
                                            record.status === "LATE" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                                        )}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" size="sm" className="font-bold text-slate-400 hover:text-teal-600">Details</Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Manual Mark Modal */}
            {showMarkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => setShowMarkModal(false)} />
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-60 overflow-hidden border border-slate-200 p-8">
                        <h3 className="text-xl font-black text-slate-900 uppercase mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-6 w-6 text-teal-500" />
                            Mark Manual Presence
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Regional Hub Manual Entry</p>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Select Staff</label>
                                <select 
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:bg-white focus:border-teal-500"
                                    value={manualEntry.userId}
                                    onChange={e => setManualEntry({...manualEntry, userId: e.target.value})}
                                >
                                    <option value="">Choose Employee...</option>
                                    {staff.map(u => <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Presence Status</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {["PRESENT", "LATE"].map(s => (
                                        <button 
                                            key={s}
                                            onClick={() => setManualEntry({...manualEntry, status: s})}
                                            className={cn(
                                                "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                manualEntry.status === s ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20" : "bg-white text-slate-400 border-slate-200 hover:border-teal-200"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button variant="outline" onClick={() => setShowMarkModal(false)} className="flex-1 h-12 rounded-xl uppercase text-[10px] font-black">Cancel</Button>
                                <Button onClick={handleManualMark} className="flex-[2] h-12 bg-slate-900 text-white rounded-xl uppercase text-[10px] font-black hover:bg-teal-600 transition-colors">Record Attendance</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}