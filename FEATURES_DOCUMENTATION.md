# Book My Veg (BMV) — Complete Software Features Specification

## 1. Executive Summary
**Book My Veg (BMV)** is an enterprise-grade, hyper-local grocery e-commerce, in-store Point of Sale (POS), warehouse fulfillment, multi-location inventory, and logistics ecosystem. It bridges physical counter billing and digital e-commerce under a single, real-time PostgreSQL database with synchronized stock, dynamic pricing rules, and multi-role operations.

---

## 2. Feature Matrix by Portal & Subsystem

### 2.1. Online Consumer Storefront (Web & Mobile PWA)
*Primary Routes: `/`, `/category/[id]`, `/products/[id]`, `/cart`, `/checkout`, `/account`*

* **Fast Full-Text Search**: Sub-millisecond, typo-tolerant catalog search powered by MeiliSearch, supporting product titles, tags, categories, SKUs, and barcodes.
* **Hierarchical Category Navigation**: Multi-level nested categories with breadcrumbs and fast filtering.
* **Fractional & Pack Product Variants**: Selection of granular weights and package units (e.g., 250g, 500g, 1kg, bunch, piece, crate).
* **Delivery Slot Management**: Interactive scheduling allowing customers to choose preferred delivery dates and morning/evening fulfillment windows.
* **Smart Shopping Cart**: Persistent Zustand client state synced with server cart sessions, with minimum order validation and automatic delivery fee calculation.
* **Discount & Coupon Engine**: Application of promotional promo codes, cart-level thresholds, percentage/flat discounts, and maximum discount caps.
* **Multi-Gateway Payment Integration**:
  * **Razorpay**: Native UPI, card, and net-banking checkout with cryptographic webhook signature verification.
  * **Easebuzz**: Express checkout links and redirect flow.
  * **Cash on Delivery (COD)**: Configurable threshold rules with doorstep collection tracking.
  * **Idempotency Protection**: Unique `idempotencyKey` per checkout session prevents duplicate transactions during network retries.
* **Live Order Tracking**: Real-time order progress stepper (`PENDING` ➔ `CONFIRMED` ➔ `PACKED` ➔ `OUT_FOR_DELIVERY` ➔ `DELIVERED`).
* **Digital Invoices & Receipts**: Downloadable and printable PDF invoices generated directly from user order history.
* **Customer Profile & Address Book**: Multi-address management with geolocation pins, landmark tags, and default address selection.
* **Real-Time Customer Support**: Direct in-app live chat widget powered by Socket.IO, connecting consumers to live support representatives.
* **Customer Feedback & Review System**: Post-delivery automated rating and review submission for produce quality assessment.

---

### 2.2. In-Store Point of Sale (POS) Counter System
*Primary Route: `/pos`*

* **Cashier Shift Lifecycle & Float Audit**:
  * Cashier shift opening requiring starting drawer float declaration (e.g., ₹2,000).
  * Real-time tracking of cash, UPI, and credit collections throughout the shift.
  * Shift closing reconciliation: Compares physical drawer cash against calculated balances, logging shift variances and supervisor audit trails.
* **Rapid Counter Checkout (<10 Seconds)**:
  * Full keyboard shortcut navigation designed for touchscreens and physical keyboards.
  * USB/Bluetooth barcode scanner auto-focus and manual quick-code lookup.
  * Scale-accurate weight input supporting high decimal precision (e.g., 1.425 kg).
* **Payment Modalities**:
  * Cash billing with quick-tender buttons and automated change-due calculation.
  * Dynamic counter UPI QR code generation on-screen for instant scan-and-pay.
  * Split payments and customer store credit redemption.
* **Hardware Thermal Printing**:
  * Direct 80mm Esc/POS thermal receipt printing stream.
  * Configurable store branding, GST breakdown, HSN numbers, and custom footer return policies.
* **Channel-Specific Price Isolation**: POS operates on dedicated counter pricing rules independent of online e-commerce rates.

---

### 2.3. Warehouse Fulfillment & Packing Hub
*Primary Route: `/packer`*

* **Real-Time Packing Queue**: Incoming delivery orders sorted chronologically by assigned delivery slot priority.
* **Interactive Picking Checklist**: Line-by-line verification ensuring packers pick correct produce variants and verified weights.
* **Fulfillment Exceptions & Notes**: Option to annotate substitutions, out-of-stock items, or customer packing preferences.
* **Mandatory Photo Proof**: Requirement to capture and upload photographic proof of packed items prior to dispatch to eliminate missing-item disputes.
* **Atomic State Dispatch**: Marks orders as `PACKED`, triggering dispatch alerts and notifying assigned delivery personnel.

---

### 2.4. Last-Mile Logistics & Driver Portal
*Primary Route: `/driver`*

* **Order Dispatch & Route Manifest**: Real-time assignment list of pending deliveries filtered by driver and geographical area.
* **One-Click Turn-by-Turn Navigation**: Direct handoff to native mapping apps for destination coordinates and landmark guidance.
* **Secure OTP Hand-Off Protocol**: Delivery handover requires driver verification using a 4-digit OTP sent to the customer's phone.
* **Doorstep Photo Proof**: Driver uploads a doorstep delivery photograph before completing delivery.
* **Cash on Delivery (COD) Reconciliation**: Logs collected cash amounts, automatically reconciling with daily cashier balances.

