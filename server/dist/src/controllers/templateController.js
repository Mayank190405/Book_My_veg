"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCustomMessage = exports.deleteTemplateConfig = exports.upsertTemplateConfig = exports.getTemplateConfigs = exports.getAvailableTemplates = exports.AVAILABLE_TRIGGER_EVENTS = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const messaging_1 = require("../modules/messaging");
// Available system events for WhatsApp notification triggers
exports.AVAILABLE_TRIGGER_EVENTS = [
    {
        key: "BILL_CREATED_PAID",
        label: "Bill Created (Fully Paid / Completed)",
        description: "Triggered immediately when a POS or Web bill is created and fully paid.",
        category: "Billing",
        defaultDurationValue: 0,
        defaultDurationUnit: "MINUTES",
        availableVariables: [
            { key: "customer.name", label: "Customer Name" },
            { key: "order.id", label: "Bill / Order ID" },
            { key: "order.totalAmount", label: "Total Amount (₹)" },
            { key: "order.paymentMethod", label: "Payment Mode (Cash/Easebuzz)" },
            { key: "order.invoiceLink", label: "Invoice PDF Download Link" },
            { key: "location.name", label: "Store Name" }
        ]
    },
    {
        key: "BILL_CREATED_DUE",
        label: "Bill Created (Unpaid / Partial Due)",
        description: "Triggered immediately when a bill is created with remaining balance due.",
        category: "Billing",
        defaultDurationValue: 0,
        defaultDurationUnit: "MINUTES",
        availableVariables: [
            { key: "customer.name", label: "Customer Name" },
            { key: "order.id", label: "Bill / Order ID" },
            { key: "order.totalAmount", label: "Total Bill Amount (₹)" },
            { key: "order.dueAmount", label: "Remaining Due Amount (₹)" },
            { key: "order.payLink", label: "Locked Due Payment Link" },
            { key: "order.invoiceLink", label: "Invoice PDF Link" },
            { key: "location.name", label: "Store Name" }
        ]
    },
    {
        key: "PAYMENT_REMINDER",
        label: "Payment Due Reminder",
        description: "Triggered automatically when a bill has unpaid dues after configured time.",
        category: "Dues & Credit",
        defaultDurationValue: 7,
        defaultDurationUnit: "DAYS",
        availableVariables: [
            { key: "customer.name", label: "Customer Name" },
            { key: "order.dueAmount", label: "Outstanding Due Amount (₹)" },
            { key: "order.id", label: "Invoice / Bill ID" },
            { key: "order.payLink", label: "Locked Total Due Payment Link" },
            { key: "location.name", label: "Store Name" },
            { key: "days.overdue", label: "Days Overdue" }
        ]
    },
    {
        key: "CUSTOMER_INACTIVE",
        label: "Customer Inactivity Reminder (No Orders)",
        description: "Triggered when a registered customer has placed no orders for configured time (e.g. 7 days).",
        category: "Marketing & Retention",
        defaultDurationValue: 7,
        defaultDurationUnit: "DAYS",
        availableVariables: [
            { key: "customer.name", label: "Customer Name" },
            { key: "store.link", label: "Store Web Order Link" },
            { key: "store.name", label: "Store Name" },
            { key: "customer.daysInactive", label: "Days Inactive" },
            { key: "coupon.code", label: "Offer / Coupon Code" }
        ]
    },
    {
        key: "PO_GENERATED",
        label: "Purchase Order Sent to Vendor",
        description: "Triggered when a PO is created and submitted for vendor fulfillment.",
        category: "Vendors & Procurement",
        defaultDurationValue: 0,
        defaultDurationUnit: "MINUTES",
        availableVariables: [
            { key: "vendor.name", label: "Vendor Name" },
            { key: "po.number", label: "PO Number" },
            { key: "po.itemCount", label: "Total Items Count" },
            { key: "po.totalEstimatedCost", label: "Estimated Cost (₹)" },
            { key: "store.name", label: "Delivery Store Hub" },
            { key: "store.address", label: "Store Delivery Address" },
            { key: "po.pdfLink", label: "PO Download / Slip Link" }
        ]
    },
    {
        key: "PO_APPROVED",
        label: "Purchase Order Approved",
        description: "Triggered when purchase manager approves the PO for dispatch.",
        category: "Vendors & Procurement",
        defaultDurationValue: 0,
        defaultDurationUnit: "MINUTES",
        availableVariables: [
            { key: "vendor.name", label: "Vendor Name" },
            { key: "po.number", label: "PO Number" },
            { key: "po.approvedCost", label: "Approved Total (₹)" },
            { key: "store.name", label: "Store Location" },
            { key: "po.expectedDate", label: "Expected Delivery Date" }
        ]
    },
    {
        key: "ORDER_CONFIRMATION",
        label: "Order Confirmation",
        description: "Triggered immediately when customer places an order.",
        category: "Orders",
        defaultDurationValue: 0,
        defaultDurationUnit: "MINUTES",
        availableVariables: [
            { key: "customer.name", label: "Customer Name" },
            { key: "order.id", label: "Order ID (#123)" },
            { key: "order.totalAmount", label: "Total Order Value (₹)" }
        ]
    },
    {
        key: "PAYMENT_RECEIVED",
        label: "Payment Received Confirmation",
        description: "Triggered when a payment transaction is successfully recorded.",
        category: "Billing",
        defaultDurationValue: 0,
        defaultDurationUnit: "MINUTES",
        availableVariables: [
            { key: "customer.name", label: "Customer Name" },
            { key: "order.id", label: "Invoice / Order No." },
            { key: "payment.amount", label: "Amount Paid (₹)" },
            { key: "payment.mode", label: "Payment Mode (UPI/Cash/Card)" }
        ]
    },
    {
        key: "FEEDBACK_REQUEST",
        label: "Customer Feedback Request",
        description: "Triggered after an order is delivered to collect customer review.",
        category: "Marketing & Retention",
        defaultDurationValue: 3,
        defaultDurationUnit: "HOURS",
        availableVariables: [
            { key: "customer.name", label: "Customer Name" },
            { key: "feedback.link", label: "Feedback Form Link" }
        ]
    }
];
/**
 * Fetch available Meta/ChatHub WhatsApp templates live from API
 */
