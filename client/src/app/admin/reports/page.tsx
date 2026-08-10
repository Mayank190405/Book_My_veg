"use client";

import { 
    TrendingUp, 
    Calendar, 
    Filter, 
    Download, 
    Search,
    Store,
    CreditCard,
    Banknote,
    Truck,
    Globe,
    ChevronDown,
    ArrowUpRight,
    ArrowDownRight,
    MoreVertical,
    FileText,
    Activity,
    Clock
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { toast } from "sonner";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { jsPDF } from "jspdf";
import { initSocket } from "@/services/socketService";

export default function SalesReports() {
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const [orders, setOrders] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [stores, setStores] = useState<any[]>([]);
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

    // Filter Stats — Default to Current Day (Today) for real-time daily generation
    const [filters, setFilters] = useState({
        locationId: "",
        startDate: todayStr,
        endDate: todayStr,
        channel: "",
        paymentMethod: "",
        isCredit: ""
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });

            const [reportRes, storesRes] = await Promise.all([
                api.get(`/dashboard/reports?${queryParams.toString()}`),
                api.get("/locations")
            ]);

            setOrders(reportRes.data.orders);
            setSummary(reportRes.data.summary);
            setStores(storesRes.data);
            setLastRefreshedAt(new Date());
        } catch (error) {
            toast.error("Failed to generate sales intelligence report");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Auto-refresh every 10 seconds for live realtime generation
        const interval = setInterval(() => {
            fetchData();
        }, 10000);

        try {
            const socket = initSocket("sales_report_listener");
            socket.on("OP_NEW_ORDER", () => fetchData());
            socket.on("ORDER_STATUS_CHANGED", () => fetchData());
            socket.on("REALTIME_REPORT_UPDATE", () => fetchData());

            return () => {
                socket.off("OP_NEW_ORDER");
                socket.off("ORDER_STATUS_CHANGED");
                socket.off("REALTIME_REPORT_UPDATE");
                clearInterval(interval);
            };
        } catch {
            return () => clearInterval(interval);
        }
    }, [filters]);

    const exportToCSV = () => {
        if (orders.length === 0) {
            toast.error("No data available to export");
            return;
        }

        const headers = [
            "Order ID",
            "Date",
            "Store",
            "Customer Name",
            "Customer Phone",
            "Channel",
            "Payment Method",
            "Status",
            "Subtotal (₹)",
            "Discount (₹)",
            "Paid Amount (₹)",
            "Payment Status",
            "Rec 500", "Rec 200", "Rec 100", "Rec 50", "Rec 20", "Rec 10", "Rec 5", "Rec 2", "Rec 1",
            "Chg 500", "Chg 200", "Chg 100", "Chg 50", "Chg 20", "Chg 10", "Chg 5", "Chg 2", "Chg 1"
        ];

        const escapeCSV = (val: any) => {
            if (val === null || val === undefined) return "";
            let str = String(val);
            if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
                str = '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const rows = orders.map(order => {
            const dateStr = format(new Date(order.createdAt), "yyyy-MM-dd HH:mm:ss");
            const storeName = order.location?.name || "Global";
            const customerName = order.user?.name || "Walk-in Guest";
            const customerPhone = order.user?.phone || "";
            const method = order.payments?.[0]?.method || (order.isCredit ? "CREDIT" : "N/A");
            
            const subtotal = Number(order.totalAmount) + Number(order.discountAmount);
            const discount = Number(order.discountAmount);
            const totalAmount = Number(order.totalAmount);

            // Find cash payment to extract denominations
            const cashPayment = order.payments?.find((p: any) => p.method === "CASH" || p.method === "LIQUID_CASH");
            let denominationsObj: any = null;
            if (cashPayment?.denominations) {
                try {
                    denominationsObj = typeof cashPayment.denominations === "string" 
                        ? JSON.parse(cashPayment.denominations) 
                        : cashPayment.denominations;
                } catch (e) {
                    console.error("Failed to parse denominations", e);
                }
            }

            const received = denominationsObj?.received || {};
            const change = denominationsObj?.change || {};

            return [
                order.id,
                dateStr,
                storeName,
                customerName,
                customerPhone,
                order.channel,
                method,
                order.status,
                subtotal.toFixed(2),
                discount.toFixed(2),
                totalAmount.toFixed(2),
                order.paymentStatus,
                received[500] || 0,
                received[200] || 0,
                received[100] || 0,
                received[50] || 0,
                received[20] || 0,
                received[10] || 0,
                received[5] || 0,
                received[2] || 0,
                received[1] || 0,
                change[500] || 0,
                change[200] || 0,
                change[100] || 0,
                change[50] || 0,
                change[20] || 0,
                change[10] || 0,
                change[5] || 0,
                change[2] || 0,
                change[1] || 0
            ].map(escapeCSV).join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Sales_Report_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const drawConcentricChart = (
        channelCounts: { WEB: number; POS: number; WHATSAPP: number },
        paidStatusStats: { PAID: number; DUE: number }
    ): string => {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext("2d");
        if (!ctx) return "";

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 400, 400);

        const centerX = 200;
        const centerY = 200;

        const channelTotal = channelCounts.WEB + channelCounts.POS + channelCounts.WHATSAPP || 1;
        const channelData = [
            { label: "Online", value: channelCounts.WEB, color: "#3498db" },
            { label: "POS", value: channelCounts.POS, color: "#9b59b6" },
            { label: "WhatsApp", value: channelCounts.WHATSAPP, color: "#2ecc71" }
        ];

        let startAngle = -Math.PI / 2;
        const innerRadius = 70;

        channelData.forEach(slice => {
            const sliceAngle = (slice.value / channelTotal) * 2 * Math.PI;
            if (sliceAngle > 0) {
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, innerRadius, startAngle, startAngle + sliceAngle);
                ctx.closePath();
                ctx.fillStyle = slice.color;
                ctx.fill();
                startAngle += sliceAngle;
            }
        });

        ctx.beginPath();
        ctx.arc(centerX, centerY, 45, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        const paidTotal = paidStatusStats.PAID + paidStatusStats.DUE || 1;
        const paidData = [
            { label: "Paid", value: paidStatusStats.PAID, color: "#10b981" },
            { label: "Due", value: paidStatusStats.DUE, color: "#f97316" }
        ];

        startAngle = -Math.PI / 2;
        const outerRingStart = 85;
        const outerRingEnd = 110;

        paidData.forEach(slice => {
            const sliceAngle = (slice.value / paidTotal) * 2 * Math.PI;
            if (sliceAngle > 0) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, outerRingEnd, startAngle, startAngle + sliceAngle);
                ctx.arc(centerX, centerY, outerRingStart, startAngle + sliceAngle, startAngle, true);
                ctx.closePath();
                ctx.fillStyle = slice.color;
                ctx.fill();
                startAngle += sliceAngle;
            }
        });

        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        let legendY = 325;
        ctx.fillStyle = "#1e293b";
        ctx.fillText("Order Channels (Inner):", 20, 305);
        channelData.forEach((slice, idx) => {
            ctx.fillStyle = slice.color;
            ctx.fillRect(20 + idx * 120, legendY, 12, 12);
            ctx.fillStyle = "#475569";
            const pct = ((slice.value / channelTotal) * 100).toFixed(0);
            ctx.fillText(`${slice.label} (${slice.value} Ord, ${pct}%)`, 38 + idx * 120, legendY + 6);
        });

        ctx.fillStyle = "#1e293b";
        ctx.fillText("Payment Status (Outer):", 20, 355);
        paidData.forEach((slice, idx) => {
            ctx.fillStyle = slice.color;
            ctx.fillRect(20 + idx * 120, 375, 12, 12);
            ctx.fillStyle = "#475569";
            const pct = ((slice.value / paidTotal) * 100).toFixed(0);
            ctx.fillText(`${slice.label} (₹${slice.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}, ${pct}%)`, 38 + idx * 120, 381);
        });

        return canvas.toDataURL("image/png");
    };

    const exportToPDF = async () => {
        if (orders.length === 0) {
            toast.error("No data available to export");
            return;
        }

        const toastId = toast.loading("Generating premium PDF sales intelligence report...");

        const currentDuration = new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime();
        const pastEndDate = new Date(new Date(filters.startDate).getTime() - 24 * 60 * 60 * 1000);
        const pastStartDate = new Date(pastEndDate.getTime() - currentDuration);

        let pastTotalRevenue = 0;
        let pastTotalOrders = 0;
        let pastTotalDue = 0;
        try {
            const pStartStr = format(pastStartDate, "yyyy-MM-dd");
            const pEndStr = format(pastEndDate, "yyyy-MM-dd");
            
            const queryParams = new URLSearchParams();
            if (filters.locationId) queryParams.append("locationId", filters.locationId);
            queryParams.append("startDate", pStartStr);
            queryParams.append("endDate", pEndStr);
            if (filters.channel) queryParams.append("channel", filters.channel);
            if (filters.paymentMethod) queryParams.append("paymentMethod", filters.paymentMethod);
            if (filters.isCredit) queryParams.append("isCredit", filters.isCredit);

            const pastRes = await api.get(`/dashboard/reports?${queryParams.toString()}`);
            pastTotalRevenue = Number(pastRes.data.summary?.totalRevenue || 0);
            pastTotalOrders = Number(pastRes.data.summary?.totalOrders || 0);
            pastTotalDue = Number(pastRes.data.summary?.totalDue || 0);
        } catch (e) {
            console.error("Failed to fetch past period data", e);
        }

        const pastTotalPaid = pastTotalRevenue - pastTotalDue;
        const currentTotal = summary?.totalRevenue || 0;
        const currentOrders = summary?.totalOrders || 0;
        
        let growthPercent = 0;
        if (pastTotalRevenue > 0) {
            growthPercent = ((currentTotal - pastTotalRevenue) / pastTotalRevenue) * 100;
        }

        const channelOrderCounts = { WEB: 0, POS: 0, WHATSAPP: 0 };
        const channelSalesAmounts = { WEB: 0, POS: 0, WHATSAPP: 0 };
        const paidStatusStats = { PAID: 0, DUE: 0 };

        orders.forEach(o => {
            const amt = Number(o.totalAmount);
            if (o.channel === "WEB") {
                channelOrderCounts.WEB += 1;
                channelSalesAmounts.WEB += amt;
            } else if (o.channel === "POS") {
                channelOrderCounts.POS += 1;
                channelSalesAmounts.POS += amt;
            } else if (o.channel === "WHATSAPP") {
                channelOrderCounts.WHATSAPP += 1;
                channelSalesAmounts.WHATSAPP += amt;
            }

            if (o.isCredit || !o.isPaid) {
                const paid = o.payments?.filter((p: any) => p.status === "SUCCESS").reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
                const remaining = amt - paid;
                paidStatusStats.PAID += paid;
                if (remaining > 0) paidStatusStats.DUE += remaining;
            } else {
                paidStatusStats.PAID += amt;
            }
        });

        const currentAOV = currentOrders > 0 ? currentTotal / currentOrders : 0;
        const pastAOV = pastTotalOrders > 0 ? pastTotalRevenue / pastTotalOrders : 0;
        const currentTotalPaid = paidStatusStats.PAID;
        const currentTotalDue = paidStatusStats.DUE;

        const productSales: Record<string, { name: string; quantity: number; revenue: number; currentStock: number }> = {};
        orders.forEach(order => {
            order.items?.forEach((item: any) => {
                const prod = item.product;
                const pName = prod?.name || "Unknown Product";
                const pId = item.productId;
                
                let stock = 0;
                if (prod?.inventory) {
                    const matchedInv = filters.locationId 
                        ? prod.inventory.find((inv: any) => inv.locationId === filters.locationId)
                        : null;
                    if (matchedInv) {
                        stock = Number(matchedInv.currentStock);
                    } else {
                        stock = prod.inventory.reduce((sum: number, inv: any) => sum + Number(inv.currentStock), 0);
                    }
                }

                if (!productSales[pId]) {
                    productSales[pId] = {
                        name: pName,
                        quantity: 0,
                        revenue: 0,
                        currentStock: stock
                    };
                }
                productSales[pId].quantity += Number(item.quantity);
                productSales[pId].revenue += Number(item.quantity) * Number(item.sellingPrice);
            });
        });

        const productSalesList = Object.values(productSales);
        
        const highestSold = productSalesList.length > 0 
            ? [...productSalesList].sort((a, b) => b.quantity - a.quantity)[0]
            : null;

        const leastSoldInStock = productSalesList.length > 0
            ? productSalesList
                .filter(p => p.currentStock > 0)
                .sort((a, b) => a.quantity - b.quantity)
                .slice(0, 5)
            : [];

        const customerMap: Record<string, { name: string; phone: string; count: number; spend: number; due: number }> = {};
        orders.forEach(o => {
            const key = o.user?.phone || o.userId;
            if (!customerMap[key]) {
                customerMap[key] = {
                    name: o.user?.name || "Walk-in Guest",
                    phone: o.user?.phone || "N/A",
                    count: 0,
                    spend: 0,
                    due: 0
                };
            }
            customerMap[key].count += 1;
            customerMap[key].spend += Number(o.totalAmount);
            if (o.isCredit || !o.isPaid) {
                const paid = o.payments?.filter((p: any) => p.status === "SUCCESS").reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
                const remaining = Number(o.totalAmount) - paid;
                if (remaining > 0) customerMap[key].due += remaining;
            }
        });
        const topCustomers = Object.values(customerMap)
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 15);

        const chartDataUrl = drawConcentricChart(channelOrderCounts, paidStatusStats);

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const selectedStoreName = stores.find(s => s.id === filters.locationId)?.name || "All Locations";
        const dateRangeStr = `${format(new Date(filters.startDate), "dd MMM yyyy")} - ${format(new Date(filters.endDate), "dd MMM yyyy")}`;

        const primaryColor = [16, 185, 129];
        const secondaryColor = [30, 41, 59];

        const addHeader = (pageNum: number) => {
            if (pageNum === 1) return;
            doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            doc.rect(0, 0, 210, 22, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("BOOKMYVEG SALES PERFORMANCE INTELLIGENCE", 15, 14);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`Store: ${selectedStoreName.toUpperCase()} | Range: ${dateRangeStr}`, 130, 14, { align: "left" });

            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(0, 22, 210, 2, "F");
        };

        const addFooter = (pageNum: number, totalPages: number) => {
            if (pageNum === 1) return;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("BMV Systems - Sales Intelligence Executive Report", 15, 287);
            doc.text(`Page ${pageNum} of ${totalPages}`, 195, 287, { align: "right" });
            
            doc.setDrawColor(226, 232, 240);
            doc.line(15, 282, 195, 282);
        };

        // ==========================================
        // PAGE 1: COVER PAGE
        // ==========================================
        doc.setFillColor(30, 41, 59); // Slate Blue Accent
        doc.rect(0, 0, 210, 85, "F");

        doc.setTextColor(16, 185, 129); // Emerald Green
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("BOOKMYVEG SYSTEMS", 20, 35);

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("EXECUTIVE SALES & OPERATIONAL", 20, 52);
        doc.text("PERFORMANCE INTELLIGENCE", 20, 64);

        doc.setTextColor(148, 163, 184); // Slate Gray
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Comprehensive Business Performance Audit & Supply Chain Diagnostics", 20, 74);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(20, 110, 170, 95, 4, 4, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(20, 110, 170, 95, 4, 4, "D");

        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("REPORT METADATA & PARAMETERS", 28, 125);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("Target Location / Store:", 28, 142);
        doc.text("Reporting Date Range:", 28, 154);
        doc.text("Generation Timestamp:", 28, 166);
        doc.text("Prepared For:", 28, 178);
        doc.text("Classification Status:", 28, 190);

        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.text(selectedStoreName.toUpperCase(), 75, 142);
        doc.text(dateRangeStr, 75, 154);
        doc.text(format(new Date(), "dd MMMM yyyy, HH:mm:ss"), 75, 166);
        doc.text("BookMyVeg Administration Team", 75, 178);
        doc.setTextColor(239, 68, 68); // Red
        doc.text("STRICTLY CONFIDENTIAL - INTERNAL AUDIT ONLY", 75, 190);

        doc.setFillColor(16, 185, 129); // Bottom Accent Bar
        doc.rect(0, 287, 210, 10, "F");

        // ==========================================
        // PAGE 2: EXECUTIVE SUMMARY
        // ==========================================
        doc.addPage();
        addHeader(2);

        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Executive Summary", 15, 34);

        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text("This intelligence document provides a structured analysis of operational metrics, customer transaction velocity,", 15, 42);
        doc.text("and supply chain performance parameters compiled across selected distribution networks.", 15, 46);

        // Section 1 card
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 54, 180, 52, 3, 3, "F");
        
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("01. SALES PERFORMANCE & ACTIVITY REVIEW", 22, 64);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        
        const textLine1 = `During the current reporting cycle, the store recorded gross sales of ₹${currentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
        const textLine2 = `This revenue was generated from ${currentOrders} processed transactions. The Average Order Value (AOV) stands at ₹${currentAOV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
        
        let revenuePerformanceComment = "";
        if (pastTotalRevenue > 0) {
            const perfText = growthPercent >= 0 ? "representing an expansion of" : "representing a contraction of";
            revenuePerformanceComment = `Compared to the preceding duration (Gross: ₹${pastTotalRevenue.toLocaleString()}), this is a ${perfText} ${Math.abs(growthPercent).toFixed(1)}%.`;
        } else {
            revenuePerformanceComment = "No comparison data was retrieved for the same duration preceding period.";
        }
        
        doc.text(textLine1, 22, 74);
        doc.text(textLine2, 22, 82);
        doc.text(revenuePerformanceComment, 22, 90);

        // Section 2 card
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 114, 180, 52, 3, 3, "F");
        
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("02. COLLECTIONS RECONCILIATION & LIQUIDITY ANALYSIS", 22, 124);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        
        const paidPct = ((paidStatusStats.PAID / (currentTotal || 1)) * 100).toFixed(1);
        const duePct = ((paidStatusStats.DUE / (currentTotal || 1)) * 100).toFixed(1);
        
        const debtLine1 = `Reconciled liquid collections stand at ₹${paidStatusStats.PAID.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${paidPct}% of gross sales).`;
        const debtLine2 = `Active outstanding credit dues total ₹${paidStatusStats.DUE.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${duePct}% of gross sales).`;
        
        let riskAssessment = "";
        if (Number(duePct) > 20) {
            riskAssessment = "WARNING: Outstanding credit dues exceed the 20% safety threshold. Tighter collection measures are highly advised.";
        } else if (Number(duePct) > 5) {
            riskAssessment = "MODERATE RISK: Dues are within acceptable limits but active monitoring is recommended.";
        } else {
            riskAssessment = "LOW RISK: Outstanding credit ratio is nominal, indicating efficient cash reconciliation workflows.";
        }
        
        doc.text(debtLine1, 22, 134);
        doc.text(debtLine2, 22, 142);
        doc.text(riskAssessment, 22, 150);

        // Section 3 card
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 174, 180, 52, 3, 3, "F");
        
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("03. MULTI-CHANNEL DISTRIBUTION SUMMARY", 22, 184);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        
        const totalAmountChannel = (channelSalesAmounts.WEB + channelSalesAmounts.POS + channelSalesAmounts.WHATSAPP) || 1;
        const webSalesPct = ((channelSalesAmounts.WEB / totalAmountChannel) * 100).toFixed(1);
        const posSalesPct = ((channelSalesAmounts.POS / totalAmountChannel) * 100).toFixed(1);
        const waSalesPct = ((channelSalesAmounts.WHATSAPP / totalAmountChannel) * 100).toFixed(1);
        
        const channelLine1 = `Online channels (WEB) contributed ₹${channelSalesAmounts.WEB.toLocaleString()} (${webSalesPct}%) from ${channelOrderCounts.WEB} orders.`;
        const channelLine2 = `Offline counter POS sales generated ₹${channelSalesAmounts.POS.toLocaleString()} (${posSalesPct}%) from ${channelOrderCounts.POS} orders.`;
        const channelLine3 = `WhatsApp conversational commerce recorded ₹${channelSalesAmounts.WHATSAPP.toLocaleString()} (${waSalesPct}%) from ${channelOrderCounts.WHATSAPP} orders.`;
        
        doc.text(channelLine1, 22, 194);
        doc.text(channelLine2, 22, 202);
        doc.text(channelLine3, 22, 210);

        addFooter(2, 6);

        // ==========================================
        // PAGE 3: SALES PERFORMANCE
        // ==========================================
        doc.addPage();
        addHeader(3);

        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Sales Performance & Reconciliations", 15, 34);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 40, 95, 105, 4, 4, "F");
        if (chartDataUrl) {
            doc.addImage(chartDataUrl, "PNG", 20, 42, 85, 85);
        }

        const startX = 115;
        
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(startX, 40, 80, 28, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("GROSS SALES REVENUE", startX + 5, 46);
        doc.setFontSize(16);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(`₹${currentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, startX + 5, 56);
        
        doc.setFontSize(8);
        if (pastTotalRevenue > 0) {
            const isPos = growthPercent >= 0;
            doc.setTextColor(isPos ? 16 : 220, isPos ? 185 : 38, isPos ? 129 : 38);
            doc.text(`${isPos ? "▲" : "▼"} ${Math.abs(growthPercent).toFixed(1)}% vs past period (₹${pastTotalRevenue.toLocaleString()})`, startX + 5, 63);
        } else {
            doc.setTextColor(100, 116, 139);
            doc.text("Preceding period: N/A", startX + 5, 63);
        }

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(startX, 72, 80, 34, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("TOP SELLING PRODUCT", startX + 5, 78);
        
        if (highestSold) {
            doc.setFontSize(9);
            doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            const wrappedName = doc.splitTextToSize(highestSold.name.toUpperCase(), 70);
            doc.text(wrappedName, startX + 5, 85);
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Qty Sold: ${highestSold.quantity.toFixed(1)}  |  Rev: ₹${highestSold.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, startX + 5, 100);
        } else {
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184);
            doc.text("NO SALES RECORDED", startX + 5, 87);
        }

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(startX, 110, 80, 35, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("COLLECTIONS SUMMARY", startX + 5, 116);
        doc.setFontSize(8);
        doc.setTextColor(16, 185, 129);
        doc.text(`Paid Revenue: ₹${paidStatusStats.PAID.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, startX + 5, 124);
        doc.setTextColor(249, 115, 22);
        doc.text(`Outstanding Due: ₹${paidStatusStats.DUE.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, startX + 5, 131);
        doc.setTextColor(100, 116, 139);
        doc.text(`Transactions Count: ${currentOrders} Orders`, startX + 5, 139);

        // Section: Period-over-Period Performance Reconciler
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Period-over-Period Performance Reconciler", 15, 155);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const currentPeriodLabel = `${format(new Date(filters.startDate), "dd MMM yy")} - ${format(new Date(filters.endDate), "dd MMM yy")}`;
        const pastPeriodLabel = `${format(pastStartDate, "dd MMM yy")} - ${format(pastEndDate, "dd MMM yy")}`;
        doc.text(`Comparing current range (${currentPeriodLabel}) against preceding range (${pastPeriodLabel})`, 15, 159);

        let tableY = 164;
        doc.setFillColor(241, 245, 249);
        doc.rect(15, tableY, 180, 8, "F");
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Performance Metric", 18, tableY + 5.5);
        doc.text("Current Period", 80, tableY + 5.5, { align: "right" });
        doc.text("Preceding Period", 120, tableY + 5.5, { align: "right" });
        doc.text("Difference", 160, tableY + 5.5, { align: "right" });
        doc.text("Change (%)", 192, tableY + 5.5, { align: "right" });
        tableY += 8;

        const metricsData = [
            { name: "Gross Sales Revenue", current: currentTotal, past: pastTotalRevenue, isCurrency: true },
            { name: "Total Orders Count", current: currentOrders, past: pastTotalOrders, isCurrency: false },
            { name: "Average Order Value (AOV)", current: currentAOV, past: pastAOV, isCurrency: true },
            { name: "Paid Revenue", current: currentTotalPaid, past: pastTotalPaid, isCurrency: true },
            { name: "Outstanding Dues", current: currentTotalDue, past: pastTotalDue, isCurrency: true, isDueMetric: true }
        ];

        doc.setFont("helvetica", "normal");
        metricsData.forEach((m, idx) => {
            const diff = m.current - m.past;
            let pct = 0;
            if (m.past > 0) {
                pct = (diff / m.past) * 100;
            } else if (m.current > 0) {
                pct = 100;
            }

            if (idx % 2 === 1) {
                doc.setFillColor(250, 250, 250);
                doc.rect(15, tableY, 180, 8, "F");
            }
            doc.setDrawColor(241, 245, 249);
            doc.line(15, tableY, 195, tableY);

            doc.setTextColor(51, 65, 85);
            doc.setFont("helvetica", "bold");
            doc.text(m.name, 18, tableY + 5.5);
            doc.setFont("helvetica", "normal");

            const formatVal = (val: number) => {
                if (m.isCurrency) {
                    return `₹${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
                return val.toLocaleString();
            };

            doc.text(formatVal(m.current), 80, tableY + 5.5, { align: "right" });
            doc.text(formatVal(m.past), 120, tableY + 5.5, { align: "right" });

            const diffPrefix = diff >= 0 ? "+" : "";
            doc.text(`${diffPrefix}${formatVal(diff)}`, 160, tableY + 5.5, { align: "right" });

            let isPositiveTrend = diff >= 0;
            if (m.isDueMetric) {
                isPositiveTrend = diff <= 0;
            }

            if (diff === 0) {
                doc.setTextColor(100, 116, 139);
                doc.text("0.0%", 192, tableY + 5.5, { align: "right" });
            } else {
                if (isPositiveTrend) {
                    doc.setTextColor(16, 185, 129);
                    doc.text(`▲ ${diff >= 0 ? "+" : ""}${pct.toFixed(1)}%`, 192, tableY + 5.5, { align: "right" });
                } else {
                    doc.setTextColor(239, 68, 68);
                    doc.text(`▼ ${diff >= 0 ? "+" : ""}${pct.toFixed(1)}%`, 192, tableY + 5.5, { align: "right" });
                }
            }

            tableY += 8;
        });

        doc.setDrawColor(241, 245, 249);
        doc.line(15, tableY, 195, tableY);
        addFooter(3, 6);

        // ==========================================
        // PAGE 4: INVENTORY & SUPPLY CHAIN
        // ==========================================
        doc.addPage();
        addHeader(4);

        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Inventory & Supply Chain", 15, 34);

        // Top Selling Product card
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 40, 180, 36, 4, 4, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(15, 40, 180, 36, 4, 4, "D");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(16, 185, 129); // emerald
        doc.text("HIGHEST VELOCITY PRODUCT (BEST SELLER)", 22, 48);
        
        if (highestSold) {
            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.text(highestSold.name.toUpperCase(), 22, 58);
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            const revPct = ((highestSold.revenue / (currentTotal || 1)) * 100).toFixed(1);
            doc.text(`Total Quantity Sold: ${highestSold.quantity.toFixed(1)} units  |  Total Revenue: ₹${highestSold.revenue.toLocaleString()} (${revPct}% of gross revenue)`, 22, 66);
        } else {
            doc.setFontSize(11);
            doc.setTextColor(148, 163, 184);
            doc.text("NO ACTIVE PRODUCT SALES RECORDED", 22, 58);
        }

        // Section: Slow Moving Stock
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Slow Moving Stock / Optimization Opportunities (In Stock)", 15, 86);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Products with active stock, sorted by lowest units sold during selected duration.", 15, 90);

        let tableYPage2 = 95;
        doc.setFillColor(241, 245, 249);
        doc.rect(15, tableYPage2, 180, 7, "F");
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "bold");
        doc.text("Product Name", 18, tableYPage2 + 5);
        doc.text("Units Sold", 115, tableYPage2 + 5, { align: "right" });
        doc.text("Revenue", 150, tableYPage2 + 5, { align: "right" });
        doc.text("Current Stock", 192, tableYPage2 + 5, { align: "right" });

        tableYPage2 += 7;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);

        if (leastSoldInStock.length === 0) {
            doc.setDrawColor(241, 245, 249);
            doc.line(15, tableYPage2, 195, tableYPage2);
            doc.text("No matching slow-moving stock found", 18, tableYPage2 + 6);
            tableYPage2 += 7;
        } else {
            leastSoldInStock.forEach((prod) => {
                doc.setDrawColor(241, 245, 249);
                doc.line(15, tableYPage2, 195, tableYPage2);
                doc.text(prod.name, 18, tableYPage2 + 5);
                doc.text(prod.quantity.toFixed(1), 115, tableYPage2 + 5, { align: "right" });
                doc.text(`₹${prod.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 150, tableYPage2 + 5, { align: "right" });
                doc.text(`${prod.currentStock.toFixed(1)} units`, 192, tableYPage2 + 5, { align: "right" });
                tableYPage2 += 7;
            });
        }
        
        doc.line(15, tableYPage2, 195, tableYPage2);

        // Section: Supply Chain Insights
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 150, 180, 48, 3, 3, "F");
        
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("SUPPLY CHAIN OBSERVATIONS", 22, 160);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        
        const countSlow = leastSoldInStock.length;
        let slowMovingComment = "";
        if (countSlow > 0) {
            slowMovingComment = `There are currently ${countSlow} products flagged as slow-moving (high stock, low sales). A promotion is advised.`;
        } else {
            slowMovingComment = "No active products are flagged as slow-moving in stock during this reporting period.";
        }
        
        const velocityComment = highestSold 
            ? `The highest velocity product (${highestSold.name}) accounted for ₹${highestSold.revenue.toLocaleString()} in revenue. Ensure sufficient replenishment cycles.`
            : "Velocity tracking shows no high-turnover products during this period.";
            
        doc.text(slowMovingComment, 22, 170);
        doc.text(velocityComment, 22, 178);
        doc.text("Keep items under 10 units of stock monitored for proactive procurement.", 22, 186);

        addFooter(4, 6);

        // ==========================================
        // PAGE 5: CUSTOMER ANALYTICS
        // ==========================================
        doc.addPage();
        addHeader(5);

        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Customer Analytics", 15, 34);

        // Section: Customer Highlights
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 40, 180, 40, 3, 3, "F");
        
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("CUSTOMER VALUE STRUCTURE", 22, 50);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        
        const uniqueCustCount = Object.keys(customerMap).length;
        const top15Spend = topCustomers.reduce((sum, c) => sum + c.spend, 0);
        const concentrationPct = ((top15Spend / (currentTotal || 1)) * 100).toFixed(1);
        
        const customerComment1 = `A total of ${uniqueCustCount} unique customers transacted during this period.`;
        const customerComment2 = `The top 15 customers ledger below represents cumulative spend of ₹${top15Spend.toLocaleString()} (${concentrationPct}% of gross sales).`;
        
        doc.text(customerComment1, 22, 60);
        doc.text(customerComment2, 22, 68);

        // Section: Customer Ledger Table
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Top 15 Customers Ledger", 15, 92);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Customers ranked by gross spend during the reporting period, including order counts and active dues.", 15, 96);

        let tableYCust = 102;
        doc.setFillColor(241, 245, 249);
        doc.rect(15, tableYCust, 180, 8, "F");
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "bold");
        doc.text("Rank", 18, tableYCust + 5.5);
        doc.text("Customer Details", 32, tableYCust + 5.5);
        doc.text("Phone", 95, tableYCust + 5.5);
        doc.text("Orders", 125, tableYCust + 5.5, { align: "right" });
        doc.text("Gross Spend", 155, tableYCust + 5.5, { align: "right" });
        doc.text("Outstanding Due", 192, tableYCust + 5.5, { align: "right" });

        tableYCust += 8;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);

        topCustomers.forEach((cust, index) => {
            doc.setDrawColor(241, 245, 249);
            doc.line(15, tableYCust, 195, tableYCust);

            if (index % 2 === 1) {
                doc.setFillColor(250, 250, 250);
                doc.rect(15, tableYCust, 180, 7.5, "F");
            }

            doc.setTextColor(100, 116, 139);
            doc.text(String(index + 1), 18, tableYCust + 5);
            
            doc.setTextColor(51, 65, 85);
            doc.setFont("helvetica", "bold");
            doc.text(cust.name.substring(0, 32), 32, tableYCust + 5);
            doc.setFont("helvetica", "normal");
            
            doc.text(cust.phone, 95, tableYCust + 5);
            doc.text(String(cust.count), 125, tableYCust + 5, { align: "right" });
            doc.text(`₹${cust.spend.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, 155, tableYCust + 5, { align: "right" });
            
            if (cust.due > 0) {
                doc.setTextColor(249, 115, 22);
                doc.text(`₹${cust.due.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 192, tableYCust + 5, { align: "right" });
                doc.setTextColor(51, 65, 85);
            } else {
                doc.text("₹0", 192, tableYCust + 5, { align: "right" });
            }

            tableYCust += 7.5;
        });

        doc.line(15, tableYCust, 195, tableYCust);
        addFooter(5, 6);

        // ==========================================
        // PAGE 6: FUTURE GROWTH PLAN
        // ==========================================
        doc.addPage();
        addHeader(6);

        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Future Growth Plan", 15, 34);

        // Recommendations Card 1
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 42, 180, 34, 3, 3, "F");
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("1. DEBT RECOVERY & CASH CONVERSION CYCLE", 22, 51);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const duePercent = ((paidStatusStats.DUE / (currentTotal || 1)) * 100).toFixed(1);
        const recText1 = `Outstanding credit dues represent ₹${paidStatusStats.DUE.toLocaleString()} (${duePercent}% of total revenue).`;
        const recText2 = `Action Plan: Enforce a strict 7-day payment settlement window on all customer credit accounts.`;
        doc.text(recText1, 22, 59);
        doc.text(recText2, 22, 66);

        // Recommendations Card 2
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 82, 180, 34, 3, 3, "F");
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("2. STOCK VELOCITY & INVENTORY LIQUIDATION", 22, 91);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const slowItemNames = leastSoldInStock.slice(0, 2).map(p => p.name).join(", ");
        const recText3 = slowItemNames 
            ? `Slow-moving inventory items detected (e.g. ${slowItemNames}).`
            : "No critical slow-moving inventory detected currently.";
        const recText4 = `Action Plan: Launch promotional 'Flash Sales' or bundle deals to accelerate inventory velocity.`;
        doc.text(recText3, 22, 99);
        doc.text(recText4, 22, 106);

        // Recommendations Card 3
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 122, 180, 34, 3, 3, "F");
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("3. CHANNEL PENETRATION & LOGISTICS ACTION", 22, 131);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const totalAmountChannelPop = (channelSalesAmounts.WEB + channelSalesAmounts.POS + channelSalesAmounts.WHATSAPP) || 1;
        const webSalesPctPop = ((channelSalesAmounts.WEB / totalAmountChannelPop) * 100).toFixed(1);
        const recText5 = `Online sales represent ${webSalesPctPop}% of the overall revenue mix.`;
        const recText6 = `Action Plan: Deploy WhatsApp-based loyalty program targeted notifications to walk-in POS customers.`;
        doc.text(recText5, 22, 139);
        doc.text(recText6, 22, 146);

        // Audit section
        doc.setDrawColor(203, 213, 225);
        doc.line(15, 172, 195, 172);
        
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("REPORT CONSOLIDATION AND AUDIT REVIEW", 15, 184);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("This intelligence document has been compiled automatically and is approved for distribution.", 15, 192);
        
        doc.line(25, 235, 85, 235);
        doc.text("Prepared by: System Auditor", 25, 241);
        doc.text("BMV Systems Automated Audit", 25, 247);
        
        doc.line(125, 235, 185, 235);
        doc.text("Authorized Sign-off: Admin", 125, 241);
        doc.text("Executive Representative", 125, 247);

        addFooter(6, 6);

        doc.save(`Sales_Report_Dashboard_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`);
        
        toast.dismiss(toastId);
        toast.success("Sales intelligence PDF report downloaded!");
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "DELIVERED": return "bg-emerald-50 text-emerald-600 border-emerald-100";
            case "CANCELLED": return "bg-red-50 text-red-600 border-red-100";
            case "PENDING": return "bg-orange-50 text-orange-600 border-orange-100";
            default: return "bg-blue-50 text-blue-600 border-blue-100";
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <TrendingUp className="h-8 w-8 text-emerald-600" />
                            Daily Sales Intelligence
                        </h2>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-black uppercase tracking-wider animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Live Realtime
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Real-time daily sales generation, live order updates, revenue tracking, and channel reports.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={fetchData} className="h-11 px-6 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-slate-200">
                        <Activity className="h-4 w-4" />
                        Live Refresh ({format(lastRefreshedAt, "HH:mm:ss")})
                    </button>
                    <button onClick={exportToPDF} className="h-11 px-5 bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 rounded-xl flex items-center justify-center text-xs font-bold uppercase tracking-wider transition-all shadow-sm gap-2" title="Export to PDF">
                        <Download className="h-4 w-4" /> PDF Report
                    </button>
                    <button onClick={exportToCSV} className="h-11 w-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-all shadow-sm" title="Export to CSV">
                        <Download className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Filter Suite with Date Quick Presets */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-xl shadow-slate-500/5 space-y-6">
                {/* Date Presets Bar */}
                <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">Quick Date Presets:</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setFilters({ ...filters, startDate: todayStr, endDate: todayStr })}
                            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                filters.startDate === todayStr && filters.endDate === todayStr
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            Today (Current Day)
                        </button>
                        <button
                            onClick={() => {
                                const yest = format(subDays(new Date(), 1), "yyyy-MM-dd");
                                setFilters({ ...filters, startDate: yest, endDate: yest });
                            }}
                            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                filters.startDate === format(subDays(new Date(), 1), "yyyy-MM-dd") && filters.endDate === format(subDays(new Date(), 1), "yyyy-MM-dd")
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            Yesterday
                        </button>
                        <button
                            onClick={() => {
                                const startW = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
                                setFilters({ ...filters, startDate: startW, endDate: todayStr });
                            }}
                            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                filters.startDate === format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd") && filters.endDate === todayStr
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            This Week
                        </button>
                        <button
                            onClick={() => {
                                const startM = format(startOfMonth(new Date()), "yyyy-MM-dd");
                                setFilters({ ...filters, startDate: startM, endDate: todayStr });
                            }}
                            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                filters.startDate === format(startOfMonth(new Date()), "yyyy-MM-dd") && filters.endDate === todayStr
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            This Month
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Select Store</label>
                        <select 
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                            value={filters.locationId}
                            onChange={(e) => setFilters({...filters, locationId: e.target.value})}
                        >
                            <option value="">All Locations</option>
                            {stores.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">From Date</label>
                        <input 
                            type="date"
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                            value={filters.startDate}
                            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">To Date</label>
                        <input 
                            type="date"
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                            value={filters.endDate}
                            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Channel</label>
                        <select 
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all appearance-none"
                            value={filters.channel}
                            onChange={(e) => setFilters({...filters, channel: e.target.value})}
                        >
                            <option value="">Any Channel</option>
                            <option value="WEB">Online (Web)</option>
                            <option value="POS">Offline (POS)</option>
                            <option value="WHATSAPP">WhatsApp</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Payment Method</label>
                        <select 
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all appearance-none"
                            value={filters.paymentMethod}
                            onChange={(e) => setFilters({...filters, paymentMethod: e.target.value})}
                        >
                            <option value="">Any Method</option>
                            <option value="ONLINE">Digital/Online</option>
                            <option value="CASH">Liquid Cash</option>
                            <option value="COD">Pay on Delivery</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Payment Type</label>
                        <select 
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all appearance-none"
                            value={filters.isCredit}
                            onChange={(e) => setFilters({...filters, isCredit: e.target.value})}
                        >
                            <option value="">Everything</option>
                            <option value="false">Paid/Settled</option>
                            <option value="true">Credit/Due</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:border-emerald-500/30 transition-all duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">GROSS SALES</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">₹{summary?.totalRevenue?.toLocaleString() || "0"}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold">From {summary?.totalOrders || 0} Successful Transactions</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:border-orange-500/30 transition-all duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100 group-hover:bg-orange-600 group-hover:text-white transition-all duration-500">
                            <Clock className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">TOTAL DUE/CREDIT</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">₹{summary?.totalDue?.toLocaleString() || "0"}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold">Awaiting Settlement</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:border-blue-500/30 transition-all duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                            <Globe className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">WEB SALES</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">₹{summary?.byChannel?.WEB?.toLocaleString() || "0"}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold">Online Storefront Revenue</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:border-purple-500/30 transition-all duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100 group-hover:bg-purple-600 group-hover:text-white transition-all duration-500">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">OFFLINE/POS</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">₹{summary?.byChannel?.POS?.toLocaleString() || "0"}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold">In-Store Counter Sales</p>
                </div>
            </div>

            {/* Transactions Registry */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-500/5 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Orders Registry</h3>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5 uppercase">Filtered Operational View</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Order Ref</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Store</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Customer</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Fulfillment</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Settlement</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-6 h-16 bg-slate-50/30" />
                                    </tr>
                                ))
                            ) : orders.map((order) => (
                                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-900 font-mono tracking-tighter">#{order.id.slice(0, 8).toUpperCase()}</span>
                                            <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{format(new Date(order.createdAt), "dd MMM, hh:mm a")}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <Store className="h-3 w-3 text-slate-300" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{order.location?.name || "Global"}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{order.user?.name || "Walk-in Guest"}</span>
                                            <span className="text-[9px] text-slate-400 font-mono mt-0.5">{order.user?.phone || "Private Entry"}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest",
                                            getStatusColor(order.status)
                                        )}>
                                            <div className="w-1 h-1 rounded-full bg-current" />
                                            {order.status}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                {order.channel === "WEB" ? <Globe className="h-3 w-3 text-blue-400" /> : <CreditCard className="h-3 w-3 text-purple-400" />}
                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{order.channel}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {order.isCredit ? (
                                                    <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 uppercase italic">CREDIT DUE</span>
                                                ) : !order.isPaid ? (
                                                    <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 uppercase tracking-wider">{order.payments[0]?.method || "UNPAID"}</span>
                                                ) : (
                                                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">{order.payments[0]?.method || "PAID"}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <span className="text-sm font-black text-slate-900 tracking-tighter">₹{Number(order.totalAmount).toLocaleString()}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && orders.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200">
                            <FileText className="h-10 w-10" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No matching records</p>
                            <p className="text-xs text-slate-400 mt-1">Try adjusting the intelligence filters</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