---

### 2.5. Multi-Store Inventory, Spoilage & Vendor Management
*Primary Routes: `/admin/inventory`, `/admin/vendors`, `/admin/purchase-orders`*

* **Multi-Location Inventory Balancing**: Centralized stock levels across physical retail stores and regional distribution warehouses.
* **Atomic Database Transactions**: Prisma `$transaction` guarantees that counter sales and online orders never cause stock overselling or race conditions.
* **Automated Low-Stock Thresholds**: Instant UI badges and notifications when stock falls below configured safety buffers.
* **Produce Mortality & Shrinkage Logging**:
  * Dedicated wastage ledger logging spoiled, rotten, or transit-damaged produce weight.
  * Automatic deduction from live inventory with financial shrinkage reporting.
* **Vendor & Purchase Order (PO) Management**:
  * Supplier directories with contact information, payment terms, and supply histories.
  * Inward purchase orders, weight intake verification, and restock records.

---

### 2.6. Operations & Administration Control Hub
*Primary Routes: `/admin/*`*

* **Executive Dashboard & Business Intelligence**:
  * Real-time metrics: Gross merchandise value (GMV), net margins, average order value (AOV), and customer retention.
  * Channel analytics comparing POS counter revenue vs Online PWA volume.
  * Fast-moving produce rankings, category velocity, and waste-loss ratios.
* **Catalog & Master Data Management**:
  * Product creation with tax codes (HSN/GST), barcodes, weight units (`KG`, `GM`, `LTR`, `ML`, `PIECE`, `PACKET`), and nutritional data.
  * Variant management with individual pricing, SKUs, and packaging sizes.
* **Promotional Banners & Marketing**:
  * Homepage hero banners, festive announcement ribbons, and seasonal campaign carousels.
* **Geofencing & Store Management**:
  * Branch management (`/admin/stores`) with custom GPS coordinates, delivery radius (km), operational hours, and emergency open/close toggles.
* **Notification Automation & WhatsApp Engine**:
  * Integration with Meta WhatsApp Cloud / MBG Card API with automatic retry and exponential backoff.
  * Automated WhatsApp alerts for OTPs, order placement, packing completion, out-for-delivery, and invoices.
* **Staff Attendance & Payroll Oversight**:
  * Employee clock-in and clock-out logs with manager approvals and monthly attendance summaries (`/admin/attendance`).
* **Petty Cash & Store Expense Management**:
  * Tracking of operational store expenses (rent, utilities, packaging materials) with receipt image uploads (`/admin/expenses`).
* **Live Customer Support Desk (`/admin/chat`)**:
  * Multi-agent ticket management with live WebSocket chat routing directly to customers.
* **Developer API Console & Audit Logs**:
  * Interactive diagnostics console for API endpoint testing and webhook simulation (`/admin/api-console`).

---

## 3. Role-Based Access Control (RBAC) Matrix

| User Role | Primary Portal | Access Scope |
| :--- | :--- | :--- |
| `USER` | Web / PWA App | Browse, Cart, Checkout, Order Tracking, Chat, Feedback |
| `POS_OPERATOR` | POS Terminal (`/pos`) | Open/Close Shift, Barcode Scan, Weight Entry, Bill Print |
| `PACKING` | Warehouse (`/packer`) | Packing Queue, Item Verification, Photo Proof Upload |
| `DELIVERY_PARTNER` | Driver App (`/driver`) | Delivery Manifest, GPS Navigation, OTP Hand-Off, COD Collection |
| `MANAGER` | Admin Sub-Panel | Store Stock, Cashier Shift Audits, Spoilage Logs, Attendance |
| `STORE_ADMIN` | Store Admin (`/admin`) | Branch Inventory, Store Expenses, Local Staff Management |
| `CENTER_HEAD` | Multi-Store Admin | Multi-Branch Metrics, Regional Spoilage, Inter-Store Transfers |
| `ADMIN` | Super Admin (`/admin`) | Full System Control, Catalog, Pricing Rules, Global RBAC, API Keys |

---

## 4. Technical Architecture & DevOps

* **Frontend**: Next.js 16 (App Router), React 19, TypeScript, TailwindCSS v4, Zustand 5, TanStack Query v5.
* **Backend**: Express 5 on Node.js, TypeScript, Prisma ORM 7, PostgreSQL 16.
* **Search Engine**: MeiliSearch (sub-millisecond full-text search).
* **Real-Time Layer**: Socket.IO clustered with `@socket.io/redis-adapter` for multi-instance scaling.
* **Background Queues**: Redis Bull Queue for asynchronous auto-cancellations, payment timeouts, and notification workers.
* **DevOps**: Docker Compose multi-container stack, Nginx reverse proxy with SSL termination, and automated zero-downtime deployment pipelines for AWS EC2/ECR.