const getAvailableTemplates = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const templates = yield messaging_1.TemplateService.getInstance().syncAndGetTemplates();
        const mapped = templates.map(t => {
            var _a, _b, _c, _d, _e;
            return ({
                id: t.id,
                name: t.name,
                category: t.category,
                status: t.status,
                language: t.language,
                body: t.bodyText,
                variablesCount: t.variableCount,
                exampleVariables: ((_e = (_d = (_c = (_b = (_a = t.raw) === null || _a === void 0 ? void 0 : _a.components) === null || _b === void 0 ? void 0 : _b.find((c) => c.type === "BODY")) === null || _c === void 0 ? void 0 : _c.example) === null || _d === void 0 ? void 0 : _d.body_text) === null || _e === void 0 ? void 0 : _e[0]) || [],
                header: t.headerText || null,
                buttons: t.buttons || [],
                raw: t.raw
            });
        });
        res.json({
            templates: mapped,
            availableEvents: exports.AVAILABLE_TRIGGER_EVENTS
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAvailableTemplates = getAvailableTemplates;
/**
 * Get all configured event template triggers (optionally filtered by locationId)
 */
const getTemplateConfigs = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId } = req.query;
    try {
        const configs = yield prisma_1.default.whatsAppTemplateConfig.findMany({
            where: Object.assign({}, (locationId ? { OR: [{ locationId: String(locationId) }, { locationId: null }] } : {})),
            include: { location: { select: { id: true, name: true, slug: true } } },
            orderBy: { createdAt: "desc" }
        });
        res.json({ configs, availableEvents: exports.AVAILABLE_TRIGGER_EVENTS });
    }
    catch (error) {
        next(error);
    }
});
exports.getTemplateConfigs = getTemplateConfigs;
/**
 * Create or update a template event configuration (No-Code Configurator)
 */
