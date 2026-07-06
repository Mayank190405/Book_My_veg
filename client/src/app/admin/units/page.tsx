"use client";

import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Scale,
    Save,
    X,
    Activity,
    Check,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function AdminUnits() {
    const [units, setUnits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchUnits = async () => {
        setLoading(true);
        try {
            const response = await api.get("/units");
            setUnits(response.data);
        } catch (error) {
            toast.error("Failed to synchronize with central unit registry");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUnits();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingUnit.id) {
                await api.put(`/units/${editingUnit.id}`, editingUnit);
                toast.success("Unit updated successfully");
            } else {
                await api.post("/units", editingUnit);
                toast.success("New unit standard created");
            }
            fetchUnits();
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Protocol validation failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will remove the unit standard from the registry.")) return;
        try {
            await api.delete(`/units/${id}`);
            toast.success("Unit deleted successfully");
            fetchUnits();
        } catch (error) {
            toast.error("Failed to delete unit");
        }
    };

    const filteredUnits = useMemo(() => {
        if (!Array.isArray(units)) return [];
        return units.filter(u =>
            u.name?.toLowerCase().includes(search.toLowerCase()) ||
            u.symbol?.toLowerCase().includes(search.toLowerCase())
        );
    }, [units, search]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Measurement Standards</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage global unit protocols for merchandise and inventory.</p>
                </div>

                <button
                    onClick={() => {
                        setEditingUnit({
                            name: "",
                            symbol: "",
                            isActive: true
                        });
                        setIsModalOpen(true);
                    }}
                    className="h-12 bg-emerald-600 text-white px-8 rounded-xl flex items-center justify-center gap-3 shadow-md shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all font-semibold"
                >
                    <Plus className="h-5 w-5" />
                    <span>Initialize Unit</span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="w-full lg:max-w-md relative group text-slate-900">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                <input
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-400 font-medium"
                    placeholder="Search unit standards by name or symbol..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {loading ? (
                    [1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))
                ) : (
                    filteredUnits.map((unit) => (
                        <div key={unit.id} className="group bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:border-emerald-200 transition-all duration-300">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-emerald-50 transition-colors">
                                        <Scale className="h-5 w-5 text-slate-400 group-hover:text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{unit.name}</h3>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-black uppercase tracking-widest">{unit.symbol || "UNIT"}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => { setEditingUnit(unit); setIsModalOpen(true); }}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(unit.id)}
                                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
                        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Unit Standard Editor</h3>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black opacity-60">Measurement Registry</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-10 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Internal Title</Label>
                                <input
                                    required
                                    value={editingUnit?.name || ""}
                                    onChange={e => setEditingUnit({ ...editingUnit, name: e.target.value })}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    placeholder="e.g., Kilogram"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Network Symbol</Label>
                                <input
                                    required
                                    value={editingUnit?.symbol || ""}
                                    onChange={e => setEditingUnit({ ...editingUnit, symbol: e.target.value })}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    placeholder="e.g., KG"
                                />
                            </div>
                            <div className="pt-6">
                                <button
                                    disabled={submitting}
                                    className="w-full h-14 bg-slate-900 text-white rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
                                >
                                    {submitting ? <Activity className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                    <span>Synchronize Unit</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
