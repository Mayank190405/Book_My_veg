/**
 * Book My Veg — Verified WhatsApp Template Registry
 * Captured and verified directly against live MBG Card / Meta WhatsApp Cloud API
 */

import { TemplateDefinition } from "../domain/notification.types";

export const VERIFIED_TEMPLATES: Record<string, TemplateDefinition> = {
    feedback_request_support_: {
        id: "2182324349387980",
        name: "feedback_request_support_",
        status: "APPROVED",
        category: "UTILITY",
        language: "en",
        variableCount: 1,
        bodyText: "Hello {{1}},  \nThank you for shopping with book my veg. We would love to hear your feedback on your recent purchase. Your insights help us improve and serve you better. If there’s anything specific you’d like to discuss, we’re all ears!",
        buttons: [{ type: "QUICK_REPLY", text: "Chat with Us" }]
    },
    order_management_4: {
        id: "1122769370423073",
        name: "order_management_4",
        status: "APPROVED",
        category: "UTILITY",
        language: "en",
        variableCount: 2,
        bodyText: "Hi {{1}},\nYour order has been successfully placed and is being processed. Your order number is {{2}}. You can view order details below.",
        buttons: [{ type: "QUICK_REPLY", text: "View order" }]
    },
    payment_due_reminder: {
        id: "1683921576014767",
        name: "payment_due_reminder",
        status: "APPROVED",
        category: "UTILITY",
        language: "en",
        variableCount: 4,
        bodyText: "Hi {{1}}, your {{2}} bill of {{3}} is due on {{4}}. Pay now to avoid service disruption.",
        buttons: [{ type: "QUICK_REPLY", text: "Pay now" }]
    },
    payment_confirmation_update: {
        id: "1814552173245816",
        name: "payment_confirmation_update",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 1,
        bodyText: "Hello {{1}},  \n\nThank you for your payment! Your transaction was successful, and your fresh produce is being prepared for delivery. We appreciate your trust in us and look forward to serving you again soon",
        buttons: [{ type: "QUICK_REPLY", text: "Chat with Us" }]
    },
    order_update_notification: {
        id: "2360388174767694",
        name: "order_update_notification",
        status: "APPROVED",
        category: "UTILITY",
        language: "en",
        variableCount: 1,
        bodyText: "Hi {{1}},  \n\nYour order of fresh fruits and vegetables is on its way! We are committed to providing top-quality produce directly to your doorstep. Keep an eye out for our delivery partner, who will be there soon.  \n\nHave questions?",
        buttons: [{ type: "QUICK_REPLY", text: "Chat with Us" }]
    },
    book_my_veg_catalog: {
        id: "980878774963987",
        name: "book_my_veg_catalog",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 1,
        bodyText: "🥦 Book My Veg – Freshness Delivered Daily! 🥕\n\nHi {{1}} 👋\n\nOur latest Fresh Fruits & Vegetables Catalog is now updated! 🛒✨\n\nCheck out our latest products and updated prices in the Book My Veg Catalog.\n\nTap View Catalog below to explore. 👇\nhttps://wa.me/c/918380833633\n\nThank you for choosing Book My Veg ❤️"
    },
    payment_received: {
        id: "2920172081651151",
        name: "payment_received",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 4,
        bodyText: "**✅ Payment Received**\n\nHi {{1}},\n\nWe've successfully received your payment.\n\n**Invoice No.:** **{{2}}**\n**Amount Paid:** **₹{{3}}**\n**Payment Mode:** **{{4}}**\n\nThank you for completing your payment. We appreciate your business and look forward to serving you again.\n\n**– Team Book My Veg**"
    },
    due_payment_reminder: {
        id: "2208881589845572",
        name: "due_payment_reminder",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 4,
        bodyText: "**💳 Payment Reminder**\n\nHi {{1}},\n\nThis is a friendly reminder that payment for your invoice is still pending.\n\n**Outstanding Amount:** **₹{{2}}**\n**Invoice No.:** **{{3}}**\n\nPlease clear your dues using the secure payment link below:\n\n💳 {{4}}\n\nIf you've already made the payment, please ignore this message.\n\nThank you for choosing **Book My Veg**.\n\n**– Team Book My Veg**"
    },
    bill_created_due: {
        id: "902519702404619",
        name: "bill_created_due",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 6,
        bodyText: "Hello {{1}}, order #{{2}} of ₹{{3}} has an outstanding due of ₹{{4}}. Download invoice: {{5}} or Pay online: {{6}}"
    },
    bill_created: {
        id: "1806180457040159",
        name: "bill_created",
        status: "APPROVED",
        category: "UTILITY",
        language: "en",
        variableCount: 5,
        bodyText: "**🧾 Invoice Generated**\n\nHi {{1}},\n\nThank you for shopping with **Book My Veg**.\n\nYour invoice has been generated successfully.\n\n**Invoice Details**\n• Invoice No.: **{{2}}**\n• Total Amount: **₹{{3}}**\n• Payment Mode: **{{4}}**\n• Payment Status: **Paid**\n\n📄 Download your invoice:\n{{5}}\n\nWe appreciate your business and look forward to serving you again.\n\n– Team Book My Veg"
    },
    feedback_request: {
        id: "4432032500391264",
        name: "feedback_request",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 2,
        bodyText: "Hello {{1}}, how was your recent order? Please share your feedback here: {{2}}"
    },
    order_status_update: {
        id: "1327576902464436",
        name: "order_status_update",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 3,
        bodyText: "Hello {{1}}, your order #{{2}} status has been updated to: {{3}}"
    },
    order_confirmation: {
        id: "3232810423583694",
        name: "order_confirmation",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 3,
        bodyText: "**🛒 Thank You for Your Order!**\n\nHi {{1}},\n\nThank you for shopping with *Book My Veg*! Your order has been placed successfully.\n\n*Order Details*\n• Order ID: *#{{2}}*\n• Total Order Value: *₹{{3}}*\n\nWe'll keep you updated as your order progresses.\n\nThank you for choosing *Book My Veg*!",
        buttons: [{ type: "URL", text: "Track order here", url: "https://bookmyveg.co.in/orders" }]
    },
    registration_thank_you: {
        id: "1024413420195362",
        name: "registration_thank_you",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 1,
        bodyText: "*🥬 Welcome to Book My Veg!*\n\nHi {{1}} ,\n\nThank you for registering with *Book My Veg*! 🌿\n\nYour account has been created successfully.\n\nYou can now browse fresh vegetables, fruits, groceries, and more—all delivered to your doorstep.\n\nWe're excited to serve you with fresh products and a seamless shopping experience.",
        buttons: [{ type: "URL", text: "Start shopping today", url: "https://bookmyveg.co.in/" }]
    },
    login: {
        id: "1395022896009561",
        name: "login",
        status: "APPROVED",
        category: "AUTHENTICATION",
        language: "en",
        variableCount: 1,
        bodyText: "*{{1}}* is your verification code. For your security, do not share this code.",
        buttons: [{ type: "URL", text: "Copy code", url: "https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=otp{{1}}" }]
    },
    onboarding: {
        id: "968898452711264",
        name: "onboarding",
        status: "REJECTED",
        category: "MARKETING",
        language: "en",
        variableCount: 1,
        bodyText: "We are Delighted to have you on board \nLogin with  {{1}}.\nThank You!"
    },
    fresh_order: {
        id: "2043890706505421",
        name: "fresh_order",
        status: "APPROVED",
        category: "MARKETING",
        language: "hi",
        variableCount: 1,
        bodyText: "Ekdum fresh fruits aur vegetables chahiye? Fikr mat karo, hum hain na! 🍉🍅\n\nGhar baithe fresh maal order karne ke liye hamara live catalog dekhein aur turant apna order place karein.\n\nShop now through {{1}} 🛒",
        buttons: [{ type: "QUICK_REPLY", text: "order now" }]
    },
    offer: {
        id: "1685848749276095",
        name: "offer",
        status: "APPROVED",
        category: "MARKETING",
        language: "en",
        variableCount: 2,
        bodyText: "Welcome to Book my veg {{1}} {{2}}\nplease oder us"
    }
};

