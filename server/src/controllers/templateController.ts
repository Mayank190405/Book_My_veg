import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { getMyMetaTemplates, sendTemplateViaChatHub } from "../services/mbgcard";

// Available system events for WhatsApp notification triggers
export const AVAILABLE_TRIGGER_EVENTS = [
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
    }
];

/**
 * Fetch available Meta/ChatHub WhatsApp templates live from API
 */
export const getAvailableTemplates = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        let liveTemplates: any[] = [];
        try {
            const apiRes = await getMyMetaTemplates();
            if (Array.isArray(apiRes)) {
                liveTemplates = apiRes;
            } else if (apiRes && Array.isArray(apiRes.data)) {
                liveTemplates = apiRes.data;
            } else if (apiRes && Array.isArray(apiRes.templates)) {
                liveTemplates = apiRes.templates;
            }
        } catch (apiErr: any) {
            console.warn("[TemplateController] Meta API fetch warning:", apiErr.message);
        }

        // Fallback default templates if API is unreachable or empty
        const defaultTemplates = [
            {
                name: "bill_created",
                category: "UTILITY",
                status: "APPROVED",
                body: "Hello {{1}}, your order #{{2}} of ₹{{3}} was successfully completed via {{4}}. View receipt: {{5}}",
                variablesCount: 5
            },
            {
                name: "bill_created_due",
                category: "UTILITY",
                status: "APPROVED",
                body: "Hello {{1}}, order #{{2}} of ₹{{3}} has an outstanding due of ₹{{4}}. Download invoice: {{5}} or Pay online: {{6}}",
                variablesCount: 6
            },
            {
                name: "due_payment_reminder",
                category: "UTILITY",
                status: "APPROVED",
                body: "Dear {{1}}, you have a pending payment of ₹{{2}} for bill #{{3}}. Please settle your payment using this secure link: {{4}}",
                variablesCount: 4
            },
            {
                name: "customer_inactive_reminder",
                category: "MARKETING",
                status: "APPROVED",
                body: "Hi {{1}}, we miss you at {{2}}! It's been {{3}} days since your last order. Order fresh vegetables today at {{4}} and enjoy special discounts!",
                variablesCount: 4
            },
            {
                name: "vendor_po_dispatch",
                category: "UTILITY",
                status: "APPROVED",
                body: "Hello {{1}}, Purchase Order {{2}} with {{3}} items (₹{{4}}) has been generated by {{5}}. Please deliver to {{6}}. View PO: {{7}}",
                variablesCount: 7
            },
            {
                name: "order_confirmation",
                category: "UTILITY",
                status: "APPROVED",
                body: "Hello {{1}}, your order #{{2}} for ₹{{3}} is confirmed and being packed.",
                variablesCount: 3
            },
            {
                name: "feedback_request",
                category: "MARKETING",
                status: "APPROVED",
                body: "Hello {{1}}, how was your recent order? Please share your feedback here: {{2}}",
                variablesCount: 2
            }
        ];

        const mergedMap = new Map<string, any>();
        defaultTemplates.forEach(t => mergedMap.set(t.name, t));
        liveTemplates.forEach(t => {
            const name = t.name || t.templateName || t.id;
            if (name) {
                mergedMap.set(name, {
                    name,
                    category: t.category || "UTILITY",
                    status: t.status || "APPROVED",
                    body: t.body || t.content || t.template_text || `Template: ${name}`,
                    variablesCount: (t.body?.match(/{{\d+}}/g) || []).length || 0,
                    raw: t
                });
            }
        });

        res.json({
            templates: Array.from(mergedMap.values()),
            availableEvents: AVAILABLE_TRIGGER_EVENTS
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all configured event template triggers (optionally filtered by locationId)
 */
export const getTemplateConfigs = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { locationId } = req.query;
    try {
        const configs = await prisma.whatsAppTemplateConfig.findMany({
            where: {
                ...(locationId ? { OR: [{ locationId: String(locationId) }, { locationId: null }] } : {})
            },
            include: { location: { select: { id: true, name: true, slug: true } } },
            orderBy: { createdAt: "desc" }
        });

        res.json({ configs, availableEvents: AVAILABLE_TRIGGER_EVENTS });
    } catch (error) {
        next(error);
    }
};

/**
 * Create or update a template event configuration (No-Code Configurator)
 */
export const upsertTemplateConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const {
        id,
        event,
        templateId,
        title,
        description,
        variableMapping,
        triggerDurationValue = 7,
        triggerDurationUnit = "DAYS",
        locationId,
        isActive = true
    } = req.body;

    if (!event || !templateId) {
        return res.status(400).json({ message: "event and templateId are required." });
    }

    try {
        const locId = locationId && locationId !== "GLOBAL" ? String(locationId) : null;

        let config;
        if (id) {
            config = await prisma.whatsAppTemplateConfig.update({
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
        } else {
            // Find existing matching event & location to update or create
            const existing = await prisma.whatsAppTemplateConfig.findFirst({
                where: {
                    event,
                    locationId: locId
                }
            });

            if (existing) {
                config = await prisma.whatsAppTemplateConfig.update({
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
            } else {
                config = await prisma.whatsAppTemplateConfig.create({
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
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a template config
 */
export const deleteTemplateConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        await prisma.whatsAppTemplateConfig.delete({ where: { id: String(id) } });
        res.json({ message: "Template configuration deleted successfully." });
    } catch (error) {
        next(error);
    }
};

/**
 * Send a custom WhatsApp template message manually with variable values
 */
export const sendCustomMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { phone, templateName, variables, dynamicMedia } = req.body;

    if (!phone || !templateName) {
        return res.status(400).json({ message: "Phone number and template name are required." });
    }

    try {
        const varArray = Array.isArray(variables) 
            ? variables.map(v => String(v ?? "")) 
            : (variables?.body ? variables.body.map((v: any) => String(v ?? "")) : []);

        const result = await sendTemplateViaChatHub(
            phone,
            templateName,
            { body: varArray },
            dynamicMedia
        );

        res.json({
            success: true,
            message: `Template "${templateName}" dispatched successfully to ${phone}.`,
            result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to dispatch custom WhatsApp message."
        });
    }
};
