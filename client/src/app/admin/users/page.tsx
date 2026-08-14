"use client";

import { 
    Users, 
    Search, 
    Filter, 
    Edit2,
    Trash2,
    Shield,
    Smartphone,
    UserCircle,
    BadgeCheck,
    Clock,
    Activity,
    Lock,
    Store,
    Save,
    X,
    ShieldCheck,
    Key,
    Plus,
    UserPlus,
    FileUp,
    FileDown,
    Download,
    MapPin
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/useUserStore";
import Papa from "papaparse";

export default function AdminUsers() {
    const { user: currentUser } = useUserStore();
    const [users, setUsers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    
    const isStoreAdmin = currentUser?.role === "STORE_ADMIN";

    // Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [newUser, setNewUser] = useState({
        name: "",
        phone: "",
        email: "",
        role: "USER",
        locationId: "",
        password: "",
        baseSalary: "",
        joiningDate: new Date().toISOString().split('T')[0]
    });
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadTemplate = () => {
        const templateData = [{
            "Name": "John Doe",
            "Number": "9876543210",
            "Address": "123 Green Street, Hub City",
            "Email": "john@example.com",
            "Due": "500.00"
        }];
        const csv = Papa.unparse(templateData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `customer_import_template.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Import template generated.");
    };

    const handleExport = () => {
        try {
            const exportData = filteredUsers.map(u => ({
                "Name": u.name,
                "Number": u.phone,
                "Address": u.profileAddress || "",
                "Email": u.email || "",
                "Role": u.role,
                "Status": u.isActive ? "Active" : "Disabled",
                "Due": u.totalDue || 0
            }));
            const csv = Papa.unparse(exportData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `staff_directory_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Directory exported successfully");
        } catch (error) {
            toast.error("Export protocol failure");
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: async (results) => {
                setSubmitting(true);
                toast.info(`Initializing bulk synchronization of ${results.data.length} records...`);

                const formattedUsers = (results.data as any[])
                    .filter(row => (row["Name"] || row["name"] || row["Full Name"]) && (row["Number"] || row["number"] || row["Phone"] || row["phone"]))
                    .map(row => ({
                        name: (row["Name"] || row["name"] || row["Full Name"]).toString().trim(),
                        phone: (row["Number"] || row["number"] || row["Phone"] || row["phone"]).toString().trim(),
                        email: row["Email"] || row["email"] || null,
                        profileAddress: row["Address"] || row["address"] || row["Location"] || null,
                        totalDue: parseFloat(row["Due"] || row["due"] || "0") || 0,
                        role: "USER",
                        isActive: true,
                        password: "user123",
                        locationId: isStoreAdmin ? currentUser?.locationId : null
                    }));

                try {
                    const response = await api.post("/users/admin/bulk-ingest", { users: formattedUsers });
                    toast.success(`Sync Complete: ${response.data.success} users processed, ${response.data.failed} failures.`);
                    fetchUsers();
                } catch (err: any) {
                    toast.error(err.response?.data?.message || "Bulk synchronization failure.");
                } finally {
                    setSubmitting(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                }
            }
        });
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get("/users/admin/all");
            setUsers(res.data);
        } catch (error) {
            toast.error("Failed to fetch user directory");
        } finally {
            setLoading(false);
        }
    };

    const fetchLocations = async () => {
        try {
            const res = await api.get("/locations");
            setLocations(res.data);
        } catch (error) {
            console.error("Failed to load store locations");
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchLocations();
    }, []);

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await api.patch(`/users/admin/update/${editingUser.id}`, {
                name: editingUser.name,
                email: editingUser.email,
                role: editingUser.role,
                locationId: editingUser.locationId,
                password: editingUser.newPassword,
                isActive: editingUser.isActive,
                baseSalary: editingUser.baseSalary ? parseFloat(editingUser.baseSalary) : null,
                joiningDate: editingUser.joiningDate
            });
            
            toast.success("User Profile Updated");
            fetchUsers();
            setIsEditModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to update user profile");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Auto-assign location for Hub Managers
            const data = {
                ...newUser,
                locationId: isStoreAdmin ? currentUser?.locationId : newUser.locationId
            };
            
            await api.post("/users/admin/create", data);
            toast.success("Staff Member Registered", {
                description: `${newUser.name} added to the merchandise registry.`
            });
            fetchUsers();
            setIsCreateModalOpen(false);
            setNewUser({ 
                name: "", phone: "", email: "", role: "USER", 
                locationId: "", password: "", baseSalary: "", 
                joiningDate: new Date().toISOString().split('T')[0] 
            });
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Registration protocol failure");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredUsers = useMemo(() => {
        if (!Array.isArray(users)) return [];
        return users.filter(user => {
            const matchesSearch = 
                user.name?.toLowerCase().includes(search.toLowerCase()) || 
                user.phone?.toLowerCase().includes(search.toLowerCase()) ||
                user.email?.toLowerCase().includes(search.toLowerCase());
            const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [users, search, roleFilter]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="px-1 md:px-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">User Directory</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage system access, roles, and location assignments.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-white border border-slate-200 p-2 pr-4 rounded-xl flex items-center gap-4 shadow-sm group hover:border-emerald-200 transition-all">
                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                            <BadgeCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Registry</p>
                            <span className="text-sm font-bold text-slate-900 tabular-nums">{users.length}</span>
                        </div>
                    </div>

                    <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleExport}
                            className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm"
                            title="Export Directory"
                        >
                            <FileDown className="h-5 w-5" />
                        </button>
                        <button 
                            onClick={handleDownloadTemplate}
                            className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all shadow-sm"
                            title="Download Template"
                        >
                            <Download className="h-5 w-5" />
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={submitting}
                            className="h-12 bg-slate-900 text-white px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-emerald-600 active:scale-95 transition-all font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                        >
                            {submitting ? <Activity className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                            <span>Bulk Import</span>
                        </button>
                    </div>
                    
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="h-12 bg-emerald-600 text-white px-8 rounded-xl flex items-center justify-center gap-3 shadow-md hover:bg-slate-900 active:scale-95 transition-all font-bold text-[10px] uppercase tracking-widest flex-1 md:flex-none"
                    >
                        <UserPlus className="h-4 w-4" />
                        <span>Register Staff</span>
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="md:col-span-2 relative group flex items-center">
                    <Search className="absolute left-4 h-5 w-5 text-slate-400 group-focus-within/input:text-emerald-600 transition-colors" />
                    <input 
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-400"
                        placeholder="Search by Name, Email, or Phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-4 lg:col-span-2">
                    <div className="flex-1 h-12 bg-white border border-slate-200 rounded-xl flex items-center px-4 gap-3 shadow-sm group hover:border-blue-200 transition-all">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <select 
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer flex-1 appearance-none"
                        >
                            <option value="ALL">Role: ALL</option>
                            {!isStoreAdmin && (
                                <>
                                    <option value="ADMIN">ADMINISTRATOR</option>
                                    <option value="STORE_ADMIN">STORE MANAGER</option>
                                </>
                            )}
                            <option value="MANAGER">HUB SUPERVISOR</option>
                            <option value="PURCHASE_MANAGER">PURCHASE MANAGER</option>
                            <option value="POS_OPERATOR">POS OPERATOR</option>
                            <option value="PACKING">PACKER</option>
                            <option value="DELIVERY_PARTNER">DELIVERY DRIVER</option>
                            <option value="USER">BASE CUSTOMER</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Details</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Location</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Account Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-12 py-16">
                                            <div className="h-16 w-full bg-foreground/5 rounded-3xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden flex-shrink-0">
                                                    {user.name?.[0] ? (
                                                        <span className="text-lg font-bold text-slate-600">{user.name[0]}</span>
                                                    ) : (
                                                        <UserCircle className="h-6 w-6 text-slate-200" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-slate-900 truncate">{user.name || "UNREGISTERED"}</h4>
                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                                <Smartphone className="h-3 w-3" /> {user.phone}
                                                            </span>
                                                            {user.baseSalary && (
                                                                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider bg-teal-50 px-1.5 py-0.5 rounded leading-none">
                                                                    ₹{Number(user.baseSalary).toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {(user.addresses?.[0]?.fullAddress || user.profileAddress) && (
                                                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 truncate max-w-[200px]" title={user.addresses?.[0]?.fullAddress || user.profileAddress}>
                                                                <MapPin className="h-3 w-3 text-emerald-500/40" />
                                                                <span className="truncate">{user.addresses?.[0]?.fullAddress || user.profileAddress}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className={cn(
                                                "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border text-center inline-block whitespace-nowrap",
                                                user.role === "ADMIN" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                                                user.role === "STORE_ADMIN" && "bg-blue-50 text-blue-600 border-blue-100",
                                                user.role === "PURCHASE_MANAGER" && "bg-teal-50 text-teal-700 border-teal-200",
                                                user.role === "POS_OPERATOR" && "bg-amber-50 text-amber-600 border-amber-100",
                                                user.role === "PACKING" && "bg-purple-50 text-purple-600 border-purple-100",
                                                user.role === "DELIVERY_PARTNER" && "bg-indigo-50 text-indigo-600 border-indigo-100",
                                                user.role === "USER" && "bg-slate-50 text-slate-500 border-slate-100"
                                            )}>
                                                {user.role?.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                                                <Store className="h-3 w-3" /> {user.location?.name || "Global / None"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex justify-center">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                                                    user.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                                                )}>
                                                    {user.isActive ? "Active" : "Disabled"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <button 
                                                onClick={() => {
                                                    setEditingUser({ ...user, newPassword: "" });
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-all border border-slate-100"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Directory Updated: {format(new Date(), "HH:mm:ss")}</span>
                    </div>
                </div>
            </div>

            {/* Edit User Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setIsEditModalOpen(false)} />
                    <div className="bg-white w-[95vw] md:w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 border border-slate-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Edit User Account</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Modify user credentials and system access levels.</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-6 md:p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</Label>
                                    <input 
                                        value={editingUser.name || ""}
                                        onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                        placeholder="User name..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role Assignment</Label>
                                    <select 
                                        value={editingUser.role}
                                        onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all appearance-none cursor-pointer"
                                    >
                                        {!isStoreAdmin && (
                                            <>
                                                <option value="ADMIN">Super Admin</option>
                                                <option value="STORE_ADMIN">Hub Manager</option>
                                            </>
                                        )}
                                        <option value="MANAGER">Hub Supervisor</option>
                                        <option value="PURCHASE_MANAGER">Purchase Manager (P&L / Procurement)</option>
                                        <option value="POS_OPERATOR">POS Operator</option>
                                        <option value="PACKING">Packer / Fulfillment</option>
                                        <option value="DELIVERY_PARTNER">Delivery Partner</option>
                                        <option value="USER">Standard Customer</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Storage Node (Location)</Label>
                                    <select 
                                        value={editingUser.locationId || ""}
                                        onChange={e => setEditingUser({...editingUser, locationId: e.target.value})}
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Global / Unassigned</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Base Salary (₹)</Label>
                                    <input 
                                        type="number"
                                        value={editingUser.baseSalary || ""}
                                        onChange={e => setEditingUser({...editingUser, baseSalary: e.target.value})}
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                        placeholder="e.g. 25000"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security Credential (Password Override)</Label>
                                <div className="relative">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="password"
                                        value={editingUser.newPassword || ""}
                                        onChange={e => setEditingUser({...editingUser, newPassword: e.target.value})}
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                        placeholder="Enter new password to override..."
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium">Leave blank to keep existing password.</p>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                <input 
                                    type="checkbox"
                                    id="isActive"
                                    checked={editingUser.isActive}
                                    onChange={e => setEditingUser({...editingUser, isActive: e.target.checked})}
                                    className="w-5 h-5 rounded-md border-slate-200 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                                />
                                <Label htmlFor="isActive" className="text-xs font-bold text-emerald-700 cursor-pointer">Account Active and Enabled</Label>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 active:scale-95 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    disabled={submitting}
                                    type="submit"
                                    className="flex-[2] h-12 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                                >
                                    {submitting ? (
                                        <Activity className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="h-5 w-5" />
                                            Save User Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Create User Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setIsCreateModalOpen(false)} />
                    <div className="bg-white w-[95vw] md:w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-4 duration-300 border border-slate-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                                    <UserPlus className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Onboard New Staff</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Initialize regional personnel registry</p>
                                </div>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 md:p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</Label>
                                    <input 
                                        required
                                        value={newUser.name}
                                        onChange={e => setNewUser({...newUser, name: e.target.value})}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                                        placeholder="Regional Staff Name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Role Assignment</Label>
                                    <select 
                                        required
                                        value={newUser.role}
                                        onChange={e => setNewUser({...newUser, role: e.target.value})}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                                    >
                                        {!isStoreAdmin && (
                                            <>
                                                <option value="ADMIN">Super Administrator</option>
                                                <option value="STORE_ADMIN">Hub Manager</option>
                                            </>
                                        )}
                                        <option value="MANAGER">Hub Supervisor</option>
                                        <option value="PURCHASE_MANAGER">Purchase Manager (P&L / Procurement)</option>
                                        <option value="POS_OPERATOR">POS Operator</option>
                                        <option value="PACKING">Packer / Fulfillment</option>
                                        <option value="DELIVERY_PARTNER">Delivery Partner</option>
                                        <option value="USER">Customer Support</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phone Number (Login ID)</Label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input 
                                            required
                                            value={newUser.phone}
                                            onChange={e => setNewUser({...newUser, phone: e.target.value})}
                                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                                            placeholder="Primary Mobile"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Security Credential</Label>
                                    <div className="relative">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input 
                                            required
                                            type="password"
                                            value={newUser.password}
                                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                                            placeholder="Set Access Password"
                                        />
                                    </div>
                                </div>
                            </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Hub Assignment</Label>
                                    <select 
                                        value={newUser.locationId}
                                        onChange={e => setNewUser({...newUser, locationId: e.target.value})}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Global Network (No Local Hub)</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Base Monthly Salary (₹)</Label>
                                    <input 
                                        type="number"
                                        value={newUser.baseSalary}
                                        onChange={e => setNewUser({...newUser, baseSalary: e.target.value})}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                                        placeholder="Amount in ₹"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 h-14 rounded-2xl border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                                >
                                    Abort
                                </button>
                                <button 
                                    disabled={submitting}
                                    type="submit"
                                    className="flex-[2] h-14 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-slate-200"
                                >
                                    {submitting ? (
                                        <Activity className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <BadgeCheck className="h-5 w-5" />
                                            Initialize Staff Profile
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
