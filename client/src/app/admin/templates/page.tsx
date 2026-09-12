"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import {
    MessageSquare, Sparkles, Settings2, Send, Clock, Plus, Trash2,
    CheckCircle2, AlertCircle, RefreshCw, Eye, Tag, ChevronRight,
    Store, Zap, HelpCircle, ArrowUpRight, Copy, Check, Smartphone,
    Layers, CheckCircle
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";

interface MetaTemplate {
    id?: string;
    name: string;
    category?: string;
    status?: string;
    language?: string;
    body?: string;
    variablesCount?: number;
    exampleVariables?: string[];
    header?: string | null;
    buttons?: any[];
    raw?: any;
}

export default function WhatsAppTemplatesPage() {
    const { user } = useUserStore();
    const [configs, setConfigs] = useState<any[]>([]);
    const [availableEvents, setAvailableEvents] = useState<any[]>([]);
    const [templates, setTemplates] = useState<MetaTemplate[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
    const [loading, setLoading] = useState(true);
    const [refreshingTemplates, setRefreshingTemplates] = useState(false);
    const [activeTab, setActiveTab] = useState<"TRIGGERS" | "TEMPLATES">("TRIGGERS");

    // Modal states
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showSendModal, setShowSendModal] = useState(false);
    const [editingConfig, setEditingConfig] = useState<any | null>(null);

    // Config form state
    const [selectedEventKey, setSelectedEventKey] = useState<string>("BILL_CREATED_PAID");
    const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
    const [customTemplateId, setCustomTemplateId] = useState<string>("");
    const [durationValue, setDurationValue] = useState<number>(7);
    const [durationUnit, setDurationUnit] = useState<string>("DAYS");
    const [variableMappings, setVariableMappings] = useState<string[]>([]);
    const [configLocationId, setConfigLocationId] = useState<string>("GLOBAL");
    const [configActive, setConfigActive] = useState<boolean>(true);
    const [saving, setSaving] = useState(false);

    // Manual Send State
    const [sendPhone, setSendPhone] = useState<string>("");
    const [sendTemplateName, setSendTemplateName] = useState<string>("");
    const [sendVariables, setSendVariables] = useState<string[]>([]);
    const [sending, setSending] = useState(false);

    const isStoreAdmin = user?.role === "STORE_ADMIN";

    useEffect(() => {
        fetchLocations();
        fetchTemplates();
        fetchConfigs();
    }, []);

    const fetchLocations = async () => {
        try {
            const res = await api.get("/locations");
            setLocations(res.data || []);
            if (isStoreAdmin && user?.locationId) {
                setSelectedLocation(user.locationId);
            }
        } catch { /* Silent */ }
    };

    const fetchTemplates = async () => {
        setRefreshingTemplates(true);
        try {
            const res = await api.get("/templates/available");
            const tpls: MetaTemplate[] = res.data?.templates || [];
            setTemplates(tpls);
            if (res.data?.availableEvents) {
                setAvailableEvents(res.data.availableEvents);
            }
        } catch (err: any) {
            console.error("Failed to load templates:", err);
            toast.error("Failed to fetch live templates from Meta API");
        } finally {
            setRefreshingTemplates(false);
        }
    };

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const query = selectedLocation !== "ALL" ? `?locationId=${selectedLocation}` : "";
            const res = await api.get(`/templates/configs${query}`);
            setConfigs(res.data?.configs || []);
            if (res.data?.availableEvents) {
                setAvailableEvents(res.data.availableEvents);
            }
        } catch (err: any) {
            toast.error("Failed to load event template configurations");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = (eventKey?: string) => {
        const targetEvent = availableEvents.find(e => e.key === (eventKey || "BILL_CREATED_PAID")) || availableEvents[0];
        setEditingConfig(null);
        setSelectedEventKey(targetEvent?.key || "BILL_CREATED_PAID");
        setDurationValue(targetEvent?.defaultDurationValue || 0);
        setDurationUnit(targetEvent?.defaultDurationUnit || "MINUTES");
        setConfigLocationId(selectedLocation !== "ALL" ? selectedLocation : "GLOBAL");
        setConfigActive(true);

        // Map default recommended template for this event
        const defaultTplName = targetEvent?.key === "BILL_CREATED_PAID" ? "bill_created"
            : targetEvent?.key === "BILL_CREATED_DUE" ? "bill_created_due"
            : targetEvent?.key === "PAYMENT_REMINDER" ? "due_payment_reminder"
            : targetEvent?.key === "PAYMENT_RECEIVED" ? "payment_received"
            : targetEvent?.key === "ORDER_CONFIRMATION" ? "order_confirmation"
            : targetEvent?.key === "FEEDBACK_REQUEST" ? "feedback_request"
            : targetEvent?.key === "CUSTOMER_INACTIVE" ? "fresh_order"
            : templates[0]?.name || "";

        setSelectedTemplateName(defaultTplName);
        setCustomTemplateId("");

        const matchedTpl = templates.find(t => t.name === defaultTplName);
        const count = matchedTpl?.variablesCount || targetEvent?.availableVariables?.length || 2;
        const initialVars = (targetEvent?.availableVariables || []).slice(0, count).map((v: any) => v.key);
        setVariableMappings(initialVars);

        setShowConfigModal(true);
    };

    const handleOpenEdit = (cfg: any) => {
        setEditingConfig(cfg);
        setSelectedEventKey(cfg.event);
        setSelectedTemplateName(cfg.templateId);
        setCustomTemplateId(cfg.templateId);
        setDurationValue(cfg.triggerDurationValue || 0);
        setDurationUnit(cfg.triggerDurationUnit || "DAYS");
        setConfigLocationId(cfg.locationId || "GLOBAL");
        setConfigActive(cfg.isActive);

        let mappingArr: string[] = [];
        if (Array.isArray(cfg.variableMapping)) {
            mappingArr = cfg.variableMapping;
        } else if (typeof cfg.variableMapping === "string") {
            try { mappingArr = JSON.parse(cfg.variableMapping); } catch { mappingArr = []; }
        }
        setVariableMappings(mappingArr);
        setShowConfigModal(true);
    };

    const handleEventChange = (newKey: string) => {
        setSelectedEventKey(newKey);
        const targetEvent = availableEvents.find(e => e.key === newKey);
        if (targetEvent) {
            setDurationValue(targetEvent.defaultDurationValue || 0);
            setDurationUnit(targetEvent.defaultDurationUnit || "MINUTES");
            const matchedTpl = templates.find(t => t.name === selectedTemplateName);
            const count = matchedTpl?.variablesCount || targetEvent.availableVariables.length;
            const vars = targetEvent.availableVariables.slice(0, count).map((v: any) => v.key);
            setVariableMappings(vars);
        }
    };

    const handleTemplateSelect = (tplName: string) => {
        setSelectedTemplateName(tplName);
        setCustomTemplateId(tplName);
        const matchedTpl = templates.find(t => t.name === tplName);
        const targetEvent = availableEvents.find(e => e.key === selectedEventKey);
        if (matchedTpl && targetEvent) {
            const count = matchedTpl.variablesCount ?? 2;
            const vars = targetEvent.availableVariables.slice(0, count).map((v: any) => v.key);
            while (vars.length < count) {
                vars.push(targetEvent.availableVariables[0]?.key || "customer.name");
            }
            setVariableMappings(vars);
        }
    };

    const handleSaveConfig = async () => {
        const effectiveTemplateId = customTemplateId.trim() || selectedTemplateName;
        if (!effectiveTemplateId) {
            return toast.error("Please enter or select a WhatsApp template ID");
        }

        setSaving(true);
        try {
            const payload = {
                id: editingConfig?.id,
                event: selectedEventKey,
                templateId: effectiveTemplateId,
                title: availableEvents.find(e => e.key === selectedEventKey)?.label,
                variableMapping: variableMappings,
                triggerDurationValue: Number(durationValue) || 0,
                triggerDurationUnit: durationUnit,
                locationId: configLocationId === "GLOBAL" ? null : configLocationId,
                isActive: configActive
            };

            await api.post("/templates/configs", payload);
            toast.success("WhatsApp template event configuration saved!");
            setShowConfigModal(false);
            fetchConfigs();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to save configuration");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteConfig = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template configuration?")) return;
        try {
            await api.delete(`/templates/configs/${id}`);
            toast.success("Configuration deleted.");
            fetchConfigs();
        } catch (err: any) {
            toast.error("Failed to delete configuration");
        }
    };

    // Open Manual Send Modal
    const handleOpenSendModal = (presetTemplateName?: string) => {
        const targetTplName = presetTemplateName || templates[0]?.name || "login";
        setSendTemplateName(targetTplName);
        const tpl = templates.find(t => t.name === targetTplName);
        const count = tpl?.variablesCount ?? 1;
        const examples = tpl?.exampleVariables || [];

        const initialVars = Array.from({ length: count }, (_, i) => examples[i] || "");
        setSendVariables(initialVars);
        setShowSendModal(true);
    };

    const handleSendTemplateChange = (tplName: string) => {
        setSendTemplateName(tplName);
        const tpl = templates.find(t => t.name === tplName);
        const count = tpl?.variablesCount ?? 1;
        const examples = tpl?.exampleVariables || [];
        const newVars = Array.from({ length: count }, (_, i) => examples[i] || "");
        setSendVariables(newVars);
    };

    const handleSendCustomMessage = async () => {
        if (!sendPhone || !sendTemplateName) {
            return toast.error("Phone number and template name are required.");
        }

        setSending(true);
        try {
            const res = await api.post("/templates/send-custom", {
                phone: sendPhone,
                templateName: sendTemplateName,
                variables: sendVariables
            });

            if (res.data?.success) {
                toast.success(res.data.message || `Message dispatched via template "${sendTemplateName}"!`);
                setShowSendModal(false);
            } else {
                toast.error(res.data?.message || "Failed to dispatch message");
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Message dispatch failed");
        } finally {
            setSending(false);
        }
    };

    const activeEvent = availableEvents.find(e => e.key === selectedEventKey);
    const selectedTplObj = templates.find(t => t.name === (customTemplateId || selectedTemplateName));
    const activeSendTplObj = templates.find(t => t.name === sendTemplateName);

    // Live preview of message body for Send Modal
    const livePreviewBody = useMemo(() => {
        if (!activeSendTplObj?.body) return "";
        let text = activeSendTplObj.body;
        sendVariables.forEach((val, idx) => {
            const placeholder = `{{${idx + 1}}}`;
            text = text.split(placeholder).join(val ? `*${val}*` : `[Variable ${idx + 1}]`);
        });
        return text;
    }, [activeSendTplObj, sendVariables]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                            <Sparkles className="w-3.5 h-3.5" /> No-Code Automation Engine
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-full text-sky-700 dark:text-sky-300 text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                            DigitalMBG Meta API Connected ({templates.length} Approved)
                        </span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <MessageSquare className="h-8 w-8 text-emerald-500" />
                        WhatsApp Template Engine
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Map live Meta WhatsApp templates to retail events, dues, and inactivity reminders with zero code.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => {
                            fetchTemplates();
                            toast.info("Refreshing templates from DigitalMBG Meta API...");
                        }}
                        disabled={refreshingTemplates}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        title="Sync templates live from DigitalMBG API"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", refreshingTemplates && "animate-spin text-emerald-500")} />
                        {refreshingTemplates ? "Syncing..." : "Sync Templates"}
                    </button>
                    <button
                        onClick={() => handleOpenSendModal()}
                        className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                        <Send className="w-4 h-4" /> Send Custom WhatsApp
                    </button>
                    <button
                        onClick={() => handleOpenCreate()}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> Configure Event Trigger
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab("TRIGGERS")}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
                            activeTab === "TRIGGERS"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Event Triggers & Automation ({configs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("TEMPLATES")}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
                            activeTab === "TEMPLATES"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        Meta Approved Templates ({templates.length})
                    </button>
                </div>

                {activeTab === "TRIGGERS" && (
                    <div className="flex items-center gap-2 text-xs">
                        <Store className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">Store Scope:</span>
                        <select
                            value={selectedLocation}
                            onChange={(e) => {
                                setSelectedLocation(e.target.value);
                                setTimeout(fetchConfigs, 50);
                            }}
                            disabled={isStoreAdmin}
                            className="h-8 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                        >
                            <option value="ALL">🌐 All Stores (Global + Local)</option>
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                    🏬 {loc.name} ({loc.slug})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* TAB 1: EVENT TRIGGERS GRID */}
            {activeTab === "TRIGGERS" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableEvents.map((evt) => {
                        const matchedConfigs = configs.filter(c => c.event === evt.key);
                        const hasActiveConfig = matchedConfigs.some(c => c.isActive);

                        return (
                            <div
                                key={evt.key}
                                className={cn(
                                    "p-6 rounded-[28px] border transition-all flex flex-col justify-between gap-5 relative overflow-hidden group shadow-xs",
                                    hasActiveConfig
                                        ? "bg-white dark:bg-slate-900/90 border-emerald-500/40 dark:border-emerald-500/30 hover:border-emerald-500 shadow-emerald-500/5"
                                        : "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300"
                                )}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                            {evt.category}
                                        </span>
                                        {hasActiveConfig ? (
                                            <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-0.5 rounded-full">
                                                Unconfigured
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                                            {evt.label}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                                            {evt.description}
                                        </p>
                                    </div>

                                    {/* Active Config Details */}
                                    {matchedConfigs.length > 0 && (
                                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                            {matchedConfigs.map((cfg) => (
                                                <div key={cfg.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5">
                                                    <div className="flex justify-between items-center font-bold">
                                                        <span className="text-slate-800 dark:text-slate-200 font-mono">
                                                            Template: <span className="text-emerald-600 dark:text-emerald-400">{cfg.templateId}</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {cfg.location?.name ? `🏬 ${cfg.location.name}` : "🌐 Global"}
                                                        </span>
                                                    </div>
                                                    {cfg.triggerDurationValue > 0 && (
                                                        <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                                                            <Clock className="w-3.5 h-3.5" /> Trigger after {cfg.triggerDurationValue} {cfg.triggerDurationUnit.toLowerCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <button
                                                            onClick={() => handleOpenEdit(cfg)}
                                                            className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                                                        >
                                                            Edit Mapping
                                                        </button>
                                                        <span className="text-slate-300">|</span>
                                                        <button
                                                            onClick={() => handleDeleteConfig(cfg.id)}
                                                            className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleOpenCreate(evt.key)}
                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Settings2 className="w-3.5 h-3.5" />
                                    {matchedConfigs.length > 0 ? "Add Store Override" : "Configure Event"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* TAB 2: META APPROVED TEMPLATES EXPLORER */}
            {activeTab === "TEMPLATES" && (
                <div className="space-y-6">
                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                    DigitalMBG Live Meta WhatsApp Templates ({templates.length})
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Direct integration with <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">chatbotbe.digitalmbg.com</code> using official Meta Cloud API.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => fetchTemplates()}
                            disabled={refreshingTemplates}
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                        >
                            <RefreshCw className={cn("w-3 h-3", refreshingTemplates && "animate-spin")} />
                            Sync Now
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map((tpl) => (
                            <div
                                key={tpl.id || tpl.name}
                                className="p-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-[28px] shadow-xs flex flex-col justify-between gap-4 hover:border-emerald-500/50 transition-all group"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                                            tpl.category === "AUTHENTICATION" ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" :
                                            tpl.category === "MARKETING" ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" :
                                            "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                        )}>
                                            {tpl.category || "UTILITY"}
                                        </span>

                                        <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                                            {tpl.status || "APPROVED"}
                                        </span>
                                    </div>

                                    <div>
                                        <div className="font-mono text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                                            {tpl.name}
                                        </div>
                                        {tpl.id && (
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                ID: {tpl.id}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs font-normal text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto">
                                        {tpl.body || "No preview text available."}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        <span className="text-[10px] font-bold text-slate-400">
                                            Variables ({tpl.variablesCount || 0}):
                                        </span>
                                        {tpl.exampleVariables && tpl.exampleVariables.length > 0 ? (
                                            tpl.exampleVariables.map((ex, i) => (
                                                <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                                                    {`{{${i + 1}}}: ${ex}`}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-[10px] text-slate-400 italic">None</span>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                                    <button
                                        onClick={() => handleOpenSendModal(tpl.name)}
                                        className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Send className="w-3.5 h-3.5" /> Test Dispatch
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CONFIG MODAL */}
            {showConfigModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Settings2 className="w-5 h-5 text-emerald-500" />
                                    {editingConfig ? "Edit WhatsApp Event Trigger" : "Configure WhatsApp Event Trigger"}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                    Link template parameters to dynamic variables with zero code.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* 1. Event Selection */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    1. Trigger Retail Event
                                </label>
                                <select
                                    value={selectedEventKey}
                                    onChange={(e) => handleEventChange(e.target.value)}
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none"
                                >
                                    {availableEvents.map(e => (
                                        <option key={e.key} value={e.key}>
                                            {e.label} ({e.category})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Timing Configuration (Days / Hours) */}
                            <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    2. Trigger Duration & Timing
                                </label>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Specify when to fire this notification (e.g. 0 for immediate on checkout, or 7 days for inactivity/dues).
                                </p>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Duration Value</label>
                                        <input
                                            type="number"
                                            value={durationValue}
                                            onChange={(e) => setDurationValue(Number(e.target.value))}
                                            min="0"
                                            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Duration Unit</label>
                                        <select
                                            value={durationUnit}
                                            onChange={(e) => setDurationUnit(e.target.value)}
                                            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none cursor-pointer"
                                        >
                                            <option value="MINUTES">Minutes (Immediate/Testing)</option>
                                            <option value="HOURS">Hours (Quick follow-up)</option>
                                            <option value="DAYS">Days (Standard reminder)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Template Selection & Discovery */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    3. Meta / Easebuzz WhatsApp Template
                                </label>
                                <div className="space-y-2">
                                    <select
                                        value={selectedTemplateName}
                                        onChange={(e) => handleTemplateSelect(e.target.value)}
                                        className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                                    >
                                        <option value="">-- Select from Approved Meta Templates --</option>
                                        {templates.map(t => (
                                            <option key={t.name} value={t.name}>
                                                {t.name} ({t.category || "UTILITY"})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customTemplateId}
                                            onChange={(e) => setCustomTemplateId(e.target.value)}
                                            placeholder="Or enter custom Template ID / Name manually"
                                            className="flex-1 h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                                        />
                                    </div>
                                </div>

                                {selectedTplObj?.body && (
                                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs font-medium text-emerald-900 dark:text-emerald-300 leading-relaxed">
                                        <span className="font-bold block uppercase text-[10px] tracking-wider mb-1 text-emerald-700 dark:text-emerald-400">Template Preview:</span>
                                        {selectedTplObj.body}
                                    </div>
                                )}
                            </div>

                            {/* 4. Dynamic Variable Mapping */}
                            <div className="space-y-2.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                    <span>4. Map Template Variables ({`{{1}}`}, {`{{2}}`}, etc.)</span>
                                    <button
                                        type="button"
                                        onClick={() => setVariableMappings([...variableMappings, activeEvent?.availableVariables[0]?.key || "customer.name"])}
                                        className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                                    >
                                        + Add Parameter
                                    </button>
                                </label>

                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {variableMappings.map((mappedVar, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                                            <span className="font-mono font-black text-slate-500 dark:text-slate-400 w-14">
                                                {`{{${idx + 1}}}`}
                                            </span>
                                            <span className="text-slate-400 font-bold">➔</span>
                                            <select
                                                value={mappedVar}
                                                onChange={(e) => {
                                                    const updated = [...variableMappings];
                                                    updated[idx] = e.target.value;
                                                    setVariableMappings(updated);
                                                }}
                                                className="flex-1 h-9 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-800 dark:text-slate-200 outline-none"
                                            >
                                                {(activeEvent?.availableVariables || []).map((v: any) => (
                                                    <option key={v.key} value={v.key}>
                                                        {v.label} ({v.key})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = variableMappings.filter((_, i) => i !== idx);
                                                    setVariableMappings(updated);
                                                }}
                                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center font-bold"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 5. Scope & Status */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Store Scope</label>
                                    <select
                                        value={configLocationId}
                                        onChange={(e) => setConfigLocationId(e.target.value)}
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                                    >
                                        <option value="GLOBAL">🌐 Global (All Stores)</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                🏬 {loc.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                                    <select
                                        value={configActive ? "true" : "false"}
                                        onChange={(e) => setConfigActive(e.target.value === "true")}
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                                    >
                                        <option value="true">Active (Automated Dispatch)</option>
                                        <option value="false">Paused / Inactive</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowConfigModal(false)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveConfig}
                                disabled={saving}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save Trigger Configuration"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SEND CUSTOM WHATSAPP MODAL WITH LIVE PREVIEW */}
            {showSendModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Send className="w-5 h-5 text-emerald-500" />
                                    Send Meta WhatsApp Template
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Dispatched directly via DigitalMBG Meta API (<code className="text-emerald-600 font-mono">/send_meta_templet</code>).
                                </p>
                            </div>
                            <button
                                onClick={() => setShowSendModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Recipient Phone Number</label>
                                <input
                                    type="text"
                                    value={sendPhone}
                                    onChange={(e) => setSendPhone(e.target.value)}
                                    placeholder="e.g. 917879431560 or 9876543210"
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none"
                                />
                                <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                                    Tip: 10-digit mobile numbers are automatically prefixed with 91 for Indian recipients.
                                </span>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Template Name</label>
                                <select
                                    value={sendTemplateName}
                                    onChange={(e) => handleSendTemplateChange(e.target.value)}
                                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                                >
                                    {templates.map(t => (
                                        <option key={t.name} value={t.name}>
                                            {t.name} ({t.category || "UTILITY"} • {t.variablesCount || 0} vars)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Dynamic Variables Input */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                                        Body Variables ({sendVariables.length})
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setSendVariables([...sendVariables, ""])}
                                        className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                                    >
                                        + Add Variable
                                    </button>
                                </div>

                                {sendVariables.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">This template requires no variables.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {sendVariables.map((val, idx) => {
                                            const exampleHint = activeSendTplObj?.exampleVariables?.[idx];
                                            return (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-slate-500 w-14">
                                                        {`{{${idx + 1}}}:`}
                                                    </span>
                                                    <input
                                                        type="text"
                                                        value={val}
                                                        onChange={(e) => {
                                                            const updated = [...sendVariables];
                                                            updated[idx] = e.target.value;
                                                            setSendVariables(updated);
                                                        }}
                                                        placeholder={exampleHint ? `e.g. ${exampleHint}` : `Value for {{${idx + 1}}}`}
                                                        className="flex-1 h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none"
                                                    />
                                                    {sendVariables.length > (activeSendTplObj?.variablesCount || 0) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSendVariables(sendVariables.filter((_, i) => i !== idx))}
                                                            className="text-rose-500 hover:bg-rose-50 rounded px-2 py-1 text-xs font-bold"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Live WhatsApp Bubble Preview */}
                            {livePreviewBody && (
                                <div className="space-y-1.5 pt-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                        <Smartphone className="w-3 h-3 text-emerald-500" />
                                        Live WhatsApp Message Preview
                                    </label>
                                    <div className="p-4 bg-[#e5ddd5] dark:bg-[#121b22] rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <div className="max-w-[85%] bg-white dark:bg-[#1f2c34] text-slate-900 dark:text-slate-100 p-3.5 rounded-2xl rounded-tl-xs shadow-xs text-xs whitespace-pre-line leading-relaxed border border-black/5 dark:border-white/5">
                                            {livePreviewBody}
                                            <div className="text-[9px] text-slate-400 text-right mt-1.5 flex items-center justify-end gap-1">
                                                <span>Just now</span>
                                                <Check className="w-2.5 h-2.5 text-sky-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowSendModal(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSendCustomMessage}
                                disabled={sending || !sendPhone}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {sending ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-3.5 h-3.5" />
                                        Dispatch Message
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
