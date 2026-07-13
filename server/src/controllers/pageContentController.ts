import { Request, Response } from "express";
import prisma from "../config/prisma";

const DEFAULT_POLICIES: Record<string, { title: string; content: string }> = {
    "promos": {
        title: "Promotional Offers",
        content: JSON.stringify([
            {
                "id": "promo-1",
                "type": "FREE_DELIVERY",
                "title": "Free Delivery",
                "subtitle": "On orders above ₹499",
                "icon": "Percent",
                "link": "/offers/free-delivery"
            },
            {
                "id": "promo-2",
                "type": "EXPRESS_DELIVERY",
                "title": "Express Delivery",
                "subtitle": "10-20 mins delivery",
                "icon": "Truck",
                "link": "/offers/express-delivery"
            }
        ], null, 2)
    },
    "privacy": {
        title: "Privacy Policy",
        content: `# Privacy Policy
Last Updated: June 25, 2026

Welcome to **Book My Veg**. We value your trust and are committed to protecting your privacy. This Privacy Policy explains how **Book My Veg** ("we", "us", or "our") collects, uses, discloses, and safeguards your information when you use our website (bookmyveg.co.in) and our quick-commerce delivery services.

### 1. Information We Collect
We collect information that is necessary to process and deliver your fresh vegetable orders, including:
- **Personal Details:** Name, phone number, and email address provided during registration.
- **Delivery Address:** Physical address, landmark, city, and GPS coordinates/location to facilitate precision deliveries.
- **Order Details:** Items purchased, transaction totals, and delivery preferences.
- **Usage & Device Data:** IP address, device details, and app usage logs to improve platform performance.

### 2. How We Use Your Information
We utilize your information strictly to support your premium marketplace experience:
- Facilitating checkout, processing payments, and fulfilling vegetable deliveries.
- Sending transaction notifications, OTP verifications, and order status updates via WhatsApp.
- Providing concierge customer service and processing returns.
- Analyzing shopping behavior to refine our seasonal product catalog.

### 3. Information Sharing and Disclosure
We respect your privacy. Your data is only shared in the following scenarios:
- **Delivery Partners:** Disclosing names, phone numbers, and addresses to delivery agents to ensure accurate, quick deliveries.
- **Payment Gateways:** Transmitting transactional context to authorized payment aggregators (e.g., Juspay) to complete secure transactions.
- **Legal Compliance:** Sharing information if required by law or to protect our legal rights.

### 4. Data Security
We implement robust industry-standard electronic, administrative, and physical security measures (including HTTPS encryption) to prevent unauthorized access, alteration, or disclosure of your personal data.

### 5. Your Rights and Controls
You can review, update, or edit your name, contact information, and delivery locations at any time directly through the **Account** page of our application.

### Merchant Legal Registration
- **LEGAL BUSINESS NAME:** Book My Veg
- **REGISTERED ADDRESS:** Plot No. 42, Sector 4, Dwarka, New Delhi - 110075, India
- **CUSTOMER SUPPORT EMAIL:** support@bookmyveg.com
- **BUSINESS CONTACT NUMBER:** +91 77968 33633`
    },
    "terms": {
        title: "Terms & Conditions",
        content: `# Terms & Conditions
Last Updated: June 25, 2026

These Terms & Conditions govern your use of the website (bookmyveg.co.in) and the quick-commerce delivery services offered by **Book My Veg** ("we", "us", or "our"). By accessing or placing an order on our platform, you agree to comply with and be bound by these terms.

### 1. Platform Services
Book My Veg operates a premium quick-commerce marketplace providing fresh, handpicked vegetables and fruits directly to customers. Product specifications, weight, and visual representations are provided as accurately as possible, though slight natural variations in fresh farm produce may occur.

### 2. Registration and Eligibility
Users must be at least 18 years old or legally competent to enter into binding contracts under applicable laws. You are responsible for ensuring the accuracy of your phone number and address details during onboarding.

### 3. Pricing, Ordering, and Payments
- All prices listed on the platform are in Indian Rupees (INR) and are inclusive of GST unless explicitly stated otherwise.
- Payment for orders can be made securely online using Credit/Debit Cards, UPI, Netbanking, or cash on delivery (COD) where available.
- Orders are subject to acceptance by us and product availability in the designated location hub.

### 4. Deliveries and Shipments
We strive to deliver all fresh vegetable orders within the promised timeframe. Deliveries are made to the designated location address provided by the user. If an order is delayed due to weather, traffic, or other unforeseen events, our concierge customer support will contact you.

### 5. Return, Cancellation & Refund Policy
We offer a **100% no-questions-asked refund policy** on fresh produce if quality does not meet our premium standards. Return requests must be initiated within 24 hours of delivery. Once verified, refunds are processed back to the original source payment method or credit wallet within 2-3 business days.

### 6. Governing Law & Jurisdiction
These Terms & Conditions shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.

### Merchant Legal Registration
- **LEGAL BUSINESS NAME:** Book My Veg
- **REGISTERED ADDRESS:** Plot No. 42, Sector 4, Dwarka, New Delhi - 110075, India
- **CUSTOMER SUPPORT EMAIL:** support@bookmyveg.com
- **BUSINESS CONTACT NUMBER:** +91 77968 33633`
    },
    "refund-policy": {
        title: "Exchange & Shipping Policy",
        content: `# Exchange & Shipping Policy
Last Updated: June 25, 2026

At **Book My Veg**, we strive to deliver the freshest quality farm produce to your doorstep. This document outlines our Shipping, Delivery, Cancellation, and Exchange policies.

### 1. Shipping & Delivery Policy
Since we deal in fresh, perishable farm produce, our shipping model is optimized for quick commerce:
- **Delivery Timeline:** All orders are delivered within 30-45 minutes of placement, depending on the distance from the nearest local distribution hub.
- **Delivery Hours:** Delivery operates daily from 6:00 AM to 10:00 PM.
- **Delivery Charges:** Shipping fees are calculated dynamically based on distance and order volume and are clearly listed at checkout before payment.
- **Verification:** To ensure secure deliveries, delivery agents may request an OTP (sent to your registered WhatsApp number) at the time of handover.

### 2. Cancellation & Exchange Policy
- **Cancellation:** You can cancel your order at any time before it is packed or dispatched from our hub. Once dispatched, cancellations cannot be processed.
- **12-Hour Exchange Guarantee:** Due to the perishable nature of fresh vegetables and fruits, all items are non-refundable. However, we offer a 12-hour exchange policy, no questions asked, if you receive any damaged or unsatisfactory produce.
- **Time Limit:** Exchange requests must be initiated within **12 hours** of delivery through the returns section of the application or by contacting our support.

### 3. Exchange Process
Once an exchange request is initiated and approved:
- A delivery executive will be assigned to collect the damaged/unsatisfactory items and hand over the fresh exchange replacement.
- Exchanges are processed within 2-4 hours of request approval, depending on product availability.

### Merchant Legal Registration
- **LEGAL BUSINESS NAME:** Book My Veg
- **REGISTERED ADDRESS:** Plot No. 42, Sector 4, Dwarka, New Delhi - 110075, India
- **CUSTOMER SUPPORT EMAIL:** support@bookmyveg.com
- **BUSINESS CONTACT NUMBER:** +91 77968 33633`
    }
};

