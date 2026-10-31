import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { TemplateService } from "../modules/messaging";

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
export const getAvailableTemplates = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const templates = await TemplateService.getInstance().syncAndGetTemplates();
        
        const mapped = templates.map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
            status: t.status,
            language: t.language,
            body: t.bodyText,
            variablesCount: t.variableCount,
            exampleVariables: t.raw?.components?.find((c: any) => c.type === "BODY")?.example?.body_text?.[0] || [],
            header: t.headerText || null,
            buttons: t.buttons || [],
            raw: t.raw
        }));

        res.json({
            templates: mapped,
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

        const result = await TemplateService.getInstance().sendCustomTemplate({
            phone,
            templateName,
            variables: varArray,
            dynamicMedia,
            actorId: req.user?.userId,
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
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to dispatch custom WhatsApp message."
        });
    }
};