export class TemplateRegistry {
    private static instance: TemplateRegistry;
    private templates: Map<string, TemplateDefinition> = new Map();

    private constructor() {
        // Initialize with verified static dictionary
        for (const [key, tpl] of Object.entries(VERIFIED_TEMPLATES)) {
            this.templates.set(key, tpl);
        }
    }

    public static getInstance(): TemplateRegistry {
        if (!TemplateRegistry.instance) {
            TemplateRegistry.instance = new TemplateRegistry();
        }
        return TemplateRegistry.instance;
    }

    public getTemplate(name: string): TemplateDefinition | undefined {
        return this.templates.get(name);
    }

    public getAllTemplates(): TemplateDefinition[] {
        return Array.from(this.templates.values());
    }

    public registerOrUpdateTemplate(tpl: TemplateDefinition): void {
        this.templates.set(tpl.name, tpl);
    }

    public isApproved(name: string): boolean {
        const tpl = this.templates.get(name);
        return tpl !== undefined && tpl.status === "APPROVED";
    }

    public getCategory(name: string): string | undefined {
        return this.templates.get(name)?.category;
    }

    public getUtilityTemplates(): TemplateDefinition[] {
        return this.getAllTemplates().filter(t => t.category === "UTILITY");
    }

    public isApprovedUtilityTemplate(name: string): boolean {
        const tpl = this.templates.get(name);
        return tpl !== undefined && tpl.status === "APPROVED" && tpl.category === "UTILITY";
    }

    public isTemplateAllowed(name: string): boolean {
        const tpl = this.templates.get(name);
        return tpl !== undefined && tpl.status === "APPROVED";
    }
}