export const getPageContent = async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    try {
        let page = await prisma.pageContent.findUnique({
            where: { slug }
        });

        // Initialize with default if it doesn't exist in DB
        if (!page && DEFAULT_POLICIES[slug]) {
            page = await prisma.pageContent.create({
                data: {
                    slug,
                    title: DEFAULT_POLICIES[slug].title,
                    content: DEFAULT_POLICIES[slug].content
                }
            });
        }

        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        res.status(200).json(page);
    } catch (error: any) {
        console.error("Error fetching page content:", error);
        res.status(500).json({ message: "Error fetching page content", error: error.message });
    }
};

export const updatePageContent = async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const { title, content } = req.body;

    if (!content) {
        return res.status(400).json({ message: "Content is required" });
    }

    try {
        const page = await prisma.pageContent.upsert({
            where: { slug },
            update: {
                title: title || DEFAULT_POLICIES[slug]?.title || slug,
                content
            },
            create: {
                slug,
                title: title || DEFAULT_POLICIES[slug]?.title || slug,
                content
            }
        });

        res.status(200).json({ message: "Page updated successfully", page });
    } catch (error: any) {
        console.error("Error updating page content:", error);
        res.status(500).json({ message: "Error updating page content", error: error.message });
    }
};

export const listPageContents = async (req: Request, res: Response) => {
    try {
        let pages = await prisma.pageContent.findMany({
            orderBy: { createdAt: "asc" }
        });

        // Check if any default policies are missing from the DB, and create them
        let updated = false;
        for (const slug of Object.keys(DEFAULT_POLICIES)) {
            if (!pages.find(p => p.slug === slug)) {
                await prisma.pageContent.create({
                    data: {
                        slug,
                        title: DEFAULT_POLICIES[slug].title,
                        content: DEFAULT_POLICIES[slug].content
                    }
                });
                updated = true;
            }
        }

        if (updated) {
            pages = await prisma.pageContent.findMany({
                orderBy: { createdAt: "asc" }
            });
        }

        res.status(200).json(pages);
    } catch (error: any) {
        console.error("Error listing page contents:", error);
        res.status(500).json({ message: "Error listing page contents", error: error.message });
    }
};

export const deletePageContent = async (req: Request, res: Response) => {
    const slug = req.params.slug as string;

    if (DEFAULT_POLICIES[slug]) {
        return res.status(400).json({ message: "System policy pages cannot be deleted" });
    }

    try {
        await prisma.pageContent.delete({
            where: { slug }
        });
        res.status(200).json({ message: "Page deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting page content:", error);
        res.status(500).json({ message: "Error deleting page content", error: error.message });
    }
};

