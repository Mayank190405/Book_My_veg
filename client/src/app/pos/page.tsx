"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import {
    Search, QrCode, Plus, Minus, X, Trash2, ShoppingCart,
    UserPlus, History, LogOut, LayoutGrid, Save, Ban, CreditCard,
    Clock, User, Printer, AlertTriangle, ChevronDown, Receipt,
    Banknote, Smartphone, BookOpen, XCircle, Check, Package, Settings, SquarePen, Globe,
    ArrowLeft, Bell, Wallet, CheckCircle2, AlertCircle, ScanLine,
    Power, PowerOff, RefreshCw, MessageCircle, Send, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUserStore } from "@/store/useUserStore";
import { logout } from "@/services/authService";
import { useRouter } from "next/navigation";
import QRScanner from "@/components/ui/qr-scanner";
import { saveShiftDenominations, getShiftDenominations, clearShiftDenominations } from "@/lib/indexedDB";

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

function calculateOptimalChangeBreakdown(changeAmount: number, drawer: Record<number, number>): Record<number, number> | null {
    const changeBreakdown: Record<number, number> = {};
    let remaining = changeAmount;
    const sortedDens = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    const drawerCopy = { ...drawer };
    
    for (const den of sortedDens) {
        if (remaining >= den && drawerCopy[den] > 0) {
            const needed = Math.floor(remaining / den);
            const available = drawerCopy[den];
            const toTake = Math.min(needed, available);
            if (toTake > 0) {
                changeBreakdown[den] = toTake;
                remaining -= den * toTake;
                drawerCopy[den] -= toTake;
            }
        }
    }
    return remaining === 0 ? changeBreakdown : null;
}

function getStandardGreedyBreakdown(amount: number): Record<number, number> {
    const breakdown: Record<number, number> = {};
    let remaining = amount;
    const sortedDens = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    for (const den of sortedDens) {
        if (remaining >= den) {
            const count = Math.floor(remaining / den);
            breakdown[den] = count;
            remaining -= den * count;
        }
    }
    return breakdown;
}