const upsertTemplateConfig = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, event, templateId, title, description, variableMapping, triggerDurationValue = 7, triggerDurationUnit = "DAYS", locationId, isActive = true } = req.body;
    if (!event || !templateId) {
        return res.status(400).json({ message: "event and templateId are required." });
    }
    try {
        const locId = locationId && locationId !== "GLOBAL" ? String(locationId) : null;
        let config;
        if (id) {
            config = yield prisma_1.default.whatsAppTemplateConfig.update({
                where: { id },
                data: {
                    event,
                    templateId,
                    title: title || null,
                    description: description || null,
                    variableMapping: variableMapping || [],
                    triggerDurationValue: Number(triggerDurationValue) || 7,
                    triggerDurationUnit: String(triggerDurationUnit || "DAYS").toUpperCase(),
                    locationId: locId,
                    isActive: Boolean(isActive)
                }
            });
        }
        else {
            // Find existing matching event & location to update or create
            const existing = yield prisma_1.default.whatsAppTemplateConfig.findFirst({
                where: {
                    event,
                    locationId: locId
                }
            });
            if (existing) {
                config = yield prisma_1.default.whatsAppTemplateConfig.update({
                    where: { id: existing.id },
                    data: {
                        templateId,
                        title: title || existing.title,
                        description: description || existing.description,
                        variableMapping: variableMapping || existing.variableMapping,
                        triggerDurationValue: Number(triggerDurationValue) || existing.triggerDurationValue,
                        triggerDurationUnit: String(triggerDurationUnit || existing.triggerDurationUnit).toUpperCase(),
                        isActive: Boolean(isActive)
                    }
                });
            }
            else {
                config = yield prisma_1.default.whatsAppTemplateConfig.create({
                    data: {
                        event,
                        templateId,
                        title: title || null,
                        description: description || null,
                        variableMapping: variableMapping || [],
                        triggerDurationValue: Number(triggerDurationValue) || 7,
                        triggerDurationUnit: String(triggerDurationUnit || "DAYS").toUpperCase(),
                        locationId: locId,
                        isActive: Boolean(isActive)
                    }
                });
            }
        }
        res.json({ message: "Template event configuration saved successfully.", config });
    }
    catch (error) {
        next(error);
    }
});
exports.upsertTemplateConfig = upsertTemplateConfig;
/**
 * Delete a template config
 */
const deleteTemplateConfig = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.whatsAppTemplateConfig.delete({ where: { id: String(id) } });
        res.json({ message: "Template configuration deleted successfully." });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteTemplateConfig = deleteTemplateConfig;
/**
 * Send a custom WhatsApp template message manually with variable values
 */
const sendCustomMessage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { phone, templateName, variables, dynamicMedia } = req.body;
    if (!phone || !templateName) {
        return res.status(400).json({ message: "Phone number and template name are required." });
    }
    try {
        const varArray = Array.isArray(variables)
            ? variables.map(v => String(v !== null && v !== void 0 ? v : ""))
            : ((variables === null || variables === void 0 ? void 0 : variables.body) ? variables.body.map((v) => String(v !== null && v !== void 0 ? v : "")) : []);
        const result = yield messaging_1.TemplateService.getInstance().sendCustomTemplate({
            phone,
            templateName,
            variables: varArray,
            dynamicMedia,
            actorId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            triggerSource: "MANUAL_TEMPLATE_DISPATCH"
        });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error || "Failed to dispatch custom WhatsApp message.",
                result
            });
        }
        res.json({
            success: true,
            message: `Template "${templateName}" dispatched successfully to ${phone}.`,
            result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to dispatch custom WhatsApp message."
        });
    }
});
exports.sendCustomMessage = sendCustomMessage;