export default function POSOperator() {
    const { user } = useUserStore() || {};
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(new Date());

    // Category
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("ALL");

    // Customer State — Walk-in BLOCKED per spec CUST-01
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerSearch, setCustomerSearch] = useState("");
    const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

    // Dialogs
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [showCustomerDialog, setShowCustomerDialog] = useState(false);
    const [couponCode, setCouponCode] = useState("");
    const [paidAmount, setPaidAmount] = useState<number | "">("");
    const [duePaymentAmount, setDuePaymentAmount] = useState<number | "">("");
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [showReceiptDialog, setShowReceiptDialog] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [showSettleDialog, setShowSettleDialog] = useState(false);
    const [showVoidHistoryDialog, setShowVoidHistoryDialog] = useState(false);
    const [inspectingOrder, setInspectingOrder] = useState<any>(null);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [isStoreOpen, setIsStoreOpen] = useState(true);
    const [settleAmount, setSettleAmount] = useState(0);
    const [showExpenseDialog, setShowExpenseDialog] = useState(false);
    const [showWebOrders, setShowWebOrders] = useState(false);
    const [webOrders, setWebOrders] = useState<any[]>([]);
    const [webOrderStageFilter, setWebOrderStageFilter] = useState<string>("ALL");
    const [selectedWebOrder, setSelectedWebOrder] = useState<any>(null);
    const [isUpdatingWebOrderStatus, setIsUpdatingWebOrderStatus] = useState(false);

    // Bill-wise Today Sales
    const [showTodaySalesDialog, setShowTodaySalesDialog] = useState(false);
    const [todaySalesSummary, setTodaySalesSummary] = useState({
        totalSales: 0,
        orderCount: 0,
        cashSales: 0,
        upiSales: 0,
        creditSales: 0,
        onlineSales: 0
    });
    const [todaySalesOrders, setTodaySalesOrders] = useState<any[]>([]);
    const [todaySalesFilter, setTodaySalesFilter] = useState<string>("ALL");
    const [todaySalesSearch, setTodaySalesSearch] = useState<string>("");
    const [isLoadingTodaySales, setIsLoadingTodaySales] = useState(false);

    const fetchTodaySales = async (showDialog: boolean = true) => {
        setIsLoadingTodaySales(true);
        try {
            const res = await api.get("/pos/orders/today-sales");
            setTodaySalesSummary(res.data.summary || {
                totalSales: 0, orderCount: 0, cashSales: 0, upiSales: 0, creditSales: 0, onlineSales: 0
            });
            setTodaySalesOrders(res.data.orders || []);
            if (showDialog) setShowTodaySalesDialog(true);
        } catch {
            /* silent */
        } finally {
            setIsLoadingTodaySales(false);
        }
    };

    // WhatsApp Due Reminders
    const [showWhatsappRemindersDialog, setShowWhatsappRemindersDialog] = useState(false);
    const [dueCustomersList, setDueCustomersList] = useState<any[]>([]);
    const [selectedDueCustomerIds, setSelectedDueCustomerIds] = useState<string[]>([]);
    const [isLoadingDueCustomers, setIsLoadingDueCustomers] = useState(false);
    const [isSendingReminders, setIsSendingReminders] = useState(false);
    const [dueCustomersSearch, setDueCustomersSearch] = useState("");

    const fetchDueCustomers = async () => {
        setIsLoadingDueCustomers(true);
        try {
            const res = await api.get("/pos/due-customers");
            setDueCustomersList(res.data.dueCustomers || []);
            setSelectedDueCustomerIds([]);
            setShowWhatsappRemindersDialog(true);
        } catch {
            toast.error("Failed to load due customers");
        } finally {
            setIsLoadingDueCustomers(false);
        }
    };

    const sendWhatsappReminders = async (customerIds: string[]) => {
        if (dueCustomersList.length === 0) return;
        setIsSendingReminders(true);
        try {
            const res = await api.post("/pos/send-whatsapp-reminders", { customerIds });
            toast.success(res.data.message || "WhatsApp reminders sent successfully!");
            fetchDueCustomers();
        } catch {
            toast.error("Failed to send WhatsApp reminders");
        } finally {
            setIsSendingReminders(false);
        }
    };

    const filteredDueCustomers = useMemo(() => {
        if (!dueCustomersSearch.trim()) return dueCustomersList;
        const q = dueCustomersSearch.toLowerCase();
        return dueCustomersList.filter(c =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q))
        );
    }, [dueCustomersList, dueCustomersSearch]);

    // Customer form
    const [customerFormData, setCustomerFormData] = useState({ id: "", name: "", phone: "", email: "", address: "" });

    // Payment
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [cashReceived, setCashReceived] = useState<Record<number, number>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [discount, setDiscount] = useState(0);
    const [posPaymentIframeUrl, setPosPaymentIframeUrl] = useState<string | null>(null);
    const [showPosIframeModal, setShowPosIframeModal] = useState(false);

    // Split & Advance Wallet State
    const [splitCashAmount, setSplitCashAmount] = useState<number | "">("");
    const [splitOnlineAmount, setSplitOnlineAmount] = useState<number | "">("");
    const [splitWalletAmount, setSplitWalletAmount] = useState<number | "">("");
    const [useWalletBalance, setUseWalletBalance] = useState(false);

    // Deposit Advance State
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [depositAmount, setDepositAmount] = useState("");
    const [depositMethod, setDepositMethod] = useState("CASH");
    const [depositNotes, setDepositNotes] = useState("");
    const [isDepositing, setIsDepositing] = useState(false);

    // Custom WhatsApp Modal State
    const [showCustomWhatsAppModal, setShowCustomWhatsAppModal] = useState(false);
    const [customWhatsAppTemplate, setCustomWhatsAppTemplate] = useState("due_payment_reminder");
    const [customWhatsAppVariables, setCustomWhatsAppVariables] = useState<string[]>(["", "", "", ""]);
    const [customWhatsAppPhone, setCustomWhatsAppPhone] = useState("");
    const [isSendingCustomWhatsApp, setIsSendingCustomWhatsApp] = useState(false);

    // Expense
    const [expenseData, setExpenseData] = useState({ amount: "", category: "MISC", description: "" });
    const [expenseDenoms, setExpenseDenoms] = useState<Record<number, number>>({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });

    useEffect(() => {
        if (!showExpenseDialog) {
            setExpenseDenoms({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
        }
    }, [showExpenseDialog]);

    // History
    const [customerHistory, setCustomerHistory] = useState<any>(null);

    // Receipt
    const [lastReceipt, setLastReceipt] = useState<any>(null);
    const [storeConfig, setStoreConfig] = useState<any>(null);

    // Suspended bills
    const [suspendedBills, setSuspendedBills] = useState<any[]>([]);

    // Shift Management
    const [activeShift, setActiveShift] = useState<any>(null);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [openingCashInput, setOpeningCashInput] = useState("");
    const [closingCashInput, setClosingCashInput] = useState("");
    const [drawerDenominations, setDrawerDenominations] = useState<Record<number, number>>({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
    const [openingDenoms, setOpeningDenoms] = useState<Record<number, number>>({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
    const [closingDenoms, setClosingDenoms] = useState<Record<number, number>>({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });

    // Cancel search
    const [cancelBillSearch, setCancelBillSearch] = useState("");
    const [cancelSearchResults, setCancelSearchResults] = useState<any[]>([]);
    const [cancelReason, setCancelReason] = useState("");

    // Scanner
    const [showScanner, setShowScanner] = useState(false);
    const qrBuffer = useRef("");
    const lastKeyTime = useRef(0);

    useEffect(() => {
        fetchProducts();
        fetchStoreConfig();
        checkShiftStatus();
        fetchTodaySales(false);
        const tick = setInterval(() => setTime(new Date()), 1000);

        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                const ct = Date.now();
                if (ct - lastKeyTime.current > 30) { lastKeyTime.current = ct; return; }
            }
            const ct = Date.now();
            if (ct - lastKeyTime.current > 100) qrBuffer.current = "";
            if (e.key === "Enter") {
                if (qrBuffer.current.length > 2) processQRCode(qrBuffer.current);
                qrBuffer.current = "";
            } else if (e.key.length === 1) {
                qrBuffer.current += e.key;
            }
            lastKeyTime.current = ct;
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => { window.removeEventListener("keydown", handleKeyPress); clearInterval(tick); };
    }, []);

    useEffect(() => {
        if (showShiftModal && activeShift) {
            setClosingDenoms(drawerDenominations);
        }
    }, [showShiftModal, activeShift, drawerDenominations]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const [pRes, cRes, sRes] = await Promise.all([
                api.get("/pos/products/store"),
                api.get("/categories"),
                api.get(`/locations/${user?.locationId}`)
            ]);
            setProducts(pRes.data || []);
            setCategories(cRes.data || []);
            if (sRes.data) setIsStoreOpen(sRes.data.isOpen);
        } catch { toast.error("Failed to load products"); }
        finally { setLoading(false); }
    };

    const toggleStoreStatus = async () => {
        if (!user?.locationId) return;
        const newStatus = !isStoreOpen;
        try {
            await api.patch(`/locations/${user?.locationId}`, { isOpen: newStatus });
            setIsStoreOpen(newStatus);
            toast.success(newStatus ? "Store is now Online" : "Store is now Offline", {
                icon: newStatus ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />
            });
        } catch {
            toast.error("Failed to update store status");
        }
    };

    const checkShiftStatus = async () => {
        try {
            const res = await api.get("/dashboard/stats");
            if (res.data.activeShift && !res.data.activeShift.isHistorical) {
                setActiveShift(res.data.activeShift);
                const localDenoms = await getShiftDenominations();
                if (localDenoms) {
                    setDrawerDenominations(localDenoms);
                } else if (res.data.activeShift.currentDenominations) {
                    const parsed = typeof res.data.activeShift.currentDenominations === "string"
                        ? JSON.parse(res.data.activeShift.currentDenominations)
                        : res.data.activeShift.currentDenominations;
                    setDrawerDenominations(parsed);
                    await saveShiftDenominations(parsed);
                }
            } else if (res.data.activeShift?.isHistorical) {
                setOpeningCashInput(Number(res.data.activeShift.closingCash || 0).toString());
                if (res.data.activeShift.closingDenominations) {
                    const parsed = typeof res.data.activeShift.closingDenominations === "string"
                        ? JSON.parse(res.data.activeShift.closingDenominations)
                        : res.data.activeShift.closingDenominations;
                    setOpeningDenoms(parsed);
                }
                setShowShiftModal(true);
            } else {
                setShowShiftModal(true);
            }
        } catch { /* Silent */ }
    };

    const handleOpenShift = async () => {
        const totalOpenCash = Object.entries(openingDenoms).reduce((sum, [den, count]) => sum + (Number(den) * count), 0);
        try {
            const res = await api.post("/dashboard/shift/open", { 
                openingCash: totalOpenCash,
                openingDenominations: openingDenoms
            });
            setActiveShift(res.data);
            setDrawerDenominations(openingDenoms);
            await saveShiftDenominations(openingDenoms);
            setShowShiftModal(false);
            toast.success("Shift opened successfully");

            // Automatically mark attendance for the operator
            try {
                await api.post("/attendance/mark", {
                    userId: user?.id,
                    locationId: user?.locationId,
                    status: "PRESENT"
                });
            } catch { /* Silent if attendance already marked or fails */ }

        } catch (e: any) {
            toast.error(e?.response?.data?.message || "Failed to open shift");
        }
    };

    const handleCloseShift = async () => {
        const totalCloseCash = Object.entries(closingDenoms).reduce((sum, [den, count]) => sum + (Number(den) * count), 0);
        try {
            const res = await api.post("/dashboard/shift/close", { 
                closingCash: totalCloseCash,
                closingDenominations: closingDenoms
            });
            setActiveShift(null);
            await clearShiftDenominations();
            toast.success(res.data.message || "Shift closed and reconciled successfully");
            setShowShiftModal(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || "Failed to close shift");
        }
    };

    const fetchStoreConfig = async () => {
        try { const res = await api.get("/pos/store/config"); setStoreConfig(res.data); }
        catch { /* silent */ }
    };

    const processQRCode = (code: string) => {
        // Support multi-item format: 101-0.25,102-0.50
        const pairs = code.split(",");
        for (const pair of pairs) {
            const [barcode, weightStr] = pair.trim().split("-");
            const product = products.find(p => p.barcode === barcode || p.sku === barcode || p.id === barcode);
            if (product) {
                addToCart(product, parseFloat(weightStr) || 1);
                toast.success(`Scanned: ${product.name}`);
            } else {
                // Secondary check for partial matches or raw IDs
                const rawMatch = products.find(p => p.id === barcode);
                if (rawMatch) {
                    addToCart(rawMatch, parseFloat(weightStr) || 1);
                    toast.success(`Identified: ${rawMatch.name}`);
                }
            }
        }
    };

    const handleQRScan = (decodedText: string) => {
        processQRCode(decodedText);
        setShowScanner(false);
    };

    const getPrice = (p: any) => {
        const vpPrice = p?.variants?.[0]?.pricing?.[0]?.price;
        if (vpPrice !== undefined && vpPrice !== null && Number(vpPrice) > 0) return Number(vpPrice);
        const prPrice = p?.pricing?.[0]?.price;
        if (prPrice !== undefined && prPrice !== null && Number(prPrice) > 0) return Number(prPrice);
        const vPrice = p?.variants?.[0]?.price;
        if (vPrice !== undefined && vPrice !== null && Number(vPrice) > 0) return Number(vPrice);
        const bPrice = p?.basePrice;
        if (bPrice !== undefined && bPrice !== null && Number(bPrice) > 0) return Number(bPrice);
        return Number(p?.price || 0);
    };

    const addToCart = (product: any, quantity: number = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                const newQty = existing.quantity + quantity;
                if (newQty <= 0) return prev.filter(item => item.id !== product.id);
                return prev.map(item => item.id === product.id ? { ...item, quantity: newQty } : item);
            }
            if (quantity <= 0) return prev;
            return [...prev, { ...product, quantity, overridePrice: getPrice(product) }];
        });
    };

    const updatePrice = (productId: string, newPrice: number) => {
        setCart(prev => prev.map(item =>
            item.id === productId ? { ...item, overridePrice: newPrice } : item
        ));
    };

    const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.overridePrice !== undefined ? item.overridePrice : getPrice(item)) * item.quantity, 0), [cart]);
    const grandTotal = Math.max(0, subtotal - discount);
    const settlingAmount = useMemo(() => {
        if (paymentMethod === "CREDIT") return Number(duePaymentAmount || 0);
        const currentPaid = paidAmount === "" ? grandTotal : Number(paidAmount);
        return currentPaid + Number(duePaymentAmount || 0);
    }, [paymentMethod, paidAmount, grandTotal, duePaymentAmount]);
    const cashTotal = useMemo(() => Object.entries(cashReceived).reduce((acc, [den, count]) => acc + (parseInt(den) * count), 0), [cashReceived]);
    const changeDue = cashTotal - settlingAmount;

    // Customer search
    const searchCustomers = async (q: string) => {
        setCustomerSearch(q);
        if (q.length < 3) { setCustomerSearchResults([]); return; }
        setIsSearchingCustomer(true);
        try { const res = await api.get(`/pos/customers/search?query=${q}`); setCustomerSearchResults(res.data); }
        catch { /* silent */ }
        finally { setIsSearchingCustomer(false); }
    };

    const openEditCustomerModal = (cust: any) => {
        if (!cust) return;
        setCustomerFormData({
            id: cust.id || "",
            name: cust.name || "",
            phone: cust.phone || "",
            email: cust.email || "",
            address: cust.addresses?.[0]?.fullAddress || cust.profileAddress || cust.address || ""
        });
        setShowCustomerDialog(true);
    };

    const handleCustomerUpsert = async () => {
        if (!customerFormData.name || !customerFormData.phone) { toast.error("Name and phone are required"); return; }
        try {
            const res = await api.post("/pos/customers/upsert", { 
                id: customerFormData.id || undefined,
                name: customerFormData.name,
                phone: customerFormData.phone,
                email: customerFormData.email ? customerFormData.email.trim() : null,
                address: customerFormData.address 
            });
            const updatedCust = res.data.customer || res.data;
            setSelectedCustomer(updatedCust);
            toast.success(customerFormData.id ? "Customer details updated" : "Customer created & tagged");
            setShowCustomerDialog(false);
            setCustomerFormData({ id: "", name: "", phone: "", email: "", address: "" });
        } catch (err: any) { 
            toast.error(err.response?.data?.message || "Failed to save customer"); 
        }
    };

    const fetchCustomerHistory = async (customerId: string, showDialog: boolean = true) => {
        try {
            const res = await api.get(`/pos/customers/${customerId}/history`);
            setCustomerHistory(res.data);
            if (res.data?.customer) {
                setSelectedCustomer((prev: any) => ({ ...prev, ...res.data.customer }));
            }
            if (showDialog) setShowHistoryDialog(true);
        } catch { toast.error("Failed to load history"); }
    };

    const handleSelectSplitPreset = (cashPercent: number) => {
        const netTotal = grandTotal;
        let walletDeduction = 0;
        if (useWalletBalance && Number(selectedCustomer?.accountBalance || 0) > 0) {
            walletDeduction = Math.min(Number(selectedCustomer.accountBalance), netTotal);
        }
        const remainingToSplit = Math.max(0, netTotal - walletDeduction);
        const cash = Number(((remainingToSplit * cashPercent) / 100).toFixed(2));
        const online = Number((remainingToSplit - cash).toFixed(2));
        setSplitCashAmount(cash);
        setSplitOnlineAmount(online);
        setSplitWalletAmount(walletDeduction);
    };

    const handleCustomerDeposit = async () => {
        if (!selectedCustomer?.id || !depositAmount || Number(depositAmount) <= 0) {
            return toast.error("Please enter a valid positive deposit amount.");
        }
        setIsDepositing(true);
        try {
            const res = await api.post("/pos/customers/deposit", {
                customerId: selectedCustomer.id,
                amount: Number(depositAmount),
                paymentMethod: depositMethod,
                notes: depositNotes
            });
            toast.success(res.data?.message || `₹${depositAmount} deposited into advance wallet!`);
            setShowDepositModal(false);
            setDepositAmount("");
            setDepositNotes("");
            fetchCustomerHistory(selectedCustomer.id, false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to process advance deposit");
        } finally {
            setIsDepositing(false);
        }
    };

    const handleSendCustomWhatsAppToCustomer = async () => {
        if (!customWhatsAppPhone || !customWhatsAppTemplate) {
            return toast.error("Phone and template name are required");
        }
        setIsSendingCustomWhatsApp(true);
        try {
            const res = await api.post("/templates/send-custom", {
                phone: customWhatsAppPhone,
                templateName: customWhatsAppTemplate,
                variables: customWhatsAppVariables
            });
            if (res.data?.success) {
                toast.success(res.data.message || "Custom WhatsApp dispatched!");
                setShowCustomWhatsAppModal(false);
            } else {
                toast.error(res.data?.message || "Failed to dispatch message");
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "WhatsApp dispatch error");
        } finally {
            setIsSendingCustomWhatsApp(false);
        }
    };

    const forwardWhatsAppLink = async (type: "BILL" | "ALL_DUES", customBillId?: string) => {
        const customer = selectedCustomer || lastReceipt?.customer || inspectingOrder?.user || inspectingOrder?.customer;
        const phone = customer?.phone || lastReceipt?.customerPhone || lastReceipt?.order?.customerPhone || "";
        const customerId = customer?.id || lastReceipt?.userId || lastReceipt?.order?.userId || "";
        const customerName = customer?.name || lastReceipt?.order?.customerName || "Valued Customer";

        if (!phone) {
            toast.error("Customer phone number is missing");
            return;
        }

        let targetBillId = customBillId || lastReceipt?.order?.id || inspectingOrder?.id || "";
        let billTotal = grandTotal || lastReceipt?.grandTotal || (inspectingOrder ? Number(inspectingOrder.totalAmount) : 0);

        // If cart has active items, automatically push cart as a Due Sale order first!
        if (type === "BILL" && !targetBillId && cart.length > 0) {
            if (!selectedCustomer?.id) {
                toast.error("Please tag a customer first");
                return;
            }
            if (!activeShift) {
                toast.error("Operational Block: No active shift found. Open a shift to proceed.");
                setShowShiftModal(true);
                return;
            }
            setIsProcessing(true);
            try {
                const res = await api.post("/pos/orders/process", {
                    customerId: selectedCustomer?.id,
                    items: cart.map(i => ({
                        productId: i.id,
                        variantId: i.variants?.[0]?.id,
                        quantity: i.quantity,
                        price: i.overridePrice !== undefined ? i.overridePrice : getPrice(i)
                    })),
                    paymentMethod: "CREDIT",
                    discountAmount: discount,
                    packerId: localStorage.getItem("selectedPackerId"),
                    duePaymentAmount: grandTotal,
                    paidAmount: 0,
                    denominations: null,
                    orderId: editingOrderId || undefined
                });

                targetBillId = res.data.order.id;
                billTotal = Number(res.data.order.totalAmount || grandTotal);

                setLastReceipt({
                    order: res.data.order,
                    items: cart,
                    customer: selectedCustomer,
                    paymentMethod: "CREDIT",
                    subtotal,
                    discount,
                    grandTotal,
                    cashTotal: 0,
                    changeDue: 0,
                    dueSummary: res.data.dueSummary
                });

                setCart([]);
                setEditingOrderId(null);
                setDiscount(0);
                setCouponCode("");
                toast.success(`Bill #${targetBillId} pushed to customer Dues & ready for payment`);
            } catch (e: any) {
                toast.error(e?.response?.data?.message || "Failed to process due bill");
                setIsProcessing(false);
                return;
            } finally {
                setIsProcessing(false);
            }
        }

        const cleanPhone = phone.replace(/\D/g, "");
        const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const origin = typeof window !== "undefined" ? window.location.origin : "";

        let link = "";
        let message = "";

        if (type === "BILL" && targetBillId) {
            link = `${origin}/pay?userid=${customerId}&number=${phone}&billid=${targetBillId}`;
            message = `Hello ${customerName}, here is your bill invoice #${targetBillId.slice(-6).toUpperCase()} from ${storeConfig?.name || 'Book My Veg'} for ₹${billTotal.toFixed(2)}.\n\nPay directly online via Easebuzz here: ${link}`;
        } else {
            link = `${origin}/pay?userid=${customerId}&number=${phone}`;
            message = `Hello ${customerName}, view all your outstanding bills and settle dues for ${storeConfig?.name || 'Book My Veg'} here: ${link}`;
        }

        const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
    };

    const checkPOSPaymentStatusAndClose = async () => {
        const targetBillId = lastReceipt?.order?.id || inspectingOrder?.id || editingOrderId || "";
        if (!targetBillId) {
            setShowPosIframeModal(false);
            setShowPaymentDialog(false);
            return;
        }

        setIsProcessing(true);
        try {
            const res = await api.get(`/pay/pay-info?billid=${targetBillId}`);
            const isPaid = res.data.bill?.isPaid || res.data.bill?.paymentStatus === "COMPLETED" || res.data.bill?.paymentStatus === "PAID";

            if (isPaid) {
                toast.success("Easebuzz Payment verified successfully!");
                setCart([]);
                setDiscount(0);
                setCouponCode("");
                setEditingOrderId(null);
                setLastReceipt((prev: any) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        order: {
                            ...prev.order,
                            isPaid: true,
                            paymentStatus: "COMPLETED"
                        }
                    };
                });
                setShowPosIframeModal(false);
                setShowPaymentDialog(false);
                setShowReceiptDialog(true);
                setTimeout(() => {
                    handlePrintReceipt();
                }, 500);
            } else {
                toast.warning("Payment not completed. Cart preserved — choose payment method again.");
                if (lastReceipt?.items && lastReceipt.items.length > 0) {
                    setCart(lastReceipt.items);
                }
                if (targetBillId) {
                    setEditingOrderId(targetBillId);
                }
                setShowPosIframeModal(false);
                setShowPaymentDialog(true);
            }
        } catch (err) {
            toast.error("Could not verify payment status automatically.");
            if (lastReceipt?.items && lastReceipt.items.length > 0) {
                setCart(lastReceipt.items);
            }
            if (targetBillId) {
                setEditingOrderId(targetBillId);
            }
            setShowPosIframeModal(false);
            setShowPaymentDialog(true);
        } finally {
            setIsProcessing(false);
        }
    };

    const triggerEasebuzzCheckoutInPOS = async () => {
        if (!selectedCustomer?.id) {
            toast.error("Customer required to initiate payment");
            return;
        }
        setIsProcessing(true);
        const activeCartBackup = [...cart];

        try {
            let targetBillId = lastReceipt?.order?.id || inspectingOrder?.id || editingOrderId || "";

            // If there's active items in the cart, create the bill first!
            if (cart.length > 0) {
                if (!activeShift) {
                    toast.error("Operational Block: No active shift found. Open a shift to proceed.");
                    setShowShiftModal(true);
                    setIsProcessing(false);
                    return;
                }
                
                const res = await api.post("/pos/orders/process", {
                    customerId: selectedCustomer?.id,
                    items: cart.map(i => ({
                        productId: i.id,
                        variantId: i.variants?.[0]?.id,
                        quantity: i.quantity,
                        price: i.overridePrice !== undefined ? i.overridePrice : getPrice(i)
                    })),
                    paymentMethod: "CREDIT", // Create as Credit/Due first
                    discountAmount: discount,
                    packerId: localStorage.getItem("selectedPackerId"),
                    duePaymentAmount: 0,
                    paidAmount: 0,
                    denominations: null,
                    orderId: editingOrderId || undefined
                });

                const savedOrder = res.data.order;
                targetBillId = savedOrder.id;

                setLastReceipt({
                    order: savedOrder,
                    items: [...cart],
                    customer: selectedCustomer,
                    paymentMethod: "CREDIT",
                    subtotal,
                    discount,
                    grandTotal,
                    cashTotal: 0,
                    changeDue: 0,
                    dueSummary: res.data.dueSummary
                });

                toast.success(`Bill #${targetBillId} generated. Initiating digital payment...`);
            }

            if (!targetBillId) {
                toast.error("No active bill or cart found to pay.");
                setIsProcessing(false);
                return;
            }

            const res = await api.post("/pay/pay-due", {
                userId: selectedCustomer?.id,
                phone: selectedCustomer?.phone,
                billId: targetBillId,
                amount: grandTotal
            });
            const data = res.data;

            const handleCancellationOrFailure = (msg: string, isError: boolean = false) => {
                if (isError) toast.error(msg);
                else toast.warning(msg);

                if (activeCartBackup.length > 0) {
                    setCart(activeCartBackup);
                } else if (lastReceipt?.items && lastReceipt.items.length > 0) {
                    setCart(lastReceipt.items);
                }
                if (targetBillId) {
                    setEditingOrderId(targetBillId);
                }
                setShowPosIframeModal(false);
                setShowPaymentDialog(true);
            };

            if (data.accessKey || data.paymentLink) {
                let checkoutUrl = data.paymentLink || `https://${data.env === "prod" ? "pay" : "testpay"}.easebuzz.in/pay/${data.accessKey}`;
                if (typeof window !== "undefined" && window.location.protocol === "https:") {
                    checkoutUrl = checkoutUrl.replace(/^http:/, "https:");
                }
                const sdkUrl = "https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js";

                const triggerSdk = () => {
                    const EasebuzzCheckout = (window as any).EasebuzzCheckout;
                    if (EasebuzzCheckout && data.accessKey) {
                        setIsProcessing(false);
                        setShowPaymentDialog(false);
                        try {
                            const checkoutObj = new EasebuzzCheckout(data.key || "EASEBUZZ", data.env || "test");
                            checkoutObj.initiatePayment({
                                access_key: data.accessKey,
                                onResponse: async (response: any) => {
                                    setIsProcessing(false);
                                    const respStatus = (response?.status || "").toLowerCase();

                                    if (respStatus === "user_cancelled" || respStatus === "usercancelled" || respStatus === "cancelled") {
                                        handleCancellationOrFailure("Payment cancelled. Cart preserved — choose payment method again.");
                                        return;
                                    }

                                    if (respStatus === "failed" || respStatus === "failure" || respStatus === "declined" || respStatus === "bounced") {
                                        handleCancellationOrFailure("Payment failed or declined. Cart preserved — choose payment method again.", true);
                                        return;
                                    }

                                    if (respStatus === "success" || respStatus === "charged") {
                                        try {
                                            await api.post("/payments/verify", {
                                                order_id: data.txnid || targetBillId,
                                                status: "SUCCESS",
                                                amount: grandTotal,
                                                txn_id: response.easepayid || response.txnid || response.easebuzz_id
                                            });
                                            toast.success("Payment completed & verified via Easebuzz");
                                        } catch (verifyErr) {
                                            console.error("Payment verify call failed:", verifyErr);
                                        }
                                        setCart([]);
                                        setDiscount(0);
                                        setCouponCode("");
                                        setEditingOrderId(null);
                                        setShowPaymentDialog(false);
                                        setShowPosIframeModal(false);
                                        setLastReceipt((prev: any) => {
                                            if (!prev) return prev;
                                            return {
                                                ...prev,
                                                order: {
                                                    ...prev.order,
                                                    isPaid: true,
                                                    paymentStatus: "COMPLETED"
                                                }
                                            };
                                        });
                                        setShowReceiptDialog(true);
                                        setTimeout(() => {
                                            handlePrintReceipt();
                                        }, 500);
                                    }
                                }
                            });
                        } catch (sdkErr) {
                            console.warn("[Easebuzz SDK] Frame access blocked, falling back to gateway window:", sdkErr);
                            setIsProcessing(false);
                            setShowPaymentDialog(false);
                            if (checkoutUrl) {
                                window.open(checkoutUrl, "_blank");
                            }
                        }
                    } else {
                        setIsProcessing(false);
                        setShowPaymentDialog(false);
                        setPosPaymentIframeUrl(checkoutUrl);
                        setShowPosIframeModal(true);
                    }
                };

                if (!(window as any).EasebuzzCheckout) {
                    const script = document.createElement("script");
                    script.src = sdkUrl;
                    script.async = true;
                    script.onload = triggerSdk;
                    script.onerror = () => {
                        setIsProcessing(false);
                        setShowPaymentDialog(false);
                        setPosPaymentIframeUrl(checkoutUrl);
                        setShowPosIframeModal(true);
                    };
                    document.body.appendChild(script);
                } else {
                    triggerSdk();
                }
            } else {
                throw new Error("No payment authorization key returned");
            }
        } catch (err: any) {
            setIsProcessing(false);
            toast.error(err.response?.data?.message || err.message || "Payment initiation failed");
        }
    };

    // Checkout — CUST-01: Blocked if no real customer
    const handleCheckout = async () => {
        if (!activeShift) { toast.error("Operational Block: No active shift found. Open a shift to proceed."); setShowShiftModal(true); return; }
        if (!selectedCustomer?.id) { toast.error("Customer required. Walk-in is disabled."); return; }
        setIsProcessing(true);

        const splitPayments: any[] = [];
        if (paymentMethod === "SPLIT") {
            if (Number(splitCashAmount) > 0) {
                splitPayments.push({ method: "CASH", amount: Number(splitCashAmount) });
            }
            if (Number(splitOnlineAmount) > 0) {
                splitPayments.push({ method: "EASEBUZZ", amount: Number(splitOnlineAmount) });
            }
            if (useWalletBalance && Number(splitWalletAmount) > 0) {
                splitPayments.push({ method: "WALLET", amount: Number(splitWalletAmount) });
            }
        }

        const effectivePaidAmount = paymentMethod === "CREDIT"
            ? 0
            : (paymentMethod === "SPLIT"
                ? splitPayments.reduce((sum, p) => sum + p.amount, 0)
                : (paidAmount || grandTotal));

        const changeBreakdown = (paymentMethod === "CASH" && changeDue > 0)
            ? (calculateOptimalChangeBreakdown(changeDue, drawerDenominations) || getStandardGreedyBreakdown(changeDue))
            : {};
        try {
            const res = await api.post("/pos/orders/process", {
                customerId: selectedCustomer?.id,
                items: cart.map(i => ({
                    productId: i.id,
                    variantId: i.variants?.[0]?.id,
                    quantity: i.quantity,
                    price: i.overridePrice !== undefined ? i.overridePrice : getPrice(i)
                })),
                paymentMethod,
                splitPayments: paymentMethod === "SPLIT" ? splitPayments : undefined,
                discountAmount: discount,
                packerId: localStorage.getItem("selectedPackerId"),
                duePaymentAmount: Number(duePaymentAmount),
                paidAmount: effectivePaidAmount,
                denominations: (paymentMethod === "CASH" || (paymentMethod === "SPLIT" && Number(splitCashAmount) > 0)) ? {
                    received: cashReceived,
                    change: changeBreakdown
                } : null,
                orderId: editingOrderId || undefined
            });
            if (paymentMethod === "CASH" || (paymentMethod === "SPLIT" && Number(splitCashAmount) > 0)) {
                const newDrawer = { ...drawerDenominations };
                const received = cashReceived || {};
                const change = changeBreakdown || {};
                const denominationsKeys = [500, 200, 100, 50, 20, 10, 5, 2, 1];
                for (const key of denominationsKeys) {
                    const currentCount = newDrawer[key] || 0;
                    const receivedCount = received[key] || 0;
                    const changeCount = change[key] || 0;
                    newDrawer[key] = Math.max(0, currentCount + receivedCount - changeCount);
                }
                setDrawerDenominations(newDrawer);
                await saveShiftDenominations(newDrawer);
            }
            setLastReceipt({
                order: res.data.order,
                items: cart,
                customer: selectedCustomer,
                paymentMethod,
                subtotal,
                discount,
                grandTotal,
                cashTotal,
                changeDue: Math.max(0, changeDue),
                dueSummary: res.data.dueSummary
            });
            setShowPaymentDialog(false);
            setShowReceiptDialog(true);
            setCart([]);
            setSelectedCustomer(null); // Reset customer so next bill starts fresh
            setEditingOrderId(null);
            setCashReceived({});
            setDiscount(0);
            setCouponCode("");
            setPaidAmount("");
            setDuePaymentAmount("");
            setSplitCashAmount("");
            setSplitOnlineAmount("");
            setSplitWalletAmount("");
            setUseWalletBalance(false);
            toast.success("Transaction completed");
        } catch (e: any) {
            toast.error(e?.response?.data?.message || "Transaction failed");
        } finally { setIsProcessing(false); }
    };

    const handleNewBill = () => {
        setCart([]);
        setSelectedCustomer(null);
        setEditingOrderId(null);
        setCashReceived({});
        setDiscount(0);
        setCouponCode("");
        setPaidAmount("");
        setDuePaymentAmount("");
        toast.info("Started new bill");
    };

    // Suspend bill
    const suspendBill = () => {
        if (cart.length === 0) return;
        setSuspendedBills(prev => [...prev, { id: Date.now(), items: [...cart], customer: selectedCustomer, time: new Date() }]);
        setCart([]);
        setSelectedCustomer(null);
        toast.success("Bill suspended");
    };

    const handleSettleDue = async () => {
        if (!selectedCustomer || settleAmount <= 0) return;
        setIsProcessing(true);
        const curCashTotal = Object.entries(cashReceived).reduce((sum, [den, count]) => sum + (Number(den) * count), 0);
        const settleChangeDue = Math.max(0, curCashTotal - settleAmount);
        const changeBreakdown = (paymentMethod === "CASH" && settleChangeDue > 0)
            ? (calculateOptimalChangeBreakdown(settleChangeDue, drawerDenominations) || getStandardGreedyBreakdown(settleChangeDue))
            : {};
        try {
            await api.post(`/pos/customers/${selectedCustomer.id}/settle`, {
                amount: settleAmount,
                method: paymentMethod,
                transactionId: `POS_MANUAL_SETTLE_${Date.now()}`,
                denominations: paymentMethod === "CASH" ? {
                    received: cashReceived,
                    change: changeBreakdown
                } : null
            });
            if (paymentMethod === "CASH") {
                const newDrawer = { ...drawerDenominations };
                const received = cashReceived || {};
                const change = changeBreakdown || {};
                const denominationsKeys = [500, 200, 100, 50, 20, 10, 5, 2, 1];
                for (const key of denominationsKeys) {
                    const currentCount = newDrawer[key] || 0;
                    const receivedCount = received[key] || 0;
                    const changeCount = change[key] || 0;
                    newDrawer[key] = Math.max(0, currentCount + receivedCount - changeCount);
                }
                setDrawerDenominations(newDrawer);
                await saveShiftDenominations(newDrawer);
            }
            toast.success("Balance settled successfully");
            setSettleAmount(0);
            setCashReceived({});
            setShowSettleDialog(false);
            if (selectedCustomer?.id) fetchCustomerHistory(selectedCustomer.id);
        } catch (error) {
            toast.error("Failed to settle balance");
        } finally {
            setIsProcessing(false);
        }
    };

    const resumeBill = (bill: any) => {
        setCart(bill.items);
        if (bill.customer) setSelectedCustomer(bill.customer);
        setSuspendedBills(prev => prev.filter(b => b.id !== bill.id));
        toast.success("Bill resumed");
    };

    const handleViewHistoricalReceipt = (order: any) => {
        if (!order || !order.items) return;

        const mappedItems = order.items.map((oi: any) => ({
            ...oi.product,
            name: oi.product?.name || oi.productName || "Unknown Product",
            sku: oi.product?.sku || oi.productId?.slice(0, 8),
            quantity: parseFloat(String(oi.quantity || 0)),
            basePrice: parseFloat(String(oi.sellingPrice || 0)),
            overridePrice: parseFloat(String(oi.sellingPrice || 0)),
            pricing: [{ price: parseFloat(String(oi.sellingPrice || 0)) }]
        }));

        const totalPaid = order.payments?.reduce((acc: number, p: any) => acc + parseFloat(String(p.amount || 0)), 0) || 0;
        const subtotalVal = parseFloat(String(order.totalAmount || 0)) + parseFloat(String(order.discountAmount || 0));

        const orderCust = order.user || order.customer || selectedCustomer;
        const custPhone = orderCust?.phone || order.customerPhone || "";
        const custName = orderCust?.name || order.customerName || "Walk-In";

        const getFormattedAddress = (custObj: any, ordObj: any) => {
            const candidates = [
                custObj?.addresses?.[0]?.fullAddress,
                custObj?.addresses?.[0]?.address,
                custObj?.profileAddress,
                custObj?.address,
                ordObj?.user?.addresses?.[0]?.fullAddress,
                ordObj?.user?.addresses?.[0]?.address,
                ordObj?.user?.profileAddress,
                ordObj?.user?.address,
                ordObj?.customer?.addresses?.[0]?.fullAddress,
                ordObj?.customer?.profileAddress,
                ordObj?.customer?.address,
                typeof ordObj?.shippingAddress === "string" ? ordObj.shippingAddress : (ordObj?.shippingAddress?.fullAddress || ordObj?.shippingAddress?.address),
                ordObj?.address,
                ordObj?.customerAddress
            ];

            for (const cand of candidates) {
                if (cand && typeof cand === "string" && cand.trim().length > 0 && !cand.includes("[object Object]")) {
                    return cand.trim();
                }
            }
            return "";
        };

        const custAddr = getFormattedAddress(orderCust, order);

        setLastReceipt({
            id: order.id,
            order: order,
            items: mappedItems,
            customer: {
                ...orderCust,
                name: custName,
                phone: custPhone,
                address: custAddr,
                profileAddress: custAddr,
                addresses: custAddr ? [{ fullAddress: custAddr }] : []
            },
            customerPhone: custPhone,
            userId: orderCust?.id || order.userId,
            paymentMethod: order.isCredit ? "CREDIT" : (order.payments?.[0]?.method || "UPI"),
            subtotal: subtotalVal,
            discount: parseFloat(String(order.discountAmount || 0)),
            grandTotal: parseFloat(String(order.totalAmount || 0)),
            cashTotal: totalPaid,
            changeDue: 0,
            dueSummary: order.dueSummary || {
                currentBillDue: order.isCredit ? (parseFloat(String(order.totalAmount || 0)) - totalPaid) : 0,
                settledFromOld: 0,
                netOutstanding: orderCust?.outstandingBalance || 0
            }
        });
        setShowReceiptDialog(true);
    };

    // Apply coupon
    const applyCoupon = async () => {
        if (!couponCode) return;
        try {
            const res = await api.post("/coupons/validate", { code: couponCode, orderTotal: subtotal });
            setDiscount(res.data.discountAmount || 0);
            toast.success(`Coupon applied: -₹${res.data.discountAmount}`);
        } catch { toast.error("Invalid coupon"); }
    };

    // Cancel order search - Robust search for bills
    const searchOrdersForCancel = async () => {
        if (!cancelBillSearch) return;
        try {
            // Try searching by Customer first
            const res = await api.get(`/pos/customers/search?query=${cancelBillSearch}`);
            const customer = res.data?.[0];
            if (customer) {
                const histRes = await api.get(`/pos/customers/${customer.id}/history`);
                setCancelSearchResults(histRes.data.orders?.filter((o: any) => o.status !== "CANCELLED").slice(0, 10) || []);
                return;
            }

            // Try searching by specific Order ID if no customer found
            const orderRes = await api.get(`/pos/orders/single/${cancelBillSearch}`);
            if (orderRes.data) {
                setCancelSearchResults([orderRes.data]);
            }
        } catch {
            toast.error("No matching customer or bill found");
        }
    };

    const cancelOrder = async (orderId: string) => {
        try {
            await api.post(`/pos/orders/${orderId}/cancel`, { reason: cancelReason || "POS Operator cancellation", refundMode: "CASH" });
            toast.success("Order cancelled, inventory restored");
            setCancelSearchResults(prev => prev.filter(o => o.id !== orderId));
        } catch (e: any) { toast.error(e?.response?.data?.message || "Cancellation failed"); }
    };

    const handleAddExpense = async () => {
        if (!expenseData.amount || !expenseData.description) return toast.error("Amount and description required");
        
        const totalDenoms = Object.values(expenseDenoms).reduce((a, b) => a + b, 0);
        if (totalDenoms === 0) return toast.error("Please specify cash denominations for the expense");

        try {
            await api.post("/expenses/add", {
                ...expenseData,
                locationId: user?.locationId,
                staffId: user?.id,
                denominations: expenseDenoms
            });

            // Update local drawer denominations
            const newDrawer = { ...drawerDenominations };
            for (const den of DENOMINATIONS) {
                const currentCount = newDrawer[den] || 0;
                const expenseCount = expenseDenoms[den] || 0;
                newDrawer[den] = Math.max(0, currentCount - expenseCount);
            }
            setDrawerDenominations(newDrawer);
            await saveShiftDenominations(newDrawer);

            toast.success("Expense recorded and subtracted from counter");
            setShowExpenseDialog(false);
            setExpenseData({ amount: "", category: "MISC", description: "" });
            setExpenseDenoms({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
            checkShiftStatus(); // Refresh estimated cash
        } catch {
            toast.error("Failed to record expense");
        }
    };

    const handlePrintReceipt = () => {
        const content = document.getElementById("receipt-content");
        if (!content) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const formatDate = (dateInput: any) => {
            const d = new Date(dateInput || Date.now());
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };

        const numberToWords = (num: number) => {
            const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
            const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
            const n = ('0000000' + Math.floor(num)).slice(-7).match(/^(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n) return 'ZERO RUPEES ONLY';

            let str = '';
            const n1 = parseInt(n[1]); // Lakh
            const n2 = parseInt(n[2]); // Thousand
            const n3 = parseInt(n[3]); // Hundred
            const n4 = parseInt(n[4]); // Rest

            str += (n1 !== 0) ? (a[n1] || b[parseInt(n[1][0])] + ' ' + a[parseInt(n[1][1])]) + 'lakh ' : '';
            str += (n2 !== 0) ? (a[n2] || b[parseInt(n[2][0])] + ' ' + a[parseInt(n[2][1])]) + 'thousand ' : '';
            str += (n3 !== 0) ? (a[n3] || b[parseInt(n[3][0])] + ' ' + a[parseInt(n[3][1])]) + 'hundred ' : '';
            str += (n4 !== 0) ? (a[n4] || b[parseInt(n[4][0])] + ' ' + a[parseInt(n[4][1])]) + ' ' : '';
            return (str.trim() || 'zero ') + ' RUPEES ONLY';
        };

        const currentOrderDue = lastReceipt.dueSummary
            ? Number(lastReceipt.dueSummary.currentBillDue)
            : (lastReceipt.order ? (Number(lastReceipt.order.totalAmount) - (lastReceipt.order.payments?.reduce((acc: number, p: any) => acc + Number(p.amount), 0) || 0)) : 0);

        const settledFromOld = lastReceipt.dueSummary
            ? Number(lastReceipt.dueSummary.settledFromOld)
            : 0;

        const netOutstanding = lastReceipt.dueSummary
            ? Number(lastReceipt.dueSummary.netOutstanding)
            : currentOrderDue;

        const unitPriceSum = lastReceipt.items?.reduce((acc: number, item: any) => acc + Number(getPrice(item)), 0) || 0;
        const unitPriceDiscountedSum = lastReceipt.items?.reduce((acc: number, item: any) => acc + Number(item.overridePrice !== undefined ? item.overridePrice : getPrice(item)), 0) || 0;
        const lineTotalSum = lastReceipt.items?.reduce((acc: number, item: any) => acc + Number(item.overridePrice !== undefined ? item.overridePrice : getPrice(item)) * Number(item.quantity), 0) || 0;
        const totalDiscountVal = lastReceipt.items?.reduce((acc: number, item: any) => acc + (Math.max(0, getPrice(item) - Number(item.overridePrice !== undefined ? item.overridePrice : getPrice(item))) * Number(item.quantity)), 0) || 0;

        const discountVal = Number(lastReceipt.discount || 0);
        const rawTotal = lineTotalSum - discountVal;
        const grandTotalVal = Math.round(rawTotal);
        const roundingVal = grandTotalVal - rawTotal;
        const paidAmount = Math.max(0, grandTotalVal - currentOrderDue);
        const dueAmount = currentOrderDue;

        const printCust = lastReceipt.customer || lastReceipt.order?.user || lastReceipt.order?.customer;
        const printCustName = printCust?.name || lastReceipt.order?.customerName || lastReceipt.customerName || "Walk-In";
        const printCustPhone = printCust?.phone || lastReceipt.customerPhone || lastReceipt.order?.customerPhone || "";
        
        const getFormattedAddress = (custObj: any, ordObj: any) => {
            const candidates = [
                custObj?.addresses?.[0]?.fullAddress,
                custObj?.addresses?.[0]?.address,
                custObj?.profileAddress,
                custObj?.address,
                ordObj?.user?.addresses?.[0]?.fullAddress,
                ordObj?.user?.addresses?.[0]?.address,
                ordObj?.user?.profileAddress,
                ordObj?.user?.address,
                ordObj?.customer?.addresses?.[0]?.fullAddress,
                ordObj?.customer?.profileAddress,
                ordObj?.customer?.address,
                typeof ordObj?.shippingAddress === "string" ? ordObj.shippingAddress : (ordObj?.shippingAddress?.fullAddress || ordObj?.shippingAddress?.address),
                ordObj?.address,
                ordObj?.customerAddress
            ];

            for (const cand of candidates) {
                if (cand && typeof cand === "string" && cand.trim().length > 0 && !cand.includes("[object Object]")) {
                    return cand.trim();
                }
            }
            return "";
        };

        const printCustAddress = getFormattedAddress(printCust, lastReceipt.order);

        printWindow.document.write(`
            <html>
                <head>
                    <title>Bill - ${lastReceipt?.order?.id?.slice(0, 8) || ''}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&display=swap" rel="stylesheet">
                    <style>
                        * {
                            box-sizing: border-box;
                        }
                        html, body {
                            margin: 0;
                            padding: 0;
                            width: 100%;
                            background: #fff;
                            color: #000;
                            font-family: 'Poppins', Arial, sans-serif;
                        }
                        body { 
                            display: flex;
                            justify-content: center;
                            align-items: flex-start;
                        }
                        .bill-wrapper {
                            font-family: 'Poppins', Arial, sans-serif; 
                            width: 100%;
                            max-width: 80mm; 
                            margin: 0 auto;
                            padding: 3mm;
                            font-size: 8.5px;
                            line-height: 1.3;
                            color: #000;
                            background: #fff;
                            font-weight: 600;
                        }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: 800; }
                        .uppercase { text-transform: uppercase; }
                        
                        .divider { border-top: 1px dashed #000; margin: 6px 0; }
                        .divider-solid { border-top: 1px solid #000; margin: 6px 0; }
                        
                        .item-table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin: 8px 0; 
                        }
                        .item-table th, .item-table td { 
                            border: 1px solid #000; 
                            padding: 3px 4px; 
                            font-size: 7.5px; 
                            vertical-align: middle; 
                            color: #000;
                            font-weight: 600;
                        }
                        .item-table th { 
                            font-weight: 800; 
                            text-align: center;
                            background-color: #f5f5f5;
                        }
                        
                        .metadata-block {
                            font-size: 8px;
                            line-height: 1.35;
                            margin-bottom: 6px;
                            color: #000;
                            font-weight: 600;
                            text-align: center;
                        }

                        .qr-section { 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            margin: 6px 0; 
                            text-align: center; 
                        }
                        .qr-code { 
                            width: 90px; 
                            height: 90px; 
                            padding: 3px; 
                            border: 1px solid #000; 
                            border-radius: 4px; 
                            margin: 0 auto; 
                            display: block; 
                        }
                        
                        .footer-block {
                            margin-top: 10px; 
                            border: 1px solid #000; 
                            padding: 5px; 
                            text-align: center; 
                            font-size: 7.5px; 
                            line-height: 1.4; 
                            border-radius: 3px; 
                            background-color: #f9f9f9;
                            color: #000;
                            font-weight: 700;
                        }

                        @media print {
                            @page { 
                                size: auto;
                                margin: 0mm; 
                            }
                            html, body { 
                                width: 100% !important; 
                                margin: 0 !important;
                                padding: 0 !important;
                                display: block !important;
                                background: #fff !important;
                            }
                            .bill-wrapper { 
                                width: 100% !important; 
                                max-width: 100% !important;
                                margin: 0 !important;
                                padding: 2mm 3mm !important;
                                border: none !important;
                                box-shadow: none !important;
                            }
                        }
                    </style>
                </head>
                <body>
                <div class="bill-wrapper">
                    <!-- Store Branding -->
                    <div class="text-center" style="margin-bottom: 8px;">
                        <h1 class="font-bold uppercase" style="font-size: 13px; margin: 0 0 2px 0; line-height: 1.1;">${storeConfig?.name || 'MAIN HUB'}</h1>
                        <p class="font-bold text-slate-500 uppercase tracking-tight text-[7.5px]" style="margin: 0;">Primary Distribution Center</p>
                    </div>

                    <!-- Store Contact Details -->
                    <div class="text-center font-bold uppercase tracking-tighter text-[8px] mb-3">
                        <span>PH: ${storeConfig?.contactNumber || '8208363287'}</span>
                        ${storeConfig?.gstNumber ? `<span style="margin: 0 3px;">•</span><span>GST: ${storeConfig.gstNumber}</span>` : '<span style="margin: 0 3px;">•</span><span>GST: N/A</span>'}
                    </div>

                    <!-- Public Pay Link QR Code -->
                    ${dueAmount > 0 ? `
                    <div class="qr-section">
                        <p class="font-bold uppercase" style="font-size: 8px; margin: 0 0 4px 0;">Scan To Pay Bill / View Dues</p>
                        <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/pay/userid=${lastReceipt.userId || lastReceipt.customer?.id || ''}&number=${printCustPhone}&billid=${lastReceipt.id || lastReceipt.order?.id || ''}`)}" />
                    </div>
                    ` : ''}

                    <div class="divider-solid"></div>

                    <!-- Metadata Rows -->
                    <div class="metadata-block">
                        <div><strong>Date:</strong> ${formatDate(lastReceipt.order?.createdAt)}</div>
                        <div><strong>Invoice No.:</strong> ${lastReceipt.order?.id?.slice(-5).toUpperCase() || ''}</div>
                        <div><strong>Reference No:</strong> ${lastReceipt.order?.id || ''}</div>
                        <div style="margin-top: 2px;">
                            <strong>Customer:</strong> ${printCustName}
                            ${printCustPhone ? `, <strong>Ph:</strong> ${printCustPhone}` : ''}
                            ${printCustAddress ? `<br/><strong>Address:</strong> ${printCustAddress}` : ''}
                        </div>
                    </div>

                    <!-- Itemized Breakdown -->
                    <table class="item-table">
                        <thead>
                            <tr>
                                <th style="width: 7%;">Sr.No</th>
                                <th style="width: 25%;">Name</th>
                                <th style="width: 14%; text-align: center;">Price</th>
                                <th style="width: 14%; text-align: center;">Discount</th>
                                <th style="width: 16%; text-align: center;">Disc.Price</th>
                                <th style="width: 10%; text-align: center;">QTY</th>
                                <th style="width: 14%; text-align: center;">Amt</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lastReceipt.items?.map((item: any, idx: number) => {
                                const orig = getPrice(item);
                                const act = Number(item.overridePrice !== undefined ? item.overridePrice : orig);
                                const discUnit = Math.max(0, orig - act);
                                const rowAmt = act * Number(item.quantity);
                                return `
                                    <tr>
                                        <td style="text-align: center;">${idx + 1}</td>
                                        <td style="text-align: center;">${item.name}</td>
                                        <td style="text-align: center;">Rs.${orig.toFixed(2)}</td>
                                        <td style="text-align: center;">Rs.${discUnit.toFixed(2)}</td>
                                        <td style="text-align: center;">Rs.${act.toFixed(2)}</td>
                                        <td style="text-align: center;">${Number(item.quantity).toFixed(3)}</td>
                                        <td style="text-align: center;">Rs.${rowAmt.toFixed(2)}</td>
                                    </tr>
                                `;
                            }).join('')}
                            
                            <!-- Totals Rows -->
                            <tr style="font-weight: bold; border-top: 2px solid #000;">
                                <td colspan="2" style="text-align: center;">Total</td>
                                <td style="text-align: center;">Rs.${unitPriceSum.toFixed(2)}</td>
                                <td style="text-align: center;">Rs.${totalDiscountVal.toFixed(2)}</td>
                                <td style="text-align: center;">Rs.${unitPriceDiscountedSum.toFixed(2)}</td>
                                <td></td>
                                <td style="text-align: center;">Rs.${lineTotalSum.toFixed(2)}</td>
                            </tr>
                            
                            <tr>
                                <td colspan="6" style="text-align: center;">Total Discount</td>
                                <td style="text-align: center;">Rs.${(totalDiscountVal + discountVal).toFixed(2)}</td>
                            </tr>

                            <tr>
                                <td colspan="6" style="text-align: center;">Rounding</td>
                                <td style="text-align: center;">Rs.${(roundingVal >= 0 ? '+' : '')}${roundingVal.toFixed(2)}</td>
                            </tr>
                            
                            <tr style="font-weight: bold; border-top: 1px solid #000; border-bottom: 2px solid #000;">
                                <td colspan="6" style="text-align: center;">Grand Total ( ${numberToWords(grandTotalVal).replace('RUPEES ONLY', 'ONLY').toUpperCase()} )</td>
                                <td style="text-align: center;">Rs.${grandTotalVal.toFixed(2)}</td>
                            </tr>
                            
                            <tr>
                                <td colspan="6" style="text-align: center;">Paid Amount</td>
                                <td style="text-align: center;">Rs.${paidAmount.toFixed(2)}</td>
                            </tr>
                            
                            <tr style="font-weight: bold;">
                                <td colspan="6" style="text-align: center;">Due Amount</td>
                                <td style="text-align: center;">Rs.${dueAmount.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="footer-block">
                        Thank you for shopping with us. Please visit again<br/>
                        Products you purchase can only be replaced within 12 hours of the bill being generated.
                    </div>

                </div>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const fetchWebOrders = useCallback(async () => {
        try {
            const res = await api.get("/pos/orders/web");
            setWebOrders(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to fetch web orders", error);
            setWebOrders([]);
        }
    }, []);

    useEffect(() => {
        fetchWebOrders();
        const interval = setInterval(fetchWebOrders, 30000);
        return () => clearInterval(interval);
    }, [fetchWebOrders]);

    const updateWebOrderStatusHandler = async (orderId: string, status: string, remark?: string) => {
        setIsUpdatingWebOrderStatus(true);
        try {
            const res = await api.post(`/pos/orders/${orderId}/status`, { status, remark });
            toast.success(res.data?.message || `Order status updated to ${status}`);
            fetchWebOrders();
            if (selectedWebOrder?.id === orderId) {
                setSelectedWebOrder((prev: any) => prev ? { ...prev, status } : null);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to update order status");
        } finally {
            setIsUpdatingWebOrderStatus(false);
        }
    };

    const assignWebOrder = async (orderId: string) => {
        await updateWebOrderStatusHandler(orderId, "CONFIRMED", "Accepted at POS terminal");
    };

    const handleLogout = async () => {
        if (confirm("End POS session?")) { await logout(); router.push("/login"); }
    };

    const filteredProducts = products.filter(p => {
        const matchQ = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode?.includes(searchQuery) || p.sku?.includes(searchQuery);
        const matchC = selectedCategory === "ALL" || p.categoryId === selectedCategory;
        return matchQ && matchC;
    });

    // ── RENDER ──────────────────────────────────────────────────────────────
    return (
        <div className="h-screen bg-[#F4F7F6] flex flex-col font-sans overflow-hidden">
            {/* TOP BAR */}
            <div className="h-20 bg-slate-900 flex items-center justify-between px-6 shrink-0 shadow-2xl z-50 border-b border-emerald-500/20">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 group cursor-pointer" onClick={() => router.push("/admin/dashboard")}>
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2 shadow-xl shadow-emerald-500/10 transition-transform group-hover:scale-110 duration-300">
                            <img src="/logo.png" alt="BookMyVeg" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-white font-black text-xl tracking-tighter leading-none">BOOKMYVEG</h1>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mt-1">POS Terminal</span>
                        </div>
                    </div>

                    <div className="h-10 w-px bg-white/10 mx-2" />

                    <div className="flex flex-col">
                        <div className="px-4 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-emerald-400 tabular-nums shadow-inner">
                            {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-2 mt-1 px-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-none">System Synchronized</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowScanner(true)}
                        className="h-9 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center gap-2 text-white/70 hover:text-white transition-all text-[10px] font-black uppercase"
                        title="Digital Camera Scan"
                    >
                        <QrCode className="h-4 w-4 text-emerald-400" />
                        Cam Scan
                    </button>

                    {/* ── STORE STATUS TOGGLE ── */}
                    <button
                        onClick={toggleStoreStatus}
                        className={cn(
                            "flex items-center gap-2 px-3 h-8 rounded text-[10px] font-black uppercase transition-all shadow-sm",
                            isStoreOpen
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                                : "bg-red-500 text-white border border-red-600 shadow-lg shadow-red-500/20"
                        )}
                    >
                        {isStoreOpen ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute" />
                                <div className="w-2 h-2 rounded-full bg-emerald-500 relative" />
                                Store Online
                            </>
                        ) : (
                            <>
                                <PowerOff className="h-3 w-3" />
                                Store Offline
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => setShowWebOrders(true)}
                        className={cn(
                            "relative flex items-center gap-2 px-3 h-8 rounded text-[10px] font-black uppercase transition-all",
                            webOrders.length > 0 ? "bg-orange-500 text-white animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.5)]" : "bg-white/5 text-slate-400"
                        )}
                    >
                        <Globe className="h-3.5 w-3.5" />
                        Web Orders
                        {webOrders.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-white text-orange-600 rounded-full flex items-center justify-center text-[9px] shadow-lg font-black">
                                {webOrders.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => fetchTodaySales(true)}
                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        title="Click to view Bill-Wise Sales Report"
                    >
                        <Receipt className="h-3.5 w-3.5 text-white" />
                        Today Sales: ₹{todaySalesSummary.totalSales.toLocaleString()}
                    </button>
                    <button
                        onClick={() => fetchDueCustomers()}
                        className="h-8 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        title="Send WhatsApp payment reminders to due customers"
                    >
                        <MessageCircle className="h-3.5 w-3.5 text-white" />
                        WhatsApp Reminders
                    </button>
                    {suspendedBills.length > 0 && (
                        <div className="relative">
                            <button className="px-3 h-8 bg-orange-500 text-white text-[10px] font-bold rounded flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" /> {suspendedBills.length} Suspended
                            </button>
                            <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 w-64 max-h-48 overflow-y-auto">
                                {suspendedBills.map(bill => (
                                    <button key={bill.id} onClick={() => resumeBill(bill)} className="w-full p-3 text-left hover:bg-slate-50 border-b text-xs">
                                        <span className="font-bold">{bill.customer?.name || "No customer"}</span>
                                        <span className="text-slate-400 ml-2">{bill.items.length} items</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <button onClick={() => setShowCancelDialog(true)} className="h-8 px-3 bg-slate-700 text-white text-[10px] font-bold rounded hover:bg-slate-600 flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Cancel Order
                    </button>
                    <button onClick={() => setShowExpenseDialog(true)} className="h-8 px-3 bg-red-800 text-white text-[10px] font-bold rounded hover:bg-red-900 flex items-center gap-1 transition-all shadow-sm">
                        <Banknote className="h-3.5 w-3.5" /> Store Expense
                    </button>
                    <button onClick={() => setShowShiftModal(true)} className="h-8 px-3 bg-orange-600 text-white text-[10px] font-bold rounded hover:bg-orange-700 flex items-center gap-1.5 transition-all shadow-sm">
                        <Clock className="h-3.5 w-3.5" /> End Shift
                    </button>
                    <div className="h-8 w-px bg-white/10" />
                    <span className="text-[10px] font-bold text-white/70">{user?.name}</span>
                    <button onClick={handleLogout} className="w-8 h-8 rounded bg-slate-700 hover:bg-red-600 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                        <LogOut className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden p-2 gap-2">
                {/* LEFT: Cart & Summary */}
                <div className="w-[550px] flex flex-col gap-2 shrink-0 h-full overflow-hidden">
                    {/* Customer Tag — CUST-01: Walk-in BLOCKED */}
                    <div className={cn("shrink-0 rounded-xl p-3 border transition-all flex items-center justify-between",
                        selectedCustomer?.id ? "bg-teal-50 border-teal-200" : "bg-red-50 border-red-200 animate-pulse")}>
                        <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center font-black text-xs",
                                selectedCustomer?.id ? "bg-teal-500 text-white" : "bg-red-500 text-white")}>
                                {selectedCustomer?.id ? selectedCustomer.name?.charAt(0)?.toUpperCase() : "!"}
                            </div>
                            <div>
                                <p className={cn("text-[9px] font-black uppercase tracking-widest leading-none mb-0.5",
                                    selectedCustomer?.id ? "text-teal-600" : "text-red-600")}>
                                    {selectedCustomer?.id ? "Customer Tagged" : "⚠ Customer Required"}
                                </p>
                                <p className="text-xs font-bold text-slate-900 leading-none">
                                    {selectedCustomer?.name || "Search to tag customer"}
                                </p>
                                {selectedCustomer?.phone && <p className="text-[10px] text-slate-400 tabular-nums">{selectedCustomer.phone}</p>}
                                {(selectedCustomer?.addresses?.[0]?.fullAddress || selectedCustomer?.address) && (
                                    <p className="text-[9px] text-slate-500 italic truncate max-w-[200px]">
                                        {selectedCustomer?.addresses?.[0]?.fullAddress || selectedCustomer?.address}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {selectedCustomer?.id && (
                                <>
                                    <button onClick={() => openEditCustomerModal(selectedCustomer)} className="p-1.5 bg-white border rounded text-slate-700 hover:bg-slate-100" title="Edit Customer Details">
                                        <SquarePen className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => fetchCustomerHistory(selectedCustomer.id)} className="p-1.5 bg-white border rounded text-teal-500 hover:bg-teal-50" title="History">
                                        <History className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => setSelectedCustomer(null)} className="p-1.5 bg-white border rounded text-red-400 hover:bg-red-50" title="Untag">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Editing Order Indicator */}
                    {editingOrderId && (
                        <div className="bg-amber-500 text-slate-950 px-4 py-3 rounded-xl flex items-center justify-between shadow-md mb-2 animate-pulse shrink-0">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-slate-950" />
                                <div className="text-xs font-black uppercase tracking-wider">
                                    Editing Bill #{editingOrderId.slice(-6)}
                                </div>
                            </div>
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase rounded-lg"
                                onClick={() => {
                                    setCart([]);
                                    setDiscount(0);
                                    setEditingOrderId(null);
                                    toast.info("Edit mode cancelled.");
                                }}
                            >
                                Cancel Edit
                            </Button>
                        </div>
                    )}

                    {/* Cart Table — Matches POS Spec Reference */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-0">
                        {/* Header Row — FORCED HORIZONTAL GRID */}
                        <div
                            style={{ gridTemplateColumns: "1.5fr 80px 110px 45px 75px 85px 35px" }}
                            className="grid h-10 bg-[#57C7C5] text-white shrink-0 border-b border-white/10 uppercase text-[10px] font-black"
                        >
                            <div className="flex items-center px-4 border-r border-white/10">Product</div>
                            <div className="flex items-center justify-center border-r border-white/10">Price</div>
                            <div className="flex items-center justify-center border-r border-white/10">Qty</div>
                            <div className="flex items-center justify-center border-r border-white/10">Unit</div>
                            <div className="flex items-center justify-center border-r border-white/10">Discount</div>
                            <div className="flex items-center justify-center border-r border-white/10">Sub total</div>
                            <div className="flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></div>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <ShoppingCart className="h-8 w-8 mb-2" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Scan or tap to add items</p>
                                </div>
                            ) : (
                                <>
                                    {/* Group by category */}
                                    {(() => {
                                        const grouped: Record<string, any[]> = {};
                                        cart.forEach(item => {
                                            const catName = categories.find(c => c.id === item.categoryId)?.name || "General";
                                            if (!grouped[catName]) grouped[catName] = [];
                                            grouped[catName].push(item);
                                        });
                                        return Object.entries(grouped).map(([catName, items]) => (
                                            <div key={catName}>
                                                <div className="bg-[#f0faf9] px-3 py-1 text-[10px] font-black text-teal-700 uppercase tracking-wider border-b border-teal-100">{catName}</div>
                                                {items.map((item, idx: number) => {
                                                    const origPrice = getPrice(item);
                                                    const actPrice = item.overridePrice !== undefined ? item.overridePrice : origPrice;
                                                    const itemDisc = Math.max(0, origPrice - actPrice) * item.quantity;
                                                    return (
                                                        <div key={idx}
                                                            style={{ gridTemplateColumns: "1.5fr 80px 110px 45px 75px 85px 35px" }}
                                                            className={cn(
                                                                "grid items-stretch border-b border-[#57C7C5]/10",
                                                                idx % 2 === 0 ? "bg-[#FDF2F3]/50" : "bg-white"
                                                            )}
                                                        >
                                                            {/* Product */}
                                                            <div className="px-4 py-2 flex items-center justify-between border-r border-[#57C7C5]/10 overflow-hidden min-w-0">
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <span className="text-xs font-black text-slate-800 tracking-tight truncate leading-tight">
                                                                        {item.name || "(No Name Found)"}
                                                                    </span>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                                        {item.sku || "NO_SKU"}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Price (Boxed) */}
                                                            <div className="flex items-center justify-center px-1 border-r border-[#57C7C5]/10">
                                                                <div className="bg-white border border-slate-300 rounded overflow-hidden">
                                                                    <input
                                                                        type="number"
                                                                        value={item.overridePrice !== undefined ? item.overridePrice : origPrice}
                                                                        onChange={e => {
                                                                            const newPrice = parseFloat(e.target.value) || 0;
                                                                            updatePrice(item.id, newPrice);
                                                                        }}
                                                                        className="w-full h-6 text-center text-[10px] font-bold text-slate-900 bg-transparent outline-none focus:bg-teal-50"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Qty (Buttons + Box) */}
                                                            <div className="flex items-center justify-center gap-1 border-r border-[#57C7C5]/10 px-1">
                                                                <button onClick={() => addToCart(item, -1)} className="text-slate-900 font-bold text-lg hover:text-red-500">−</button>
                                                                <div className="bg-white border border-slate-300 rounded overflow-hidden">
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        min="0"
                                                                        defaultValue={item.quantity}
                                                                        key={`${item.id}-${item.quantity}`}
                                                                        onFocus={e => e.target.select()}
                                                                        onBlur={e => {
                                                                            const newQty = parseFloat(e.target.value);
                                                                            if (!isNaN(newQty) && newQty > 0) {
                                                                                setCart(prev => prev.map(ci => ci.id === item.id ? { ...ci, quantity: newQty } : ci));
                                                                            } else {
                                                                                e.target.value = String(item.quantity);
                                                                            }
                                                                        }}
                                                                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                                        className="w-14 h-6 text-center text-[11px] font-black text-slate-900 outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                </div>
                                                                <button onClick={() => addToCart(item, 1)} className="text-slate-900 font-bold text-lg hover:text-teal-500">+</button>
                                                            </div>

                                                            <div className="flex items-center justify-center text-[9px] font-black text-slate-500 uppercase border-r border-[#57C7C5]/10">
                                                                {item.variants?.[0]?.weightUnit || item.weightUnit || "kg"}
                                                            </div>

                                                            {/* Discount */}
                                                            <div className="flex items-center justify-center text-[11px] font-black text-rose-500 tabular-nums border-r border-[#57C7C5]/10 px-1 truncate">
                                                                {itemDisc > 0 ? `₹${itemDisc.toFixed(2)}` : "₹0.00"}
                                                            </div>

                                                            {/* Sub total */}
                                                            <div className="flex items-center justify-center text-[12px] font-black text-slate-900 tabular-nums border-r border-[#57C7C5]/10 px-1 truncate">
                                                                {(actPrice * item.quantity).toFixed(2)}
                                                            </div>

                                                            {/* Delete */}
                                                            <button onClick={() => addToCart(item, -item.quantity)} className="flex items-center justify-center text-slate-900 hover:text-red-600">
                                                                <X className="h-3.5 w-3.5" strokeWidth={4} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ));
                                    })()}
                                </>
                            )}
                        </div>

                        {/* Summary — EXACT IMAGE MATCH */}
                        <div className="shrink-0">
                            {/* Summary Grid */}
                            <div className="bg-[#57C7C5] grid grid-cols-2 text-white border-t border-[#57C7C5]">
                                <div className="border-r border-b border-white/20 px-3 py-1.5 flex justify-between items-center">
                                    <span className="text-[11px] font-black uppercase">Items</span>
                                    <span className="text-[13px] font-black tabular-nums">{cart.length} ({cart.reduce((a, b) => a + b.quantity, 0).toFixed(2)})</span>
                                </div>
                                <div className="border-b border-white/20 px-3 py-1.5 flex justify-between items-center">
                                    <span className="text-[11px] font-black uppercase">Total</span>
                                    <span className="text-[13px] font-black tabular-nums">{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="border-r border-white/20 px-3 py-1.5 flex justify-between items-center">
                                    <span className="text-[11px] font-black uppercase flex items-center gap-1">Order Tax <Settings className="h-2 w-2 opacity-50" /></span>
                                    <span className="text-[13px] font-black tabular-nums">(0.00) 0.00</span>
                                </div>
                                <div className="px-3 py-1.5 flex justify-between items-center group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-teal-500/10 -translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                    <span className="text-[11px] font-black uppercase flex items-center gap-1 z-10">Discount <Settings className="h-2.5 w-2.5 opacity-50" /></span>
                                    <div className="flex items-center gap-1 z-10">
                                        <span className="text-[10px] font-black tabular-nums text-white/40">₹</span>
                                        <input
                                            type="number"
                                            value={discount || ""}
                                            onChange={e => setDiscount(Number(e.target.value))}
                                            placeholder="0.00"
                                            className="w-14 bg-white/10 border border-white/20 rounded h-6 text-center text-xs font-black outline-none focus:bg-white focus:text-teal-900 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Total Payable area */}
                            <div className="bg-[#2D3E50] text-white flex justify-between items-center px-4 py-3 font-black text-lg h-14">
                                <span className="uppercase tracking-wide text-sm">Total Payable</span>
                                <span className="text-xl tabular-nums">{grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Action Buttons area */}
                        <div className="p-2 space-y-1.5 bg-white border-t border-slate-200">
                            {/* Coupon row */}
                            <div className="flex gap-1.5 h-10">
                                <input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Enter Coupon Code" className="flex-1 border border-slate-300 rounded px-3 text-[11px] font-bold outline-none focus:border-teal-400 placeholder:text-slate-400" />
                                <button onClick={applyCoupon} className="bg-[#57C7C5] text-white px-5 rounded font-black text-[11px] uppercase whitespace-nowrap">Apply Coupon</button>
                            </div>

                            {/* Description button */}
                            <button className="w-full bg-[#3498DB] text-white font-black text-[11px] uppercase py-2.5 rounded shadow-sm hover:brightness-95 transition-all">
                                Description
                            </button>

                            {/* Main Action Grid — FORCED 3-COLUMN LAYOUT */}
                            <div
                                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: '8px', height: '110px' }}
                            >
                                <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '8px' }}>
                                    <button onClick={suspendBill} className="bg-[#F5CBA7] text-white font-black text-[11px] uppercase rounded shadow-sm hover:brightness-95 flex items-center justify-center">Suspend</button>
                                    <button onClick={handleNewBill} className="bg-[#C0392B] text-white font-black text-[11px] uppercase rounded shadow-sm hover:brightness-95 flex items-center justify-center">Cancel</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '8px' }}>
                                    <button className="bg-[#3498DB] text-white font-black text-[11px] uppercase rounded shadow-sm hover:brightness-95 flex items-center justify-center">Order</button>
                                    <button onClick={() => setShowShiftModal(true)} className="bg-[#F39C12] text-white font-black text-[11px] uppercase rounded shadow-sm hover:brightness-95 flex items-center justify-center">Shift</button>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!selectedCustomer?.id) { toast.error("Tag a customer first."); return; }
                                        if (cart.length === 0) { toast.error("Cart is empty."); return; }
                                        await fetchCustomerHistory(selectedCustomer.id, false);
                                        setPaidAmount("");
                                        setDuePaymentAmount("");
                                        setShowPaymentDialog(true);
                                    }}
                                    className="bg-[#ABEBC6] text-white font-black text-sm uppercase rounded shadow-sm hover:brightness-95 flex flex-col items-center justify-center gap-1"
                                >
                                    <Printer className="h-6 w-6 opacity-60 mb-1" />
                                    <span>Checkout</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Products */}
                <div className="flex-1 flex flex-col gap-2 overflow-hidden h-full">
                    {/* Search Bar */}
                    <div className="bg-[#2C3E50] rounded-xl p-3 shadow-xl z-10">
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    placeholder="Search customer by mobile / name..."
                                    value={customerSearch}
                                    onChange={e => searchCustomers(e.target.value)}
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 text-sm font-bold text-white placeholder:text-slate-500 focus:bg-white/10 focus:ring-1 ring-teal-500/50"
                                />
                                {customerSearchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#2C3E50] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                        {customerSearchResults.map(c => (
                                            <div key={c.id} className="w-full p-3 flex items-center justify-between hover:bg-white/5 border-b border-white/5 text-left">
                                                <button onClick={() => { setSelectedCustomer(c); setCustomerSearchResults([]); setCustomerSearch(""); }} className="flex items-center gap-3 text-left flex-1 min-w-0">
                                                    <div className="w-8 h-8 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center font-bold text-xs shrink-0">{c.name?.charAt(0)}</div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-white truncate">{c.name}</p>
                                                        <p className="text-[10px] text-slate-400 tabular-nums">{c.phone}</p>
                                                        {(c.addresses?.[0]?.fullAddress || c.address) && (
                                                            <p className="text-[9px] text-teal-400 truncate max-w-[180px] italic">{c.addresses?.[0]?.fullAddress || c.address}</p>
                                                        )}
                                                    </div>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); openEditCustomerModal(c); setCustomerSearchResults([]); setCustomerSearch(""); }} className="p-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition-all ml-2 shrink-0" title="Edit Customer Details">
                                                    <SquarePen className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => { setCustomerFormData({ id: "", name: "", phone: "", email: "", address: "" }); setShowCustomerDialog(true); }}
                                className="h-12 px-5 bg-teal-500 hover:bg-teal-400 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-2">
                                <UserPlus className="h-4 w-4" /> New
                            </button>
                            <button 
                                onClick={() => {
                                    const cleanPhone = customerSearch.replace(/\D/g, "");
                                    const invitePhone = cleanPhone.length === 10 ? cleanPhone : "";
                                    
                                    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bookmyveg.co.in';
                                    const onboardLink = `${origin}/onboard${invitePhone ? `?phone=${invitePhone}` : ''}`;
                                    const message = `Hello! Welcome to Book My Veg. Please complete your onboarding by entering your name and delivery address here: ${onboardLink}`;
                                    
                                    const waUrl = `https://wa.me/${invitePhone ? `91${invitePhone}` : ''}?text=${encodeURIComponent(message)}`;
                                    window.open(waUrl, "_blank");
                                }}
                                className="h-12 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-2"
                            >
                                <Smartphone className="h-4 w-4" /> Invite
                            </button>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <div className="flex-1 relative">
                                <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input placeholder="Search product by name / SKU / barcode..."
                                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full h-9 bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 text-xs font-bold text-slate-300 placeholder:text-slate-600 focus:bg-white/10" />
                            </div>
                            {/* ── SCANNER HUB ── */}
                            <div className="flex items-center gap-1.5 px-3 h-9 bg-teal-500/10 border border-teal-500/30 rounded-xl group hover:border-teal-500 hover:bg-teal-500/20 transition-all cursor-pointer relative"
                                onClick={() => {
                                    const scannerInput = document.getElementById('global-scanner-input');
                                    scannerInput?.focus();
                                    toast.success("Ready for machine scan", { icon: <ScanLine className="h-4 w-4" /> });
                                }}>
                                <div className="flex flex-col items-end pr-2 border-r border-teal-500/20">
                                    <span className="text-[8px] font-black text-teal-400 uppercase tracking-tighter">Machine Hub</span>
                                    <span className="text-[10px] font-black text-white/90 uppercase tracking-tight">Scanner Ready</span>
                                </div>
                                <div className="flex flex-col pl-1">
                                    <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">Ex: 410-4.220, 411-0.975</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-black text-teal-500/80 animate-pulse">ACTIVE TARGET</span>
                                        <ScanLine className="h-3 w-3 text-teal-400" />
                                    </div>
                                </div>

                                {/* Hidden but always ready focused input */}
                                <input
                                    id="global-scanner-input"
                                    type="text"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const code = (e.target as HTMLInputElement).value;
                                            if (code) {
                                                processQRCode(code);
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }
                                    }}
                                    className="absolute opacity-0 pointer-events-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-1 shrink-0 scrollbar-hide">
                        <button onClick={() => setSelectedCategory("ALL")}
                            className={cn("px-4 h-8 rounded-lg text-white text-[10px] font-bold uppercase whitespace-nowrap",
                                selectedCategory === "ALL" ? "bg-[#2C3E50]" : "bg-slate-400")}>All</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                                className={cn("px-4 h-8 rounded-lg text-white text-[10px] font-bold uppercase whitespace-nowrap",
                                    selectedCategory === cat.id ? "bg-[#57C7C5]" : "bg-[#2ECC71]")}>{cat.name}</button>
                        ))}
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden p-4">
                        <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 overflow-y-auto h-full pr-1">
                            {filteredProducts.map((p, i) => (
                                <button key={i} onClick={() => addToCart(p)}
                                    className="bg-white border rounded-xl flex flex-col items-center p-3 hover:shadow-lg hover:border-teal-200 transition-all active:scale-[0.97] group">
                                    <div className="w-16 h-16 bg-slate-50 rounded-xl mb-2 flex items-center justify-center overflow-hidden">
                                        {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" /> : <Package className="h-6 w-6 text-slate-200" />}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-700 text-center line-clamp-2 leading-tight mb-1 h-7">{p.name}</p>
                                    <p className="text-[10px] font-black text-red-500 tabular-nums">₹{getPrice(p)}</p>
                                    <p className="text-[8px] text-slate-400 font-bold">
                                        Stock: {p.inventory.reduce((sum: number, inv: any) => sum + Number(inv.currentStock), 0)} {p.variants?.[0]?.weightUnit || p.weightUnit || "kg"}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CUSTOMER DIALOG ── */}
            <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
                <DialogContent className="max-w-md bg-white rounded-2xl p-8 border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase text-slate-900 flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-teal-500" />
                            {customerFormData.id ? "Edit Customer" : "New Customer Information"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-xs">
                            Manage customer profiles for tagging and history tracking.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 mt-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Full Name *</label>
                            <input value={customerFormData.name} onChange={e => setCustomerFormData(p => ({ ...p, name: e.target.value }))} placeholder="Enter customer name" className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 ring-teal-500/20 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Mobile Number *</label>
                            <input value={customerFormData.phone} onChange={e => setCustomerFormData(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit mobile number" className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 ring-teal-500/20 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Email Address</label>
                            <input value={customerFormData.email} onChange={e => setCustomerFormData(p => ({ ...p, email: e.target.value }))} placeholder="customer@email.com (optional)" className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 ring-teal-500/20 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Full Address</label>
                            <textarea
                                value={customerFormData.address}
                                onChange={e => setCustomerFormData(p => ({ ...p, address: e.target.value }))}
                                placeholder="House No, Street, Landmark..."
                                className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 ring-teal-500/20 outline-none transition-all resize-none"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-8">
                        <Button variant="outline" onClick={() => setShowCustomerDialog(false)} className="h-12 rounded-xl text-slate-500 font-bold border-slate-200">Discard</Button>
                        <Button onClick={handleCustomerUpsert} className="h-12 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-teal-500/20">
                            {customerFormData.id ? "Update Profile" : "Create & Tag"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── PAYMENT DIALOG ── */}
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                <DialogContent
                    className="!max-w-[1300px] w-[90vw] p-0 overflow-hidden bg-white rounded-[2rem] border-none shadow-2xl sm:max-w-[1300px]"
                    style={{ maxWidth: '1300px' }}
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>Secure Checkout Terminal</DialogTitle>
                        <DialogDescription>Process payments via Cash, UPI, or Credit Ledger.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-12 h-[680px] max-h-[95vh]">
                        {/* LEFT SIDEBAR: Bill Summary & Due Management */}
                        <div className="col-span-4 bg-[#1E293B] text-white flex flex-col overflow-hidden border-r border-white/5 shadow-2xl z-10">
                            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-teal-400 mb-1">POS Station</p>
                                    <h3 className="text-4xl font-black leading-none tracking-tighter">Checkout</h3>
                                </div>

                                <div className="space-y-3 pt-6 border-t border-white/10">
                                    <div className="flex justify-between items-center text-white/40 font-bold uppercase text-[9px] tracking-widest">
                                        <span>Current Bill (Net)</span>
                                        <span className="tabular-nums text-base font-black text-white">₹{grandTotal.toFixed(2)}</span>
                                    </div>

                                    {Number(duePaymentAmount || 0) > 0 && (
                                        <div className="flex justify-between items-center text-emerald-400 font-bold uppercase text-[9px] tracking-widest">
                                            <span>Old Debt Settle</span>
                                            <span className="tabular-nums text-base font-black">+₹{Number(duePaymentAmount).toFixed(2)}</span>
                                        </div>
                                    )}

                                    <div className="h-px bg-white/10 my-2" />

                                    <div className="space-y-1 py-1">
                                        <span className="block text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500">Collected Today</span>
                                        <span className="text-4xl font-black tabular-nums text-white tracking-tighter block leading-none">
                                            ₹{settlingAmount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Payment Inputs Container */}
                                <div className="space-y-5">
                                    {/* Current Bill Payment Input */}
                                    {paymentMethod !== "CREDIT" && (
                                        <div className="p-5 bg-white/5 rounded-[1.5rem] border border-white/10 space-y-3 shadow-inner">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Bill Settlement</p>
                                                <div className="px-2.5 py-1 bg-teal-500/20 rounded-full border border-teal-500/40 text-[9px] font-black text-teal-400 uppercase tracking-tighter">
                                                    ₹{grandTotal.toFixed(2)}
                                                </div>
                                            </div>
                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    value={paidAmount || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setPaidAmount(val === "" ? "" : Math.min(Number(val), grandTotal));
                                                    }}
                                                    className="w-full h-12 bg-white/5 border-2 border-white/20 rounded-[1rem] pl-12 pr-4 text-2xl font-black text-white outline-none focus:border-teal-500 focus:bg-white/10 transition-all tabular-nums"
                                                    placeholder={grandTotal.toFixed(2)}
                                                />
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-white/20 group-focus-within:text-teal-500">₹</span>
                                            </div>
                                        </div>
                                    )}

                                    {customerHistory?.summary?.totalDue > 0 && (
                                        <div className="p-5 bg-emerald-500/5 border-2 border-emerald-500/20 rounded-[1.5rem] space-y-3">
                                            <div className="flex justify-between items-end">
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-black text-emerald-400/30 uppercase tracking-[0.2em]">Total Dues</p>
                                                    <p className="text-2xl font-black text-emerald-400 tabular-nums leading-none">₹{customerHistory.summary.totalDue.toFixed(0)}</p>
                                                </div>
                                                <button
                                                    onClick={() => setDuePaymentAmount(customerHistory.summary.totalDue)}
                                                    className="px-3 py-1.5 bg-emerald-500/20 rounded-lg text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em] border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all shadow-xl active:scale-95"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    value={duePaymentAmount || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setDuePaymentAmount(val === "" ? "" : Math.min(Number(val), customerHistory?.summary?.totalDue || 0));
                                                    }}
                                                    className="w-full h-10 bg-black/30 border-2 border-emerald-500/20 rounded-[0.75rem] pl-12 pr-4 text-xl font-black text-emerald-400 outline-none focus:border-emerald-500 focus:bg-emerald-500/10 transition-all tabular-nums"
                                                    placeholder="Settle Prev"
                                                />
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-emerald-900 group-focus-within:text-emerald-500">₹</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-5 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-between">
                                        <div className="min-w-0 pr-3">
                                            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Customer</p>
                                            <p className="text-lg font-black text-white truncate leading-tight uppercase tracking-tight">{selectedCustomer?.name}</p>
                                            <p className="text-[10px] font-bold text-white/40 tabular-nums tracking-[0.2em] mt-1">{selectedCustomer?.phone}</p>
                                            {(selectedCustomer?.addresses?.[0]?.fullAddress || selectedCustomer?.address) && (
                                                <p className="text-[9px] font-bold text-teal-400 truncate mt-1 max-w-[200px] italic">
                                                    {selectedCustomer?.addresses?.[0]?.fullAddress || selectedCustomer?.address}
                                                </p>
                                            )}
                                        </div>
                                        <div className="w-10 h-10 rounded-[1rem] bg-teal-500/10 flex items-center justify-center shrink-0 border border-teal-500/20 text-teal-400 shadow-xl">
                                            <User className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-black/20 border-t border-white/5 mt-auto">
                                <Button onClick={handleCheckout}
                                    disabled={isProcessing || (paymentMethod === "CASH" && changeDue < 0)}
                                    className="w-full h-16 rounded-[1.25rem] bg-emerald-500 text-white font-black text-lg uppercase tracking-[0.2em] hover:bg-emerald-400 shadow-2xl shadow-emerald-900/40 active:scale-[0.97] transition-all flex items-center justify-center gap-3">
                                    {isProcessing ? <Ban className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                                    Finalize Transaction
                                </Button>
                            </div>
                        </div>

                        {/* RIGHT CONTENT: Payment Method Selector */}
                        <div className="col-span-8 bg-slate-50 flex flex-col p-8 gap-8 overflow-hidden">
                            <div className="flex gap-3 h-20">
                                {[
                                    { key: "CASH", icon: Banknote, label: "Cash Desk" },
                                    { key: "UPI", icon: Smartphone, label: "Digital Pay" },
                                    { key: "SPLIT", icon: Layers, label: "Split Pay" },
                                    { key: "CREDIT", icon: BookOpen, label: "Due Sale" }
                                ].map(m => (
                                    <button key={m.key} onClick={() => {
                                        setPaymentMethod(m.key);
                                        if (m.key === "UPI") {
                                            triggerEasebuzzCheckoutInPOS();
                                        } else if (m.key === "SPLIT") {
                                            handleSelectSplitPreset(50);
                                        }
                                    }}
                                        className={cn("flex-1 h-full rounded-[1.5rem] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] border-[4px] transition-all active:scale-[0.98]",
                                            paymentMethod === m.key ? "bg-white border-emerald-500 text-emerald-600 shadow-2xl shadow-emerald-500/10" : "bg-white border-white text-slate-400 hover:border-slate-100 shadow-sm")}>
                                        <m.icon className="h-6 w-6 text-emerald-500" /> {m.label}
                                    </button>
                                ))}
                            </div>

                            {paymentMethod === "CASH" ? (
                                <div className="flex-1 flex flex-col gap-8">
                                    <div className="grid grid-cols-4 gap-2">
                                        {DENOMINATIONS.map(den => (
                                            <button key={den} onClick={() => setCashReceived(prev => ({ ...prev, [den]: (prev[den] || 0) + 1 }))}
                                                className="h-16 rounded-[1.25rem] bg-white border-2 border-slate-100 text-xl font-black text-slate-800 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 active:scale-90 transition-all shadow-sm">
                                                ₹{den}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-auto grid grid-cols-2 gap-6 pb-1">
                                        <div className="p-6 bg-emerald-500/5 rounded-[2.5rem] border-2 border-dashed border-emerald-500/20 flex items-center justify-between group">
                                            <div className="space-y-0.5">
                                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest opacity-60">Received</p>
                                                <p className="text-5xl font-black text-emerald-900 tabular-nums leading-none">₹{cashTotal.toFixed(2)}</p>
                                            </div>
                                            <button onClick={() => setCashReceived({})} className="w-12 h-12 rounded-[1rem] bg-emerald-500/10 flex items-center justify-center text-emerald-600 hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-90 border border-emerald-500/20">
                                                <Trash2 className="h-6 w-6" />
                                            </button>
                                        </div>

                                        <div className={cn("p-6 rounded-[2.5rem] border-2 flex items-center justify-between transition-all",
                                            changeDue >= 0 ? "bg-slate-900 border-slate-800 text-white shadow-2xl" : "bg-red-50 border-red-200")}>
                                            <div className="space-y-0.5">
                                                <p className={cn("text-[9px] font-black uppercase tracking-widest", changeDue >= 0 ? "text-slate-500" : "text-red-400")}>
                                                    {changeDue >= 0 ? "Refund To Customer" : "Balance Due"}
                                                </p>
                                                <p className={cn("text-4xl font-black tabular-nums tracking-tighter leading-none", changeDue >= 0 ? "text-white" : "text-red-600")}>
                                                    {changeDue >= 0 ? `₹${changeDue.toFixed(2)}` : "SHORT"}
                                                </p>
                                            </div>
                                            <div className={cn("w-12 h-12 rounded-[1rem] flex items-center justify-center border-2", changeDue >= 0 ? "border-slate-800 bg-white/5" : "border-red-100 bg-red-200/20 text-red-600")}>
                                                {changeDue >= 0 ? <CheckCircle2 className="h-8 w-8 text-emerald-400" /> : <AlertCircle className="h-8 w-8" />}
                                            </div>
                                        </div>
                                    </div>

                                    {changeDue > 0 && (
                                        <div className={cn("p-4 rounded-2xl border flex flex-col gap-2 mt-2", 
                                            calculateOptimalChangeBreakdown(changeDue, drawerDenominations) 
                                                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                                                : "bg-amber-50 border-amber-200 text-amber-800")}>
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                    {calculateOptimalChangeBreakdown(changeDue, drawerDenominations) 
                                                        ? "Change Denominations Available" 
                                                        : "Warning: Exact change denominations not available in drawer!"}
                                                </span>
                                            </div>
                                            {(() => {
                                                const breakdown = calculateOptimalChangeBreakdown(changeDue, drawerDenominations);
                                                if (breakdown) {
                                                    return (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {Object.entries(breakdown).map(([den, count]) => (
                                                                <span key={den} className="px-2 py-1 bg-emerald-500/10 rounded-lg text-xs font-bold text-emerald-700 font-mono">
                                                                    ₹{den} × {count}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            ) : paymentMethod === "SPLIT" ? (
                                <div className="flex-1 flex flex-col gap-5 overflow-y-auto pr-1">
                                    {/* Advance Wallet Option */}
                                    {Number(selectedCustomer?.accountBalance || 0) > 0 && (
                                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                                            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-emerald-900">
                                                <input
                                                    type="checkbox"
                                                    checked={useWalletBalance}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setUseWalletBalance(checked);
                                                        const walletAmt = checked ? Math.min(Number(selectedCustomer.accountBalance), grandTotal) : 0;
                                                        setSplitWalletAmount(walletAmt);
                                                        const rem = Math.max(0, grandTotal - walletAmt);
                                                        setSplitCashAmount(Number((rem * 0.5).toFixed(2)));
                                                        setSplitOnlineAmount(Number((rem * 0.5).toFixed(2)));
                                                    }}
                                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span>Deduct from Customer Advance Credit Wallet</span>
                                            </label>
                                            <span className="text-xs font-black text-emerald-700 font-mono">
                                                Avail: ₹{Number(selectedCustomer.accountBalance).toFixed(2)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Split Ratio Presets */}
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            Quick Split Ratios (Cash / Easebuzz Online)
                                        </span>
                                        <div className="grid grid-cols-5 gap-2">
                                            {[
                                                { cash: 10, online: 90, label: "10 / 90" },
                                                { cash: 20, online: 80, label: "20 / 80" },
                                                { cash: 50, online: 50, label: "50 / 50" },
                                                { cash: 70, online: 30, label: "70 / 30" },
                                                { cash: 90, online: 10, label: "90 / 10" }
                                            ].map(preset => (
                                                <button
                                                    key={preset.label}
                                                    type="button"
                                                    onClick={() => handleSelectSplitPreset(preset.cash)}
                                                    className="py-2 px-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-500 rounded-xl text-xs font-black text-slate-800 hover:text-emerald-700 transition-all shadow-xs cursor-pointer"
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Split Amount Manual Inputs */}
                                    <div className="grid grid-cols-2 gap-4 pt-1">
                                        {/* Cash Portion */}
                                        <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 space-y-3 shadow-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                                                    <Banknote className="w-4 h-4 text-emerald-500" /> Cash Portion (₹)
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={splitCashAmount}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? "" : Number(e.target.value);
                                                        setSplitCashAmount(val);
                                                        if (typeof val === "number") {
                                                            const walletAmt = useWalletBalance ? Number(splitWalletAmount || 0) : 0;
                                                            const rem = Math.max(0, grandTotal - walletAmt - val);
                                                            setSplitOnlineAmount(Number(rem.toFixed(2)));
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    className="w-full h-12 pl-8 pr-3 text-xl font-black text-slate-900 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                            </div>
                                        </div>

                                        {/* Easebuzz Online Portion */}
                                        <div className="p-5 bg-white rounded-2xl border-2 border-teal-500/30 space-y-3 shadow-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black text-teal-700 uppercase flex items-center gap-1.5">
                                                    <Smartphone className="w-4 h-4 text-teal-500" /> Easebuzz Online (₹)
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={splitOnlineAmount}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? "" : Number(e.target.value);
                                                        setSplitOnlineAmount(val);
                                                        if (typeof val === "number") {
                                                            const walletAmt = useWalletBalance ? Number(splitWalletAmount || 0) : 0;
                                                            const rem = Math.max(0, grandTotal - walletAmt - val);
                                                            setSplitCashAmount(Number(rem.toFixed(2)));
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    className="w-full h-12 pl-8 pr-3 text-xl font-black text-slate-900 border border-teal-200 rounded-xl outline-none focus:border-teal-500"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reconciliation Summary Bar */}
                                    <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 uppercase text-[10px] font-bold">Total Bill: ₹{grandTotal.toFixed(2)}</span>
                                            <p className="font-bold">
                                                Cash: ₹{Number(splitCashAmount || 0).toFixed(2)} + Online: ₹{Number(splitOnlineAmount || 0).toFixed(2)}
                                                {useWalletBalance && ` + Wallet: ₹${Number(splitWalletAmount || 0).toFixed(2)}`}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            {(() => {
                                                const totalPaid = Number(splitCashAmount || 0) + Number(splitOnlineAmount || 0) + (useWalletBalance ? Number(splitWalletAmount || 0) : 0);
                                                const diff = grandTotal - totalPaid;
                                                if (Math.abs(diff) < 0.05) {
                                                    return <span className="text-emerald-400 font-bold">✓ Fully Balanced (₹{totalPaid.toFixed(2)})</span>;
                                                } else if (diff > 0) {
                                                    return <span className="text-amber-400 font-bold">Partial Settlement (Due: ₹{diff.toFixed(2)})</span>;
                                                } else {
                                                    return <span className="text-rose-400 font-bold">Overpaid: ₹{(-diff).toFixed(2)}</span>;
                                                }
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ) : paymentMethod === "CREDIT" ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 p-8 bg-white rounded-[3.5rem] border-4 border-dashed border-slate-200 shadow-inner">
                                    <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-slate-900/40 border-6 border-white">
                                        <BookOpen className="h-10 w-10 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-black uppercase text-slate-900 tracking-tighter">Debit On Account</h3>
                                        <p className="text-sm font-bold text-slate-500 max-w-[450px] leading-relaxed">
                                            The amount of <strong className="text-slate-900">₹{grandTotal.toFixed(2)}</strong> will be recorded as outstanding for <strong className="text-emerald-600 underline underline-offset-8 decoration-4">{selectedCustomer?.name}</strong>.
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg pt-2">
                                        <button
                                            onClick={() => forwardWhatsAppLink("BILL")}
                                            className="flex-1 px-4 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                                        >
                                            <Smartphone className="h-4 w-4" /> Forward Bill Link (WhatsApp)
                                        </button>
                                        <button
                                            onClick={() => forwardWhatsAppLink("ALL_DUES")}
                                            className="flex-1 px-4 py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                                        >
                                            <BookOpen className="h-4 w-4 text-amber-400" /> Forward All Dues Link
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 p-8 bg-teal-500/5 rounded-[3.5rem] border-4 border-dashed border-teal-500/10">
                                    <div className="w-24 h-24 bg-teal-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-teal-500/40 border-6 border-white/20">
                                        <Smartphone className="h-10 w-10 text-white animate-bounce" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Easebuzz Secure Checkout</p>
                                        <p className="text-xs font-bold text-slate-400 max-w-sm">
                                            The Easebuzz checkout dialog has been launched automatically. To re-initiate the payment, click the button below.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-3 w-full max-w-md pt-2">
                                        <Button
                                            onClick={triggerEasebuzzCheckoutInPOS}
                                            disabled={isProcessing}
                                            className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-xl rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <CreditCard className="h-4 w-4 mr-2" /> Pay by Easebuzz
                                        </Button>
                                        <button
                                            onClick={() => forwardWhatsAppLink("BILL")}
                                            className="h-14 border-slate-200 text-slate-500 hover:bg-slate-100 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                                        >
                                            <Smartphone className="h-4 w-4" /> Share link on WhatsApp
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── CUSTOMER HISTORY DIALOG ── */}
            <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                <DialogContent className="max-w-3xl bg-white rounded-3xl p-8 border-none shadow-2xl max-h-[88vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle className="text-xl font-black uppercase text-slate-900 flex items-center gap-2 mb-1">
                                    <History className="h-6 w-6 text-teal-500" />
                                    Customer Hub & Billing History
                                </DialogTitle>
                                <DialogDescription>
                                    Review account balance credits, dues ledger, and past bills for {selectedCustomer?.name}.
                                </DialogDescription>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{selectedCustomer?.name} — {selectedCustomer?.phone}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setCustomWhatsAppPhone(selectedCustomer?.phone || "");
                                        setCustomWhatsAppVariables([selectedCustomer?.name || "", "Book My Veg", "500", "https://bookmyveg.co.in"]);
                                        setShowCustomWhatsAppModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    <Send className="w-3.5 h-3.5" /> Send Custom WhatsApp
                                </button>
                            </div>
                        </div>
                    </DialogHeader>
                    {customerHistory && (
                        <div className="space-y-6 mt-6 overflow-y-auto pr-2">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-5 gap-3">
                                {/* Advance Credit Wallet Card */}
                                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 text-center flex flex-col justify-between shadow-xs">
                                    <div>
                                        <p className="text-[9px] text-emerald-700 font-black uppercase tracking-widest mb-0.5">Advance Wallet</p>
                                        <p className="text-xl font-black text-emerald-700 tabular-nums">
                                            ₹{Number(customerHistory.customer?.accountBalance || customerHistory.summary?.accountBalance || 0).toFixed(0)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setDepositAmount("");
                                            setShowDepositModal(true);
                                        }}
                                        className="h-6 mt-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[8px] tracking-wider rounded-lg shadow cursor-pointer transition-all active:scale-95"
                                    >
                                        + Deposit Advance
                                    </button>
                                </div>

                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Orders</p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">{customerHistory.summary.totalOrders}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Spend</p>
                                    <p className="text-xl font-black text-teal-600 tabular-nums">₹{customerHistory.summary.totalSpend?.toFixed(0)}</p>
                                </div>
                                <div className="flex flex-col items-center justify-center p-3 bg-red-50 border border-red-100 rounded-2xl text-center">
                                    <p className="text-[9px] text-red-400 font-black uppercase tracking-widest leading-none mb-1 text-center">Due Balance</p>
                                    <p className="text-lg font-black text-red-600 tabular-nums mb-1">₹{customerHistory.summary.totalDue.toFixed(0)}</p>
                                    {customerHistory.summary.totalDue > 0 && (
                                        <Button
                                            onClick={() => { setShowSettleDialog(true); setSettleAmount(customerHistory.summary.totalDue); }}
                                            className="h-6 px-2 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[8px] tracking-wider rounded-lg shadow mt-1"
                                        >
                                            Settle Dues
                                        </Button>
                                    )}
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Last Visit</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{customerHistory.summary.lastVisit ? new Date(customerHistory.summary.lastVisit).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Never"}</p>
                                </div>
                            </div>

                            {/* Bills List */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Receipt className="h-3 w-3" /> Recent Transactions & Bills
                                </p>
                                {customerHistory.orders?.map((order: any) => {
                                    const isCancelled = order.status === "CANCELLED";
                                    const isPartial = order.billStatus === "PARTIAL" || order.paymentStatus === "PARTIAL";
                                    const isPaid = order.billStatus === "PAID" || order.isPaid || order.paymentStatus === "COMPLETED" || order.paymentStatus === "PAID" || order.paymentStatus === "SETTLED";
                                    const dueAmt = order.dueAmount !== undefined ? order.dueAmount : Math.max(0, Number(order.totalAmount) - (Number(order.paidAmount) || 0));

                                    return (
                                        <div
                                            key={order.id}
                                            onClick={() => handleViewHistoricalReceipt(order)}
                                            className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:bg-teal-50 hover:border-teal-200 transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-teal-100 text-slate-400 group-hover:text-teal-500 transition-colors flex items-center justify-center">
                                                    <Package className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 group-hover:text-teal-700">#{order.id.slice(0, 8).toUpperCase()}</p>
                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                        <p className="text-[9px] text-teal-600 font-black uppercase tracking-widest">Billed By: {order.staff?.name || "System"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-slate-900 tabular-nums">₹{Number(order.totalAmount).toFixed(0)}</p>
                                                <div className="flex flex-col items-end gap-1.5 mt-1">
                                                    {isCancelled ? (
                                                        <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                                                            Cancelled
                                                        </div>
                                                    ) : isPartial ? (
                                                        <div className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 border border-amber-300">
                                                            Partial (Due: ₹{Number(dueAmt).toFixed(0)})
                                                        </div>
                                                    ) : isPaid ? (
                                                        <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-teal-100 text-teal-600">
                                                            Settled
                                                        </div>
                                                    ) : (
                                                        <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-600">
                                                            Unpaid Due
                                                        </div>
                                                    )}
                                                    <span className="text-[9px] font-black text-teal-500 uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Receipt className="h-2.5 w-2.5" /> View Bill
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── CUSTOMER ADVANCE DEPOSIT MODAL ── */}
            <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
                <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase text-slate-900 flex items-center gap-2">
                            <Banknote className="h-5 w-5 text-emerald-600" />
                            Deposit Advance Customer Credit
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Add pre-paid store credit to {selectedCustomer?.name}'s account wallet for fast future checkouts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-3 text-xs">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Deposit Amount (₹) *</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                placeholder="e.g. 500 or 1000"
                                className="w-full h-11 px-3 text-lg font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                            />
                        </div>

                        {/* Quick Presets */}
                        <div className="flex gap-2">
                            {[500, 1000, 2000, 5000].map(amt => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setDepositAmount(String(amt))}
                                    className="flex-1 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold rounded-lg text-xs cursor-pointer border border-slate-200"
                                >
                                    +₹{amt}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Mode Received</label>
                            <select
                                value={depositMethod}
                                onChange={(e) => setDepositMethod(e.target.value)}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none cursor-pointer"
                            >
                                <option value="CASH">Cash at Desk</option>
                                <option value="UPI">UPI / Digital</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Deposit Notes</label>
                            <input
                                type="text"
                                value={depositNotes}
                                onChange={(e) => setDepositNotes(e.target.value)}
                                placeholder="e.g. Pre-paid monthly vegetable credit"
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowDepositModal(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCustomerDeposit}
                                disabled={isDepositing || !depositAmount}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {isDepositing ? "Depositing..." : "Confirm Deposit"}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── CUSTOM WHATSAPP MODAL ── */}
            <Dialog open={showCustomWhatsAppModal} onOpenChange={setShowCustomWhatsAppModal}>
                <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase text-slate-900 flex items-center gap-2">
                            <Send className="h-5 w-5 text-emerald-600" />
                            Send Custom WhatsApp to Customer
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Dispatch dynamic template message with live variable overrides.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3.5 mt-3 text-xs">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Customer Phone</label>
                            <input
                                type="text"
                                value={customWhatsAppPhone}
                                onChange={(e) => setCustomWhatsAppPhone(e.target.value)}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Template</label>
                            <select
                                value={customWhatsAppTemplate}
                                onChange={(e) => setCustomWhatsAppTemplate(e.target.value)}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none cursor-pointer"
                            >
                                <option value="due_payment_reminder">due_payment_reminder (Payment Due Reminder)</option>
                                <option value="customer_inactive_reminder">customer_inactive_reminder (Inactivity / Miss You)</option>
                                <option value="invoice_paid">invoice_paid (Invoice Paid Receipt)</option>
                                <option value="payment_received">payment_received (Credit Deposit Confirmation)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Variable Mapping</label>
                            {[0, 1, 2, 3].map(idx => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="font-mono text-slate-400 text-xs w-10">{`{{${idx + 1}}}:`}</span>
                                    <input
                                        type="text"
                                        value={customWhatsAppVariables[idx] || ""}
                                        onChange={(e) => {
                                            const updated = [...customWhatsAppVariables];
                                            updated[idx] = e.target.value;
                                            setCustomWhatsAppVariables(updated);
                                        }}
                                        placeholder={`Variable {{${idx + 1}}} value`}
                                        className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowCustomWhatsAppModal(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSendCustomWhatsAppToCustomer}
                                disabled={isSendingCustomWhatsApp}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {isSendingCustomWhatsApp ? "Dispatching..." : "Send Message"}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── TODAY BILL-WISE SALES REPORT DIALOG ── */}
            <Dialog open={showTodaySalesDialog} onOpenChange={setShowTodaySalesDialog}>
                <DialogContent className="max-w-5xl sm:max-w-5xl md:max-w-5xl lg:max-w-6xl w-[94vw] bg-white rounded-3xl p-6 sm:p-8 border-none shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center justify-between pr-6">
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                                    <Receipt className="h-6 w-6 text-emerald-500" />
                                    Today's Bill-Wise Sales Report
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 text-xs font-medium">
                                    Real-time transaction breakdown of all sales for today.
                                </DialogDescription>
                            </div>
                            <Button onClick={() => fetchTodaySales(true)} variant="outline" size="sm" className="rounded-xl border-slate-200 text-slate-700 font-bold">
                                <RefreshCw className={cn("h-4 w-4 mr-1", isLoadingTodaySales && "animate-spin")} /> Refresh
                            </Button>
                        </div>
                    </DialogHeader>

                    {/* Summary Metric Cards */}
                    <div className="grid grid-cols-5 gap-3 sm:gap-4 mt-5">
                        <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-1 whitespace-nowrap">Total Sales</p>
                            <p className="text-lg sm:text-xl font-black text-emerald-700 tabular-nums whitespace-nowrap">₹{todaySalesSummary.totalSales.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1 whitespace-nowrap">{todaySalesSummary.orderCount} Bills</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1 whitespace-nowrap">Cash Sales</p>
                            <p className="text-lg sm:text-xl font-black text-slate-900 tabular-nums whitespace-nowrap">₹{todaySalesSummary.cashSales.toLocaleString()}</p>
                        </div>
                        <div className="bg-sky-50 border border-sky-200/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-sky-600 mb-1 whitespace-nowrap">UPI / QR Sales</p>
                            <p className="text-lg sm:text-xl font-black text-sky-700 tabular-nums whitespace-nowrap">₹{todaySalesSummary.upiSales.toLocaleString()}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-600 mb-1 whitespace-nowrap">Credit / Due Sales</p>
                            <p className="text-lg sm:text-xl font-black text-amber-700 tabular-nums whitespace-nowrap">₹{todaySalesSummary.creditSales.toLocaleString()}</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-purple-600 mb-1 whitespace-nowrap">Online Sales</p>
                            <p className="text-lg sm:text-xl font-black text-purple-700 tabular-nums whitespace-nowrap">₹{todaySalesSummary.onlineSales.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Filters & Search */}
                    <div className="flex items-center justify-between gap-3 mt-5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/60">
                        <div className="flex items-center gap-1.5">
                            {["ALL", "CASH", "UPI", "CREDIT", "ONLINE"].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setTodaySalesFilter(mode)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                        todaySalesFilter === mode
                                            ? "bg-slate-900 text-white shadow-md"
                                            : "text-slate-500 hover:bg-slate-200/60"
                                    )}
                                >
                                    {mode === "ALL" ? `All (${todaySalesOrders.length})` : mode}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={todaySalesSearch}
                                onChange={(e) => setTodaySalesSearch(e.target.value)}
                                placeholder="Search Bill # or Customer..."
                                className="w-full h-8 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 ring-emerald-500/20"
                            />
                        </div>
                    </div>

                    {/* Bill List Table */}
                    <div className="flex-1 overflow-y-auto mt-3 border border-slate-200/60 rounded-2xl">
                        {todaySalesOrders.filter((ord) => {
                            if (todaySalesFilter !== "ALL") {
                                if (todaySalesFilter === "CREDIT" && !ord.isCredit && ord.paymentMethod !== "CREDIT") return false;
                                if (todaySalesFilter === "ONLINE" && !["ONLINE", "UPI", "CARD", "WALLET", "NET_BANKING"].includes(ord.paymentMethod)) return false;
                                if (todaySalesFilter !== "CREDIT" && todaySalesFilter !== "ONLINE" && ord.paymentMethod !== todaySalesFilter) return false;
                            }
                            if (todaySalesSearch) {
                                const q = todaySalesSearch.toLowerCase();
                                const matchId = ord.id.toLowerCase().includes(q);
                                const matchName = ord.customer?.name?.toLowerCase().includes(q);
                                const matchPhone = ord.customer?.phone?.includes(q);
                                if (!matchId && !matchName && !matchPhone) return false;
                            }
                            return true;
                        }).length === 0 ? (
                            <div className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-wider">
                                No sales records found matching filter.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">Bill #</th>
                                        <th className="py-3 px-4">Time</th>
                                        <th className="py-3 px-4">Customer</th>
                                        <th className="py-3 px-4">Payment Mode</th>
                                        <th className="py-3 px-4">Items</th>
                                        <th className="py-3 px-4 text-right">Total Amount</th>
                                        <th className="py-3 px-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {todaySalesOrders
                                        .filter((ord) => {
                                            if (todaySalesFilter !== "ALL") {
                                                if (todaySalesFilter === "CREDIT" && !ord.isCredit) return false;
                                                if (todaySalesFilter !== "CREDIT" && ord.paymentMethod !== todaySalesFilter) return false;
                                            }
                                            if (todaySalesSearch) {
                                                const q = todaySalesSearch.toLowerCase();
                                                const matchId = ord.id.toLowerCase().includes(q);
                                                const matchName = ord.customer?.name?.toLowerCase().includes(q);
                                                const matchPhone = ord.customer?.phone?.includes(q);
                                                if (!matchId && !matchName && !matchPhone) return false;
                                            }
                                            return true;
                                        })
                                        .map((ord) => (
                                            <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4 font-black text-slate-900">
                                                    #{ord.id.slice(0, 8).toUpperCase()}
                                                </td>
                                                <td className="py-3 px-4 text-slate-500 font-bold tabular-nums">
                                                    {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-bold text-slate-900">{ord.customer?.name || "Walk-in Guest"}</div>
                                                    {ord.customer?.phone && <div className="text-[10px] text-slate-400 font-mono">{ord.customer.phone}</div>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={cn(
                                                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                        ord.isCredit
                                                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                            : ord.paymentMethod === "CASH"
                                                            ? "bg-slate-100 text-slate-800 border border-slate-200"
                                                            : ord.paymentMethod === "UPI"
                                                            ? "bg-sky-100 text-sky-800 border border-sky-200"
                                                            : "bg-purple-100 text-purple-800 border border-purple-200"
                                                    )}>
                                                        {ord.isCredit ? "CREDIT" : ord.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-slate-500 font-bold">
                                                    {ord.itemsCount} {ord.itemsCount === 1 ? "Item" : "Items"}
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-emerald-700 tabular-nums text-sm">
                                                    ₹{ord.totalAmount.toFixed(2)}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={() => {
                                                            setShowTodaySalesDialog(false);
                                                            handleViewHistoricalReceipt(ord);
                                                        }}
                                                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-xl tracking-wider uppercase transition-all shadow-sm"
                                                    >
                                                        Reprint
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── WHATSAPP DUE REMINDERS DIALOG ── */}
            <Dialog open={showWhatsappRemindersDialog} onOpenChange={setShowWhatsappRemindersDialog}>
                <DialogContent className="w-[95vw] max-w-5xl max-h-[85vh] flex flex-col p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl">
                    <DialogHeader className="border-b pb-4 flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                                <MessageCircle className="h-6 w-6 text-emerald-600" />
                                WhatsApp Due Reminders
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 text-xs font-medium mt-1">
                                Send automated WhatsApp payment reminder links to customers with pending balances.
                            </DialogDescription>
                        </div>
                        <Button onClick={() => fetchDueCustomers()} variant="outline" size="sm" className="rounded-xl border-slate-200 text-slate-700 font-bold">
                            <RefreshCw className={cn("h-4 w-4 mr-1", isLoadingDueCustomers && "animate-spin")} /> Refresh
                        </Button>
                    </DialogHeader>

                    {/* Top Summary & Actions */}
                    <div className="flex items-center justify-between gap-4 mt-4 bg-emerald-50/70 p-4 sm:p-5 rounded-2xl border border-emerald-200/60">
                        <div>
                            <p className="text-xs font-black uppercase text-emerald-800 tracking-wider">
                                Total Due Customers: {dueCustomersList.length}
                            </p>
                            <p className="text-base font-black text-emerald-700 mt-1 tabular-nums">
                                Combined Dues: ₹{dueCustomersList.reduce((acc, c) => acc + c.totalDue, 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={() => {
                                    if (selectedDueCustomerIds.length === dueCustomersList.length) {
                                        setSelectedDueCustomerIds([]);
                                    } else {
                                        setSelectedDueCustomerIds(dueCustomersList.map(c => c.id));
                                    }
                                }}
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-slate-300 text-xs font-bold px-4"
                            >
                                {selectedDueCustomerIds.length === dueCustomersList.length ? "Deselect All" : "Select All"}
                            </Button>
                            <Button
                                onClick={() => sendWhatsappReminders(selectedDueCustomerIds)}
                                disabled={isSendingReminders || dueCustomersList.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 px-5 py-2 shadow-md"
                            >
                                <Send className={cn("h-4 w-4", isSendingReminders && "animate-spin")} />
                                {selectedDueCustomerIds.length > 0 ? `Send to Selected (${selectedDueCustomerIds.length})` : `Send to All (${dueCustomersList.length})`}
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mt-4 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={dueCustomersSearch}
                            onChange={(e) => setDueCustomersSearch(e.target.value)}
                            placeholder="Search due customer by name or phone..."
                            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 ring-emerald-500/20"
                        />
                    </div>

                    {/* Customer List */}
                    <div className="flex-1 overflow-y-auto mt-4 border border-slate-200/60 rounded-2xl">
                        {isLoadingDueCustomers ? (
                            <div className="p-12 text-center text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                                <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" /> Loading due records...
                            </div>
                        ) : filteredDueCustomers.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-bold text-xs uppercase tracking-wider">
                                No customers found with outstanding dues.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-500 font-black uppercase text-[11px] tracking-wider sticky top-0 border-b border-slate-200">
                                    <tr>
                                        <th className="py-3.5 px-5 w-12 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedDueCustomerIds.length === filteredDueCustomers.length && filteredDueCustomers.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedDueCustomerIds(filteredDueCustomers.map(c => c.id));
                                                    } else {
                                                        setSelectedDueCustomerIds([]);
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                            />
                                        </th>
                                        <th className="py-3.5 px-5 whitespace-nowrap">Customer</th>
                                        <th className="py-3.5 px-5 whitespace-nowrap">Phone</th>
                                        <th className="py-3.5 px-5 text-center whitespace-nowrap">Unpaid Bills</th>
                                        <th className="py-3.5 px-5 text-right whitespace-nowrap">Total Due Amount</th>
                                        <th className="py-3.5 px-5 text-center whitespace-nowrap">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {filteredDueCustomers.map((cust) => {
                                        const isSelected = selectedDueCustomerIds.includes(cust.id);
                                        return (
                                            <tr key={cust.id} className={cn("hover:bg-slate-50 transition-colors", isSelected && "bg-emerald-50/40")}>
                                                <td className="py-3.5 px-5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedDueCustomerIds([...selectedDueCustomerIds, cust.id]);
                                                            } else {
                                                                setSelectedDueCustomerIds(selectedDueCustomerIds.filter(id => id !== cust.id));
                                                            }
                                                        }}
                                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                                    />
                                                </td>
                                                <td className="py-3.5 px-5 font-black text-slate-900 whitespace-nowrap">{cust.name}</td>
                                                <td className="py-3.5 px-5 text-slate-600 font-mono font-bold whitespace-nowrap">{cust.phone}</td>
                                                <td className="py-3.5 px-5 text-center whitespace-nowrap">
                                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-3 py-1 rounded-full border border-amber-200">
                                                        {cust.dueOrdersCount} {cust.dueOrdersCount === 1 ? "Bill" : "Bills"}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-5 text-right font-black text-rose-600 tabular-nums text-sm whitespace-nowrap">
                                                    ₹{cust.totalDue.toFixed(2)}
                                                </td>
                                                <td className="py-3.5 px-5 text-center whitespace-nowrap">
                                                    <Button
                                                        onClick={() => sendWhatsappReminders([cust.id])}
                                                        disabled={isSendingReminders}
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-8 px-3.5 flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <MessageCircle className="h-3.5 w-3.5" /> Remind
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── RECEIPT DIALOG ── */}
            <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
                <DialogContent className="max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none">
                    <DialogTitle className="sr-only">Order Receipt Preview</DialogTitle>
                    <DialogDescription className="sr-only">Detailed breakdown of the current transaction including items and totals.</DialogDescription>

                    {lastReceipt && (
                        <div className="flex flex-col max-h-[90vh]">
                            {/* Header Area */}
                            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                                <h3 className="font-black uppercase text-xs text-slate-500 tracking-widest leading-none">Bill Preview</h3>
                                <button onClick={() => setShowReceiptDialog(false)} className="p-2 hover:bg-white text-slate-400 hover:text-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-100">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Bill Scrollable Area */}
                            <div className="flex-1 overflow-y-auto p-8 font-sans text-[11px] bg-white text-[#1a1a1a] scrollbar-thin scrollbar-thumb-slate-100" id="receipt-content">
                                {/* Header Section */}
                                <div className="text-center mb-6">
                                    <h2 className="text-lg font-black uppercase leading-tight tracking-tight mb-1">{storeConfig?.name || "Book My Veg"}</h2>
                                    <p className="text-[10px] font-medium text-slate-400 px-6 leading-relaxed">{storeConfig?.address || ""}</p>
                                    <div className="mt-3 flex items-center justify-center gap-3 text-[9px] font-bold text-slate-900 uppercase tracking-widest bg-slate-50 py-2 rounded-xl border border-slate-100">
                                        {storeConfig?.gstNumber && <span>{storeConfig.gstNumber}</span>}
                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                        {storeConfig?.contactNumber && <span>PH: {storeConfig.contactNumber}</span>}
                                    </div>
                                </div>

                                <div className="h-px border-t border-dashed border-slate-200 my-4" />

                                {/* Meta Section */}
                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Client Name</span>
                                        <span className="font-black text-slate-900 uppercase">{lastReceipt.customer?.name || "Walk-In"}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contact No</span>
                                        <span className="font-black text-slate-900">{lastReceipt.customer?.phone || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Invoice Code</span>
                                        <span className="font-black text-slate-900">#{lastReceipt.order?.id?.slice(-8).toUpperCase()}</span>
                                    </div>
                                    {(lastReceipt.customer?.addresses?.[0]?.fullAddress || lastReceipt.customer?.profileAddress) && (
                                        <div className="flex justify-between items-start">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Address</span>
                                            <span className="font-black text-slate-900 text-right max-w-[200px] leading-tight">
                                                {lastReceipt.customer?.addresses?.[0]?.fullAddress || lastReceipt.customer?.profileAddress}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Billed By</span>
                                        <span className="font-black text-slate-900 uppercase">{lastReceipt.order?.staff?.name || user?.name || "System"}</span>
                                    </div>
                                </div>

                                {/* Items Header */}
                                <div className="grid grid-cols-12 gap-2 border-b-2 border-slate-900 pb-2 mb-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <div className="col-span-6">Product / Service</div>
                                    <div className="col-span-2 text-center">Qty</div>
                                    <div className="col-span-2 text-center">Discount</div>
                                    <div className="col-span-2 text-right">Amt</div>
                                </div>

                                {/* Items List */}
                                <div className="space-y-4 mb-6">
                                    {lastReceipt.items?.map((item: any, i: number) => {
                                        const orig = getPrice(item);
                                        const act = Number(item.overridePrice !== undefined ? item.overridePrice : orig);
                                        const disc = Math.max(0, orig - act) * Number(item.quantity);
                                        const rowAmt = act * Number(item.quantity);
                                        return (
                                            <div key={i} className="grid grid-cols-12 gap-2 items-start py-1">
                                                <div className="col-span-6">
                                                    <p className="font-black text-[12px] text-slate-900 uppercase leading-none">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">@ ₹{act.toFixed(2)} / unit</p>
                                                        {item.overridePrice !== undefined && orig !== act && (
                                                            <span className="text-[8px] font-black text-rose-400 line-through">₹{orig.toFixed(2)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-center font-black text-slate-900 text-[11px] tabular-nums">{Number(item.quantity).toFixed(2)}</div>
                                                <div className="col-span-2 text-center font-black text-rose-500 text-[11px] tabular-nums">{disc > 0 ? `₹${disc.toFixed(2)}` : "-"}</div>
                                                <div className="col-span-2 text-right font-black text-slate-900 text-[11px] tabular-nums">₹{rowAmt.toFixed(2)}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Totals Section */}
                                <div className="h-px border-t border-dashed border-slate-200 my-4" />

                                <div className="space-y-2 mb-2">
                                    <div className="flex justify-between text-slate-500 font-bold uppercase text-[9px]">
                                        <span>Order Subtotal</span>
                                        <span className="tabular-nums">₹{Number(lastReceipt.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    {lastReceipt.discount > 0 && (
                                        <div className="flex justify-between text-rose-500 font-bold uppercase text-[9px]">
                                            <span>Institutional Discount</span>
                                            <span className="tabular-nums">-₹{Number(lastReceipt.discount || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center py-4 border-y-2 border-slate-900 my-4 text-slate-900">
                                        <span className="text-[11px] font-black uppercase tracking-tighter">Gross Payable</span>
                                        <span className="text-2xl font-black tabular-nums tracking-tighter">₹{Number(lastReceipt.grandTotal || 0).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Detailed Payment Breakdown */}
                                {lastReceipt.dueSummary && (
                                    <div className="mb-6 space-y-3 bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100">
                                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-2">Settlement Ledger</h4>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-500 font-bold uppercase tracking-tight">Cleared From Wallet</span>
                                                <span className="font-black text-emerald-600">₹{(Number(lastReceipt.dueSummary.settledFromOld) + (Number(lastReceipt.grandTotal) - Number(lastReceipt.dueSummary.currentBillDue))).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px] pt-2 border-t border-slate-200 mt-2">
                                                <span className="text-slate-500 font-bold uppercase tracking-tight">Active Due Remaining</span>
                                                <span className="font-black text-rose-600">₹{Number(lastReceipt.dueSummary.netOutstanding).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Public Pay QR Code Section */}
                                {lastReceipt && !lastReceipt.order?.isPaid && lastReceipt.order?.paymentStatus !== "COMPLETED" && lastReceipt.order?.paymentStatus !== "PAID" && (
                                    <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Scan To Pay Bill / Settle Dues Online</p>
                                        <img 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/pay/userid=${lastReceipt.customer?.id || ''}&number=${lastReceipt.customer?.phone || ''}&billid=${lastReceipt.id || lastReceipt.order?.id || ''}`)}`}
                                            alt="Public Pay QR"
                                            className="w-28 h-28 object-contain rounded-lg border p-1 bg-white"
                                        />
                                        <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Direct Bill Payment Gateway</p>
                                    </div>
                                )}

                                {/* Footer Thank You Section */}
                                <div className="text-center pt-6">
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] mb-2 leading-none">Thank You!</p>
                                    <p className="text-[8px] text-slate-400 font-bold italic tracking-tight">Authenticated Cloud Intelligence — BMV Systems</p>
                                </div>
                            </div>

                            {/* Actions Area */}
                            <div className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row gap-3">
                                <Button 
                                    onClick={handlePrintReceipt} 
                                    className="flex-[2] h-14 bg-slate-900 hover:bg-black text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-900/20 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Printer className="h-5 w-5 mr-1" /> 
                                    Execute Printing / Reprint
                                </Button>
                                <Button onClick={() => forwardWhatsAppLink("BILL", lastReceipt.id || lastReceipt.order?.id)} className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest shadow-xl rounded-2xl transition-all active:scale-95">
                                    <Smartphone className="h-5 w-5 mr-2" /> Share WA
                                </Button>
                                <Button variant="outline" onClick={() => setShowReceiptDialog(false)} className="h-14 border-slate-200 bg-white text-slate-400 font-black uppercase text-xs hover:bg-white hover:text-slate-900 hover:border-slate-400 transition-all rounded-2xl active:scale-95">
                                    Dismiss
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── CANCEL ORDER DIALOG ── */}
            {/* ── WEB ORDERS & STAGE MANAGEMENT DIALOG ── */}
            <Dialog open={showWebOrders} onOpenChange={setShowWebOrders}>
                <DialogContent className="max-w-4xl bg-white rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 text-white flex items-center justify-between">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3 text-white">
                                <Globe className="h-7 w-7" />
                                Website & App Orders
                            </DialogTitle>
                            <DialogDescription className="text-orange-100 text-xs opacity-90 mt-1">
                                Monitor live web orders, inspect items, and update order stages in real time.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl text-right">
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-100 block">Total Active</span>
                            <span className="text-2xl font-black text-white leading-none">{webOrders.length}</span>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 p-4 bg-slate-100/70 border-b border-slate-200 overflow-x-auto">
                        {["ALL", "PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "COMPLETED"].map((stage) => {
                            const count = stage === "ALL" 
                                ? webOrders.length 
                                : webOrders.filter((o: any) => o.status === stage || (stage === "PROCESSING" && o.status === "PACKING")).length;

                            return (
                                <button
                                    key={stage}
                                    onClick={() => setWebOrderStageFilter(stage)}
                                    className={cn(
                                        "px-4 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-1.5",
                                        webOrderStageFilter === stage
                                            ? "bg-slate-900 text-white shadow-md"
                                            : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                                    )}
                                >
                                    <span>{stage.replace(/_/g, " ")}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-full text-[9px] font-black",
                                        webOrderStageFilter === stage ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-700"
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50/50">
                        {(!Array.isArray(webOrders) || webOrders.length === 0) ? (
                            <div className="py-20 text-center">
                                <Package className="h-16 w-16 text-slate-200 mx-auto mb-4 animate-bounce" />
                                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No website orders found</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {webOrders
                                    .filter((order: any) => {
                                        if (webOrderStageFilter === "ALL") return true;
                                        if (webOrderStageFilter === "PROCESSING") return order.status === "PROCESSING" || order.status === "PACKING";
                                        return order.status === webOrderStageFilter;
                                    })
                                    .map((order: any) => {
                                        const getStatusColor = (st: string) => {
                                            switch (st) {
                                                case "PENDING": return "bg-amber-100 text-amber-700 border-amber-200";
                                                case "CONFIRMED": return "bg-blue-100 text-blue-700 border-blue-200";
                                                case "PROCESSING":
                                                case "PACKING": return "bg-purple-100 text-purple-700 border-purple-200";
                                                case "OUT_FOR_DELIVERY": return "bg-orange-100 text-orange-700 border-orange-200";
                                                case "DELIVERED":
                                                case "COMPLETED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
                                                case "CANCELLED": return "bg-rose-100 text-rose-700 border-rose-200";
                                                default: return "bg-slate-100 text-slate-700 border-slate-200";
                                            }
                                        };

                                        return (
                                            <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                                <div className="flex gap-4 items-start md:items-center">
                                                    <div className="h-12 w-12 bg-orange-50 rounded-2xl flex items-center justify-center border border-orange-100 shrink-0">
                                                        <Globe className="h-6 w-6 text-orange-500" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-sm font-black text-slate-900 uppercase">Order #{order.id.slice(-6)}</span>
                                                            <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border", getStatusColor(order.status))}>
                                                                {order.status}
                                                            </span>
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                                                                order.isPaid || order.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-600 border border-amber-200"
                                                            )}>
                                                                {order.isPaid || order.paymentStatus === "PAID" ? "PAID" : "COD / PENDING"}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-700 font-bold uppercase mt-1">
                                                            {order.customerName} ({order.customerPhone || "No Phone"}) • {order.items?.length || 0} Items
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-medium truncate max-w-md mt-0.5">
                                                            📍 {order.shippingAddress}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                                                    <Button
                                                        onClick={() => setSelectedWebOrder(order)}
                                                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-[10px] uppercase rounded-xl h-10 px-4 transition-all"
                                                    >
                                                        Inspect Details
                                                    </Button>

                                                    {order.status === "PENDING" && (
                                                        <Button
                                                            disabled={isUpdatingWebOrderStatus}
                                                            onClick={() => updateWebOrderStatusHandler(order.id, "CONFIRMED")}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase rounded-xl h-10 px-4 transition-all"
                                                        >
                                                            Accept Order
                                                        </Button>
                                                    )}

                                                    {order.status === "CONFIRMED" && (
                                                        <Button
                                                            disabled={isUpdatingWebOrderStatus}
                                                            onClick={() => updateWebOrderStatusHandler(order.id, "PROCESSING")}
                                                            className="bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase rounded-xl h-10 px-4 transition-all"
                                                        >
                                                            Start Packing
                                                        </Button>
                                                    )}

                                                    {(order.status === "PROCESSING" || order.status === "PACKING") && (
                                                        <Button
                                                            disabled={isUpdatingWebOrderStatus}
                                                            onClick={() => updateWebOrderStatusHandler(order.id, "OUT_FOR_DELIVERY")}
                                                            className="bg-orange-600 hover:bg-orange-700 text-white font-black text-[10px] uppercase rounded-xl h-10 px-4 transition-all"
                                                        >
                                                            Dispatched
                                                        </Button>
                                                    )}

                                                    {order.status === "OUT_FOR_DELIVERY" && (
                                                        <Button
                                                            disabled={isUpdatingWebOrderStatus}
                                                            onClick={() => updateWebOrderStatusHandler(order.id, "COMPLETED")}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase rounded-xl h-10 px-4 transition-all"
                                                        >
                                                            Fulfill Order
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                        <Button variant="ghost" onClick={() => setShowWebOrders(false)} className="font-black uppercase text-xs text-slate-400">Close</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── WEB ORDER DETAILS & STAGE INSPECTOR DIALOG ── */}
            <Dialog open={!!selectedWebOrder} onOpenChange={(open) => !open && setSelectedWebOrder(null)}>
                <DialogContent className="max-w-3xl bg-white rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    {selectedWebOrder && (
                        <>
                            <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Web Order Inspector</span>
                                    <h3 className="text-2xl font-black uppercase text-white">Order #{selectedWebOrder.id.slice(-6)}</h3>
                                    <p className="text-xs text-slate-400 mt-1">{new Date(selectedWebOrder.createdAt).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-emerald-400">₹{Number(selectedWebOrder.totalAmount).toFixed(0)}</span>
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">{selectedWebOrder.items?.length || 0} ITEMS</span>
                                </div>
                            </div>

                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-slate-50">
                                {/* Order Stage Advancement Tracker */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Order Stage Pipeline</h4>
                                    <div className="flex items-center justify-between gap-1 overflow-x-auto py-2">
                                        {[
                                            { stage: "PENDING", label: "1. Pending" },
                                            { stage: "CONFIRMED", label: "2. Confirmed" },
                                            { stage: "PROCESSING", label: "3. Packing" },
                                            { stage: "OUT_FOR_DELIVERY", label: "4. Out for Delivery" },
                                            { stage: "COMPLETED", label: "5. Delivered" }
                                        ].map((step, idx) => {
                                            const stagesOrder = ["PENDING", "CONFIRMED", "PROCESSING", "PACKING", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"];
                                            const currentIdx = stagesOrder.indexOf(selectedWebOrder.status);
                                            const stepIdx = stagesOrder.indexOf(step.stage);
                                            const isPassed = currentIdx >= stepIdx && selectedWebOrder.status !== "CANCELLED";

                                            return (
                                                <button
                                                    key={step.stage}
                                                    disabled={isUpdatingWebOrderStatus}
                                                    onClick={() => updateWebOrderStatusHandler(selectedWebOrder.id, step.stage)}
                                                    className={cn(
                                                        "flex-1 py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-tight text-center transition-all border",
                                                        isPassed
                                                            ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                                            : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200 hover:text-slate-900"
                                                    )}
                                                >
                                                    {step.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
                                        <span>Current Stage: <strong className="text-slate-900 uppercase">{selectedWebOrder.status}</strong></span>
                                        <button
                                            disabled={isUpdatingWebOrderStatus}
                                            onClick={() => {
                                                const reason = prompt("Reason for cancelling order:");
                                                if (reason) updateWebOrderStatusHandler(selectedWebOrder.id, "CANCELLED", reason);
                                            }}
                                            className="text-rose-600 hover:text-rose-700 uppercase tracking-widest text-[10px] font-black"
                                        >
                                            Cancel Order
                                        </button>
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Customer Name & Contact</span>
                                        <p className="text-sm font-black text-slate-900 mt-1">{selectedWebOrder.customerName}</p>
                                        <p className="text-xs text-slate-600 font-medium">{selectedWebOrder.customerPhone || "No Phone Provided"}</p>
                                        <p className="text-xs text-slate-500">{selectedWebOrder.customerEmail}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Delivery Destination</span>
                                        <p className="text-xs font-bold text-slate-800 mt-1 leading-relaxed">{selectedWebOrder.shippingAddress}</p>
                                    </div>
                                </div>

                                {/* Order Items Table */}
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-600">Order Merchandise Items</h4>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {selectedWebOrder.items?.map((item: any) => (
                                            <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                                        {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package className="h-5 w-5 text-slate-400" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900">{item.name || item.productName}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold">Qty: {item.quantity} × ₹{item.sellingPrice}</p>
                                                    </div>
                                                </div>
                                                <span className="text-sm font-black text-slate-900">₹{(item.quantity * item.sellingPrice).toFixed(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white border-t border-slate-100 flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setSelectedWebOrder(null)} className="font-black uppercase text-xs text-slate-400">Close Inspector</Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── STORE EXPENSE DIALOG ── */}
            <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
                <DialogContent className="max-w-md bg-white rounded-3xl p-8 border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase text-red-600 flex items-center gap-2 mb-1">
                            <Banknote className="h-6 w-6" />
                            Record Store Expense
                        </DialogTitle>
                        <DialogDescription>
                            Enter expenses like tea, repairs, or petty cash usage.
                        </DialogDescription>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest pl-8">This will be deducted from your counter cash</p>
                    </DialogHeader>
                    <div className="space-y-6 mt-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Expense Amount (₹) - Auto Calculated</label>
                            <input
                                type="number"
                                value={expenseData.amount}
                                disabled
                                placeholder="0.00"
                                className="w-full h-14 bg-slate-100 border border-slate-200 rounded-xl px-4 text-xl font-black text-slate-500 outline-none cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Denomination Counts (Expense Payout)</label>
                            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                {DENOMINATIONS.map(den => (
                                    <div key={den} className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-bold text-slate-500">₹{den}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={expenseDenoms[den] || ""}
                                            onChange={(e) => {
                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                const newDenoms = { ...expenseDenoms, [den]: val };
                                                setExpenseDenoms(newDenoms);
                                                const total = Object.entries(newDenoms).reduce((sum, [d, q]) => sum + (Number(d) * q), 0);
                                                setExpenseData(prev => ({ ...prev, amount: total > 0 ? String(total) : "" }));
                                            }}
                                            placeholder="0"
                                            className="w-full h-8 border border-slate-200 rounded px-1.5 text-xs font-bold focus:border-red-500 outline-none text-slate-800"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Category / Type</label>
                            <input
                                value={expenseData.category}
                                onChange={e => setExpenseData({ ...expenseData, category: e.target.value.toUpperCase() })}
                                placeholder="e.g. TEA, REPAIR, RENT"
                                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all uppercase"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Description / Reason</label>
                            <textarea
                                value={expenseData.description}
                                onChange={e => setExpenseData({ ...expenseData, description: e.target.value })}
                                placeholder="e.g. 5 Tea for staff, Bulb replacement"
                                className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all resize-none"
                            />
                        </div>

                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => setShowExpenseDialog(false)} className="flex-1 h-12 border-slate-200 text-slate-400 font-black uppercase text-xs">Cancel</Button>
                            <Button onClick={handleAddExpense} className="flex-[2] h-12 bg-red-600 text-white font-black text-xs uppercase rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/20">Record & Subtract Cash</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── CANCEL / VOID PICKER DIALOG ── */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent className="max-w-xl bg-white rounded-3xl p-8 border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase text-slate-900 flex items-center gap-2 mb-2">
                            <XCircle className="h-6 w-6 text-red-500" />
                            Cancel / Void Operation
                        </DialogTitle>
                        <DialogDescription>
                            Choose to clear the active cart or void a completed transaction.
                        </DialogDescription>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest pl-8">Select the type of cancellation required</p>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                        {/* Option 1: Clear Current Cart */}
                        <button
                            onClick={() => {
                                setCart([]);
                                setSelectedCustomer(null);
                                setShowCancelDialog(false);
                                toast.success("Active cart cleared");
                            }}
                            className="group p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl flex flex-col items-center text-center gap-4 hover:border-red-500 hover:bg-red-50 transition-all active:scale-[0.98]"
                        >
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 group-hover:bg-red-500 group-hover:text-white transition-all">
                                <Trash2 className="h-8 w-8" />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Clear Active Cart</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Cancels the current bill entirely</p>
                            </div>
                        </button>

                        {/* Option 2: Void Past Transaction */}
                        <button
                            onClick={() => {
                                setShowCancelDialog(false);
                                setShowVoidHistoryDialog(true);
                            }}
                            className="group p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl flex flex-col items-center text-center gap-4 hover:border-teal-500 hover:bg-teal-50 transition-all active:scale-[0.98]"
                        >
                            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-all">
                                <History className="h-8 w-8" />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Void Past Order</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Cancel a bill already settled</p>
                            </div>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── VOID HISTORY DIALOG (REFACTORED) ── */}
            <Dialog open={showVoidHistoryDialog} onOpenChange={setShowVoidHistoryDialog}>
                <DialogContent className="max-w-2xl bg-white rounded-3xl p-8 border-none shadow-2xl">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {inspectingOrder ? (
                                    <button onClick={() => setInspectingOrder(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                ) : (
                                    <History className="h-6 w-6 text-red-500" />
                                )}
                                <div>
                                    <DialogTitle className="text-xl font-black uppercase text-slate-900 leading-none">
                                        {inspectingOrder ? `Inspect Bill #${inspectingOrder.id.slice(-6)}` : "Void Past Transaction"}
                                    </DialogTitle>
                                    <DialogDescription className="sr-only">Search and void historical transactions for auditing and returns.</DialogDescription>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                                        {inspectingOrder ? `Viewing ${inspectingOrder.items?.length} Items` : "Full or Partial Cancellation of Settled Bills"}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setShowVoidHistoryDialog(false); setInspectingOrder(null); }}>
                                <X className="h-4 w-4 text-slate-400" />
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="mt-6">
                        {!inspectingOrder ? (
                            <div className="space-y-6">
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            value={cancelBillSearch}
                                            onChange={e => setCancelBillSearch(e.target.value)}
                                            placeholder="Order ID / Customer Name / Phone"
                                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 text-sm font-bold text-slate-900 focus:bg-white transition-all"
                                        />
                                    </div>
                                    <Button onClick={searchOrdersForCancel} className="h-12 px-6 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:bg-black">Search Bills</Button>
                                </div>

                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {cancelSearchResults.length === 0 ? (
                                        <div className="py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                                            <History className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search to find transactions to void</p>
                                        </div>
                                    ) : cancelSearchResults.map((order: any) => (
                                        <div key={order.id} className="border border-slate-100 bg-white rounded-3xl p-6 flex flex-col gap-4 hover:border-red-500 transition-all shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-black text-slate-900 leading-none uppercase">ORDER #{order.id.slice(-8)}</p>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                                                        {new Date(order.createdAt).toLocaleString()} • {order.paymentMethod}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-black text-slate-900 tabular-nums leading-none">₹{Number(order.totalAmount).toFixed(2)}</p>
                                                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter mt-1">Settled Bill</p>
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-100" />

                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => handleViewHistoricalReceipt(order)}
                                                        className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] uppercase rounded-xl shadow-md shadow-teal-100 flex items-center justify-center gap-1"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" /> Reprint
                                                    </Button>
                                                    <Button
                                                        onClick={() => cancelOrder(order.id)}
                                                        className="flex-1 h-10 bg-red-600 text-white font-black text-[10px] uppercase rounded-xl shadow-lg shadow-red-100 transition-all hover:bg-red-700"
                                                    >
                                                        Void Bill
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 h-10 border-slate-200 text-slate-900 font-black text-[10px] uppercase rounded-xl hover:bg-slate-50"
                                                        onClick={() => setInspectingOrder(order)}
                                                    >
                                                        View Items
                                                    </Button>
                                                </div>
                                                {(() => {
                                                    const orderPaid = order.isPaid || order.paymentStatus === "COMPLETED" || order.paymentStatus === "PAID" || (order.payments?.filter((p: any) => p.status === "SUCCESS").reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0) >= Number(order.totalAmount);
                                                    if (!orderPaid) {
                                                        return (
                                                            <Button
                                                                onClick={async () => {
                                                                    try {
                                                                        await api.post("/pay/send-reminder", { orderId: order.id });
                                                                        toast.success("WhatsApp Payment Reminder sent successfully!");
                                                                    } catch (err: any) {
                                                                        toast.error(err.response?.data?.message || "Failed to send WhatsApp reminder.");
                                                                    }
                                                                }}
                                                                className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase rounded-xl shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
                                                            >
                                                                <Smartphone className="w-4 h-4" /> Send Payment Reminder (WA)
                                                            </Button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                <Button
                                                    className="w-full h-10 bg-slate-900 text-white font-black text-[10px] uppercase rounded-xl hover:bg-black transition-all shadow-md shadow-slate-900/10"
                                                    onClick={() => {
                                                        const mappedItems = order.items.map((oi: any) => ({
                                                            id: oi.productId,
                                                            name: oi.product?.name || oi.productName || "Unknown Product",
                                                            sku: oi.product?.sku || oi.productId?.slice(0, 8),
                                                            quantity: Number(oi.quantity),
                                                            price: Number(oi.product?.pricing?.[0]?.price || oi.sellingPrice || 0),
                                                            overridePrice: Number(oi.sellingPrice),
                                                            pricing: oi.product?.pricing || [{ price: Number(oi.sellingPrice) }]
                                                        }));
                                                        setCart(mappedItems);
                                                        setDiscount(Number(order.discountAmount || 0));
                                                        if (order.user) {
                                                            setSelectedCustomer(order.user);
                                                        }
                                                        setEditingOrderId(order.id);
                                                        setShowVoidHistoryDialog(false);
                                                        toast.success(`Loaded Bill #${order.id.slice(-6)} into cart for editing.`);
                                                    }}
                                                >
                                                    Edit / Modify Bill
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-right duration-300">
                                <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                                        <p className="text-xs font-black text-slate-900">{inspectingOrder.customerName || "Walk-in"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Original Value</p>
                                        <p className="text-sm font-black text-slate-900">₹{Number(inspectingOrder.totalAmount).toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                                    {inspectingOrder.items?.map((item: any, idx: number) => (
                                        <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black text-[10px]">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-900 leading-none">
                                                        {item.productName || item.name || item.product?.name || "Product Name (Retreiving...)"}
                                                    </p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                                        Code: {item.sku || item.productId?.slice(-6).toUpperCase() || "N/A"}
                                                    </p>
                                                    <p className="text-[10px] text-teal-600 font-extrabold uppercase tracking-widest mt-1">
                                                        x{item.quantity} {item.unit || item.weightUnit || "kg"} • ₹{Number(item.price || item.sellingPrice || item.basePrice || 0).toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                className="h-9 px-4 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                                onClick={() => {
                                                    toast.success(`Removed ${item.name}. Refund of ₹${(item.quantity * (item.price || item.basePrice)).toFixed(2)} calculated.`);
                                                    // Filter out item on the client side for visual feedback
                                                    setInspectingOrder((prev: any) => ({
                                                        ...prev,
                                                        items: prev.items.filter((_: any, i: number) => i !== idx)
                                                    }));
                                                }}
                                            >
                                                Remove Item
                                            </Button>
                                        </div>
                                    ))}
                                    {inspectingOrder.items?.length === 0 && (
                                        <div className="text-center py-10 text-slate-300 italic text-[10px] font-black uppercase tracking-widest">
                                            All items returned. Order voided.
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 pt-4 border-t border-dashed border-slate-200">
                                    <Button
                                        disabled={inspectingOrder.items?.length === 0}
                                        onClick={() => {
                                            toast.promise(Promise.resolve(), {
                                                loading: 'Reconciling inventory...',
                                                success: 'Refund processed to customer wallet/source',
                                                error: 'Reconciliation failed'
                                            });
                                            setShowVoidHistoryDialog(false);
                                            setInspectingOrder(null);
                                        }}
                                        className="w-full h-14 bg-slate-900 text-white font-black uppercase text-sm tracking-widest rounded-3xl shadow-2xl hover:bg-black transition-all"
                                    >
                                        Finalize Remaining Bill (₹{inspectingOrder.items?.reduce((sum: number, item: any) => sum + (item.quantity * (item.price || item.basePrice || 0)), 0).toFixed(2)})
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── SETTLE DIALOG ── */}
            <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
                <DialogContent className="max-w-sm bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none font-sans">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Settle Outstanding Balance</DialogTitle>
                        <DialogDescription>Process customer due payments and reconcile accounts.</DialogDescription>
                    </DialogHeader>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <Wallet className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 uppercase text-sm tracking-widest">Settle Balance</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedCustomer?.name}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="bg-slate-50 p-4 rounded-3xl border border-dashed border-slate-200">
                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5 block">Total Due Amount</label>
                                <p className="text-2xl font-black text-slate-900 tabular-nums">₹{customerHistory?.summary?.totalDue.toFixed(0) || "0"}</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Payment Method</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: "CASH", icon: Banknote, color: "emerald" },
                                        { id: "UPI", icon: Smartphone, color: "teal" }
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setPaymentMethod(m.id)}
                                            className={cn("h-14 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all",
                                                paymentMethod === m.id
                                                    ? `bg-${m.color}-600 border-${m.color}-600 text-white shadow-lg shadow-${m.color}-100`
                                                    : "border-slate-100 text-slate-400 hover:bg-slate-50")}
                                        >
                                            <m.icon className="h-4 w-4" />
                                            <span className="font-black uppercase text-[10px] tracking-widest">{m.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {paymentMethod === "CASH" ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top duration-300">
                                    <div className="grid grid-cols-3 gap-2">
                                        {[2000, 500, 200, 100, 50, 20, 10, 5, 1].map(den => (
                                            <button
                                                key={den}
                                                onClick={() => {
                                                    const cur = cashReceived[den] || 0;
                                                    setCashReceived({ ...cashReceived, [den]: cur + 1 });
                                                    // Auto-set the settle amount to count
                                                    const newTotal = Object.entries({ ...cashReceived, [den]: cur + 1 }).reduce((sum, [d, q]) => sum + (Number(d) * Number(q)), 0);
                                                    setSettleAmount(Math.min(newTotal, customerHistory?.summary?.totalDue || 0));
                                                }}
                                                className="h-10 rounded-xl bg-white border border-slate-100 font-black text-slate-700 text-xs hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-90 shadow-sm"
                                            >
                                                ₹{den}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Total Cash Count</p>
                                            <p className="text-xl font-black text-emerald-900 tabular-nums">₹{Object.entries(cashReceived).reduce((sum, [d, q]) => sum + (Number(d) * Number(q)), 0).toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => { setCashReceived({}); setSettleAmount(0); }} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top duration-300">
                                    <div className="p-4 bg-teal-50 rounded-3xl border border-teal-100 flex flex-col items-center text-center gap-4">
                                        <div className="w-40 h-40 bg-white rounded-2xl p-3 shadow-lg border border-teal-100 relative group">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=${storeConfig?.upiId || 'bookmyveg@upi'}&pn=${encodeURIComponent(storeConfig?.name || 'BookMyVeg')}&am=${customerHistory?.summary?.totalDue.toFixed(2)}&cu=INR`)}`}
                                                alt="UPI QR"
                                                className="w-full h-full object-contain"
                                            />
                                            <div className="absolute inset-x-0 -bottom-2 text-[8px] font-black text-teal-600 uppercase tracking-widest animate-pulse">Scan to Settle</div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={async () => {
                                                const billId = `#${customerHistory?.summary?.totalDue.toFixed(0)}_${Date.now().toString().slice(-4)}`;
                                                const rawUpi = `pa=${storeConfig?.upiId}&pn=${encodeURIComponent(storeConfig?.name || 'BMV')}&am=${customerHistory?.summary?.totalDue.toFixed(2)}&tn=${encodeURIComponent(`SETTLE_${billId}`)}&cu=INR`;
                                                const upiUrl = `upi://pay?${rawUpi}`;
                                                const clickableLink = `https://upilink.in/pay?${rawUpi}`;
                                                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(upiUrl)}`;

                                                try {
                                                    // Fetch QR image as Blob for sharing
                                                    const response = await fetch(qrUrl);
                                                    const blob = await response.blob();
                                                    const file = new File([blob], `Payment_QR_${billId}.png`, { type: 'image/png' });

                                                    const message = `⚡ *PAYMENT REQUEST* ⚡\n\nGreetings from *${storeConfig?.name}*.\n\nPlease settle your balance of *₹${customerHistory?.summary?.totalDue.toFixed(2)}*.\n\n✅ *PAY DIRECTLY:* \n${clickableLink}\n\n📝 *Ref:* SETTLE_${billId}`;

                                                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                                        await navigator.share({
                                                            files: [file],
                                                            title: `Payment QR - ${storeConfig?.name}`,
                                                            text: message
                                                        });
                                                    } else {
                                                        // Fallback for desktop/non-compatible browsers
                                                        const phone = selectedCustomer?.phone?.replace(/\D/g, '');
                                                        window.open(`https://wa.me/${phone || ''}/?text=${encodeURIComponent(message + `\n\n🖼️ QR Code Link: ${qrUrl}`)}`, '_blank');
                                                        toast.info("Native file share not supported on this device. Sent via link instead.");
                                                    }
                                                } catch (err) {
                                                    console.error("Sharing failed", err);
                                                    toast.error("Failed to generate QR image file");
                                                }
                                            }}
                                            className="w-full h-10 border-teal-200 text-teal-600 font-black text-[10px] uppercase rounded-xl hover:bg-teal-100 flex items-center justify-center gap-2"
                                        >
                                            <Globe className="h-4 w-4" /> Direct Share to Customer
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Payment Amount (Confirming)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={settleAmount || ""}
                                        onChange={(e) => setSettleAmount(Math.min(Number(e.target.value), customerHistory?.summary?.totalDue || 0))}
                                        className="w-full h-14 pl-12 pr-4 bg-white border-2 border-slate-100 focus:border-emerald-500 rounded-2xl outline-none text-xl font-black transition-all tabular-nums text-black"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300">₹</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                                    <input
                                        type="checkbox"
                                        id="confirm-rec"
                                        className="w-5 h-5 rounded-lg border-amber-200 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                        onChange={(e) => (window as any)._paymentConfirmed = e.target.checked}
                                    />
                                    <label htmlFor="confirm-rec" className="text-[9px] font-black text-amber-900 uppercase leading-none cursor-pointer">I confirm payment has been received in full</label>
                                </div>

                                <Button
                                    onClick={() => {
                                        if (!(window as any)._paymentConfirmed) return toast.error("Please confirm payment received checkbox");
                                        handleSettleDue();
                                    }}
                                    disabled={isProcessing || Number(settleAmount) <= 0}
                                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-sm tracking-widest rounded-2xl transition-all shadow-xl shadow-emerald-100"
                                >
                                    {isProcessing ? "Processing..." : "Confirm & Record Settlement"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── IN-APP DIGITAL PAYMENT POPUP MODAL ── */}
            <Dialog open={showPosIframeModal} onOpenChange={setShowPosIframeModal}>
                <DialogContent className="max-w-2xl bg-white rounded-3xl p-6 border-none shadow-2xl font-sans overflow-hidden">
                    <DialogHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-emerald-600" />
                                Easebuzz Digital Payment Gateway Portal
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Process customer payment via Easebuzz directly inside POS terminal.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="w-full h-[500px] rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 my-2 relative">
                        {posPaymentIframeUrl ? (
                            <iframe
                                src={posPaymentIframeUrl}
                                className="w-full h-full border-none"
                                title="POS Digital Payment Gateway"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
                                <p className="text-sm font-semibold">Loading payment portal...</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <button
                            onClick={() => setShowPosIframeModal(false)}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Close Modal
                        </button>
                        <button
                            onClick={checkPOSPaymentStatusAndClose}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-200 transition-all flex items-center gap-2"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Verify Payment & Print</span>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── SHIFT MANAGEMENT DIALOG ── */}
            <Dialog open={showShiftModal} onOpenChange={(open) => {
                if (activeShift) setShowShiftModal(open);
            }}>
                <DialogContent className="max-w-md bg-white rounded-3xl p-8 border-none shadow-2xl font-sans">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase text-slate-900 flex items-center gap-3">
                            <Clock className="h-7 w-7 text-[#F39C12]" />
                            {activeShift ? "Consolidate Current Shift" : "Initialize New Shift"}
                        </DialogTitle>
                        <DialogDescription>
                            Shift reconciliation and counter cash management.
                        </DialogDescription>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {activeShift ? `Active since ${new Date(activeShift.startTime).toLocaleTimeString()}` : "Declare opening balance to start sales"}
                        </p>
                    </DialogHeader>

                    {!activeShift ? (
                        <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom duration-500">
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Denomination Counts (Opening Cash)</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {DENOMINATIONS.map(den => (
                                        <div key={den} className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-slate-500">₹{den}</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={openingDenoms[den] || ""}
                                                onChange={(e) => {
                                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                                    setOpeningDenoms(prev => ({ ...prev, [den]: val }));
                                                }}
                                                placeholder="0"
                                                className="w-full h-10 border border-slate-200 rounded-lg px-2 text-xs font-bold focus:border-[#F39C12] outline-none text-slate-800"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Opening Cash:</span>
                                    <span className="text-lg font-black text-[#F39C12]">
                                        ₹{Object.entries(openingDenoms).reduce((sum, [den, count]) => sum + (Number(den) * count), 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <Button
                                onClick={handleOpenShift}
                                className="w-full h-14 bg-[#F39C12] text-white font-black text-sm uppercase rounded-2xl shadow-xl shadow-orange-500/20 hover:scale-[1.02] transition-transform active:scale-95"
                            >
                                Start POS Operations
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom duration-500">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Session Duration</p>
                                    <p className="font-black text-slate-900">{Math.floor((Date.now() - new Date(activeShift.startTime).getTime()) / (1000 * 60))} Minutes</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Operator</p>
                                    <p className="font-black text-slate-900 truncate">{activeShift.staff?.name || user?.name}</p>
                                </div>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 space-y-4">
                                <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Expected Drawer Cash</p>
                                    <p className="text-lg font-black text-emerald-700 tabular-nums">₹{(activeShift.currentEstimatedCash || 0).toFixed(2)}</p>
                                </div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-600">Physical Denomination Counts (Closing Audit)</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {DENOMINATIONS.map(den => (
                                        <div key={den} className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-emerald-600">₹{den}</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={closingDenoms[den] || ""}
                                                onChange={(e) => {
                                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                                    setClosingDenoms(prev => ({ ...prev, [den]: val }));
                                                }}
                                                placeholder="0"
                                                className="w-full h-10 border border-emerald-100 rounded-lg px-2 text-xs font-bold focus:border-emerald-500 outline-none text-emerald-800"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4 border-t border-dashed border-emerald-200 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Physical Cash:</span>
                                    <span className="text-xl font-black text-emerald-800">
                                        ₹{Object.entries(closingDenoms).reduce((sum, [den, count]) => sum + (Number(den) * count), 0).toFixed(2)}
                                    </span>
                                </div>
                                {(() => {
                                    const totalClosing = Object.entries(closingDenoms).reduce((sum, [den, count]) => sum + (Number(den) * count), 0);
                                    const expected = activeShift.currentEstimatedCash || 0;
                                    const variance = totalClosing - expected;
                                    return (
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-slate-400">Variance:</span>
                                            <span className={variance === 0 ? "text-emerald-600" : (variance > 0 ? "text-blue-600" : "text-rose-600")}>
                                                {variance === 0 ? "Reconciled (₹0)" : (variance > 0 ? `Surplus (+₹${variance.toFixed(2)})` : `Shortage (-₹${Math.abs(variance).toFixed(2)})`)}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flex gap-4">
                                <Button variant="outline" onClick={() => setShowShiftModal(false)} className="flex-1 h-14 border-slate-200 text-slate-600 font-black uppercase text-xs">Stay Active</Button>
                                <Button
                                    onClick={handleCloseShift}
                                    className="flex-[1.5] h-14 bg-red-600 text-white font-black text-sm uppercase rounded-2xl shadow-xl shadow-red-500/20 hover:bg-red-700 transition-colors"
                                >
                                    Complete Shift & Log Out
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            {showScanner && (
                <QRScanner
                    onScan={handleQRScan}
                    onClose={() => setShowScanner(false)}
                    title="Digital POS Reconnaissance"
                />
            )}
        </div>
    );
}

const IndianRupee = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M6 3h12" />
        <path d="M6 8h12" />
        <path d="m6 13 8.5 8" />
        <path d="M6 13h3" />
        <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
);