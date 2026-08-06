# Book My Veg (BMV) — Complete Technical & Architectural Specification Document

## Table of Contents
1. [Executive Summary & Ecosystem Overview](#1-executive-summary--ecosystem-overview)
2. [Types of Users & Access Control Permission Matrix](#2-types-of-users--access-control-permission-matrix)
3. [End-to-End User Journeys](#3-end-to-end-user-journeys)
4. [Deep Backend Architecture & Component Layering](#4-deep-backend-architecture--component-layering)
5. [Full Technology Stack & Component Engineering Rationale](#5-full-technology-stack--component-engineering-rationale)
6. [Exhaustive Database Model Schema Specifications (Prisma ORM)](#6-exhaustive-database-model-schema-specifications-prisma-orm)
7. [Complete Backend API Endpoint & Middleware Map](#7-complete-backend-api-endpoint--middleware-map)
8. [End-to-End Operational Workflows & Sequence Architecture](#8-end-to-end-operational-workflows--sequence-architecture)
9. [In-Depth Analysis of Problems Solved by the Platform](#9-in-depth-analysis-of-problems-solved-by-the-platform)
10. [System Performance, Security & Engineering Highlights](#10-system-performance-security--engineering-highlights)
11. [DevOps, Containerization & AWS Infrastructure Blueprint](#11-devops-containerization--aws-infrastructure-blueprint)

---

## 1. Executive Summary & Ecosystem Overview

**Book My Veg (BMV)** is a multi-tier, hyper-local grocery e-commerce, Point of Sale (POS), multi-location inventory lifecycle, warehouse fulfillment, and logistics management ecosystem. It seamlessly unifies consumer online ordering with physical retail counter operations in real time.

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │                  BOOK MY VEG ECOSYSTEM                 │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
        ┌───────────────────────────┬─────────────────────────┼───────────────────────────┬───────────────────────────┐
        ▼                           ▼                         ▼                           ▼                           ▼
  [ CONSUMER WEB / PWA ]    [ IN-STORE POS ]          [ ADMIN CONTROL HUB ]      [ WAREHOUSE FULFILLMENT ]    [ SUPPORT & FEEDBACK ]
  * Instant Search          * Fast Barcode Scan       * Store Analytics          * Order Packing Queue        * 2-Way Real-time Chat
  * Category Navigation     * Weight Scale Inputs     * Inventory & Batches      * Photo Proof Upload         * Post-Delivery SMS
  * Delivery Slots          * Channel Pricing         * Produce Mortality Logs   * Driver Route & OTP         * Rating & Review System
  * Multi-Gateway Checkout  * Cashier Shift Audits    * Expense & Payroll        * Cash Collection Tracking   * Automated Reminders
  * Live Order Tracking     * Thermal Printing        * RBAC & Audit Trails      * Hand-Off Protocol          * Instant Support Hub
```

### Philosophy & Core Mission
Traditional grocery operations struggle with disconnected software systems: physical stores use standalone desktop POS software while online orders are handled by separate e-commerce platforms. This leads to **stock overselling**, **unmonitored inventory spoilage**, **cashier cash discrepancies**, and **manual reconciliation delays**.

BMV solves this by placing a single PostgreSQL database with Prisma ORM at the core of all operations. Whether a packet of spinach is scanned at a physical store counter or purchased via the mobile PWA app, stock levels update atomically, prices recalculate per channel, and order workflows transition across all devices instantly.

---

## 2. Types of Users & Access Control Permission Matrix

The platform categorizes users into 8 distinct roles defined in the system (`enum Role`):

```
+---------------------------------------------------------------------------------------------------+
|                                  USER ROLES & PORTAL ACCESS MATRIX                                |
+------------------+-----------------------+--------------------------+-----------------------------+
| Role Enum        | User Type Description | Primary Portal Access    | Key Authorization Scope     |
+------------------+-----------------------+--------------------------+-----------------------------+
| USER             | Online Customer       | Web / Mobile PWA App     | Cart, Checkout, Profile     |
| POS_OPERATOR     | Store Cashier         | POS Terminal (/pos)      | Cashier Shift, Counter Bill |
| PACKING          | Warehouse Packer      | Packer Portal (/packer)  | Packing Queue, Photo Proof  |
| DELIVERY_PARTNER | Delivery Driver       | Driver App (/driver)     | Route, OTP Handoff, Cash    |
| MANAGER          | Store Manager         | Admin Sub-Panel          | Store Stock, Shift Audits   |
| STORE_ADMIN      | Location Head         | Admin Panel (/admin)     | Store Inventory, Expenses   |
| CENTER_HEAD      | Regional Manager      | Multi-Store Dashboard    | Multi-Location Oversight    |
| ADMIN            | Super Administrator   | Full Admin Portal        | System Configuration, RBAC  |
+------------------+-----------------------+--------------------------+-----------------------------+
```

### 1. Online Customer (`USER`)
* End consumer accessing the public web portal or PWA app.
* Permissions: Browse catalog, search products, add items to cart, select delivery slots, apply coupons, initiate payments, track orders, chat with support, submit ratings/reviews.

### 2. In-Store Walk-in Customer (Guest / Linked `USER`)
* Counter buyer in physical stores. Can purchase anonymously or link their phone number for loyalty points and digital SMS receipts.

### 3. Store Cashier (`POS_OPERATOR`)
* Staff operating the Point of Sale terminal.
* Permissions: Open cashier shift float, scan barcodes, adjust weights/quantities, apply counter discounts, accept Cash/UPI/Credit payments, print thermal receipts, perform shift closing cash reconciliation.

### 4. Warehouse Packer (`PACKING`)
* Warehouse staff responsible for item picking and packing.
* Permissions: View pending orders, scan/check line items into bags, record packer notes, capture and upload packing photo proof, mark orders `PACKED`.

### 5. Delivery Partner (`DELIVERY_PARTNER`)
* Courier/driver responsible for last-mile delivery.
* Permissions: View assigned delivery routes, navigate to customer address, request customer OTP verification, capture delivery photo proof, mark orders `DELIVERED`, collect Cash on Delivery.

### 6. Store Manager (`MANAGER`) & Location Head (`STORE_ADMIN`)
* Managers overseeing a specific physical store or warehouse location.
* Permissions: Monitor local stock levels, receive low-stock alerts, record produce mortality/spoilage, review cashier shift float variances, manage store expenses, approve staff attendance.

### 7. Regional Center Head (`CENTER_HEAD`)
* Executive overseeing multiple store locations within a region.
* Permissions: Compare multi-store revenue metrics, transfer stock between locations, evaluate store operational expenses, review regional mortality logs.

### 8. Super Administrator (`ADMIN`)
* Master system administrator with unrestricted permissions.
* Permissions: Full database access, catalog creation, global pricing policies, user role assignment, integration API keys, security incident monitoring, system audit log viewing.

---

## 3. End-to-End User Journeys

### Journey 1: Online Consumer Grocery Purchase & Delivery
```
 1. Discover & Search ──► Customer opens PWA / Web app. Uses MeiliSearch to find "Organic Tomatoes".
 2. Add to Cart      ──► Selects 1 kg variant. Web pricing rule applies. Cart updates in Zustand store.
 3. Checkout         ──► Selects home address, delivery date, and 10 AM - 12 PM time slot. Applies coupon.
 4. Payment          ──► Chooses Razorpay/Easebuzz. Backend enforces idempotencyKey. Transaction verifies via Webhook.
 5. Packing          ──► Packer receives alert, picks tomatoes, uploads bag photo proof, marks 'PACKED'.
 6. Delivery         ──► Driver arrives, customer receives OTP via SMS, provides OTP to driver for status update.
 7. Feedback         ──► Customer receives automated SMS feedback link, rates order 5 stars.
```

### Journey 2: In-Store Walk-In Counter Purchase (POS)
```
 1. Shift Opening    ──► Cashier logs into `/pos`, enters starting cash float (e.g., ₹2,000) to open shift.
 2. Item Scanning    ──► Customer brings items to counter. Cashier scans barcode or enters item code.
 3. Weight Adjustment──► Cashier places loose produce on scale, enters exact weight (e.g., 1.425 kg).
 4. Payment Selection──► Cashier selects payment mode (Cash / Dynamic Counter UPI QR / Customer Store Credit).
 5. Settlement       ──► If Cash: enters cash tendered (e.g., ₹500), system displays change due (e.g., ₹75).
 6. Bill Print       ──► POS triggers Esc/POS thermal print stream to 80mm printer. Stock deducts immediately.
 7. Shift Closing    ──► Shift end: Cashier counts drawer cash, submits totals. System flags zero cash variance.
```

### Journey 3: Store Manager Spoilage & Mortality Logging
```
 1. Inspection       ──► Manager inspects vegetable racks and identifies 3 kg of damaged tomatoes.
 2. Portal Logging   ──► Navigates to `/admin/inventory/mortality` in Admin Portal.
 3. Submission       ──► Selects product, enters 3.000 KG weight, selects reason "Rotten / Perishable Waste".
 4. Reconciliation   ──► System deducts 3 kg from local `Inventory` and logs loss value in financial reports.
```

### Journey 4: Customer Support Agent Live Help
```
 1. Help Request     ──► Customer clicks "Chat with Support" on active order page.
 2. Socket Connection──► Socket.IO connects user to support room (`chat_order_<id>`).
 3. Support Alert    ──► Support Agent receives browser alert in Admin Chat Hub (`/admin/chat`).
 4. Resolution       ──► Agent sends real-time messages, resolves query, marks ticket 'RESOLVED'.
```

---

## 4. Deep Backend Architecture & Component Layering

The server follows a clean **N-Tier Layered Architecture** built on Express 5, TypeScript, and Prisma ORM:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT REQUEST (HTTP / WSS)                             │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ NGINX REVERSE PROXY (SSL Termination, Rate Limiting, Static Asset Caching /uploads)    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS 5 ROUTER & MIDDLEWARE PIPELINE                                                 │
│  ├── requestLogger.ts (Winston logging)                                                │
│  ├── rateLimiter.ts (Redis sliding-window rate limiting)                               │
│  ├── helmet (HTTP Security headers) & cors                                             │
│  ├── authenticate.ts (JWT bearer token extraction & verification)                      │
│  └── authorize.ts (Role-Based Access Control RBAC verification)                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CONTROLLER LAYER (src/controllers/)                                                    │
│  ├── Order, Payment, POS, Product, Inventory, User, Category Controllers               │
│  └── Validates payloads with Zod, invokes services, formats JSON responses             │
└───────────────┬───────────────────────────┬────────────────────────────┬───────────────┘
                │                           │                            │
                ▼                           ▼                            ▼
┌───────────────────────────────┐ ┌───────────────────────────┐ ┌────────────────────────┐
│ SERVICE & ENGINE LAYER        │ │ REAL-TIME SOCKET LAYER    │ │ ASYNC QUEUE DAEMON     │
│  ├── SearchService            │ │  ├── socketHandler.ts     │ │  ├── Bull Queue        │
│  │   (MeiliSearch Indexer)    │ │  ├── Redis Adapter        │ │  │   (autoCancelQueue) │
│  ├── metricsFlushWorker       │ │  │   (Socket Scaling)     │ │  ├── paymentReminder   │
│  └── paymentReminderWorker    │ │  └── Live Event Push      │ │  └── Metrics Daemon    │
└───────────────┬───────────────┘ └─────────────┬─────────────┘ └───────────┬────────────┘
                │                               │                          │
                └───────────────────────────────┼──────────────────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ DATA ACCESS LAYER (Prisma ORM 7 + PostgreSQL 16)                                       │
│  ├── @prisma/adapter-pg (Native PostgreSQL Connection Pool)                            │
│  ├── Atomic Transactions ($transaction)                                                │
│  └── Strongly typed database queries                                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **Edge Router Layer (Nginx)**: Proxies incoming HTTP requests, handles SSL termination, applies Gzip compression, caches uploads, routes WebSocket connections.
2. **Middleware Pipeline Layer**:
   - `requestLogger`: Logs every incoming HTTP request method, URI, status code, and latency using Winston.
   - `rateLimiter`: Protects public routes against denial-of-service (DoS) attacks using Redis sliding-window counters.
   - `authenticate`: Extracts JWT from `Authorization` header or HTTP-only cookie and attaches decoded `user` context to Express `req`.
   - `authorize(allowedRoles)`: Enforces RBAC permissions, rejecting unauthorized requests with `403 Forbidden`.
3. **Controller Layer**: Decouples HTTP request/response handling from data storage logic. Validates Zod request schemas, calls internal services, and returns formatted JSON responses.
4. **Service & Engine Layer**: Handles heavy domain logic:
   - `SearchService`: Syncs product catalog changes with MeiliSearch indexer.
   - `PaymentService`: Verifies cryptographic payment signatures with Razorpay and Easebuzz APIs.
5. **Real-Time Socket Layer**: Manages WebSocket connections via Socket.IO. Integrates `@socket.io/redis-adapter` so multi-instance Node servers publish and receive room broadcasts seamlessly.
6. **Async Queue Daemon Layer**: Redis-backed Bull queue worker handles long-running jobs (auto-cancelling unpaid orders after timeout, dispatching feedback SMS reminders) without blocking Express HTTP handlers.
7. **Data Access Layer (Prisma ORM & PostgreSQL)**: Executes type-safe queries against PostgreSQL 16. Uses Prisma `$transaction` blocks to guarantee atomic stock reservation and financial logging.

---

## 5. Full Technology Stack & Component Engineering Rationale

### 🚀 Frontend Stack
* **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) with [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [TailwindCSS v4](https://tailwindcss.com/) + Custom Design Tokens + [Radix UI / Shadcn UI](https://ui.shadcn.com/) + [Lucide Icons](https://lucide.dev/)
* **State Management**: [Zustand 5](https://github.com/pmndrs/zustand) (transient client/POS state) + [TanStack React Query v5](https://tanstack.com/query/latest) (server state caching)
* **Real-time Engine**: [Socket.IO Client](https://socket.io/), [HTML5 QR Code Scanner](https://github.com/mebjas/html5-qrcode), [jsPDF](https://github.com/parallax/jsPDF), [next-pwa](https://github.com/shadowwalker/next-pwa).

### ⚙️ Backend Stack
* **Server Framework**: [Express.js 5](https://expressjs.com/) on Node.js with TypeScript
* **ORM & Database**: [Prisma ORM 7](https://www.prisma.io/) + PostgreSQL 16 with `@prisma/adapter-pg`
* **Search Engine**: [MeiliSearch 0.33](https://www.meilisearch.com/) for sub-millisecond full-text search.
* **Cache & Message Broker**: [Redis 5](https://redis.io/) for Socket.IO Redis adapter scaling, rate limiting, and session management.
* **Queue Workers**: [Bull Queue](https://github.com/OptimalBits/bull) for background task daemons.

---

## 6. Exhaustive Database Model Schema Specifications (Prisma ORM)

```
[ User ] ───< [ Order ] ───< [ OrderItem ] >─── [ Product ] ───< [ Inventory ] >─── [ Location ]
   │              │                                    │
   ├──< [ Address ]├───< [ Payment ]                   ├───< [ ProductVariant ]
   │              │                                    │
   └──< [ Shift ] └───< [ OrderStatusHistory ]        └───< [ MortalityLog ]
```

### Key Models & Technical Definitions

1. **`User`**: Core user account entity supporting roles (`USER`, `POS_OPERATOR`, `PACKING`, `DELIVERY_PARTNER`, `MANAGER`, `STORE_ADMIN`, `CENTER_HEAD`, `ADMIN`). Tracks authentication, phone, email, base salary, total credit due, and shift relations.
2. **`Address`**: Delivery addresses with landmarks, GPS coordinates, pincode, and default flags.
3. **`Category`**: Hierarchical category tree structure (`parentId` self-relation) supporting infinite sub-category nesting.
4. **`Product`**: Central catalog entity storing title, SKU, barcode, base price, GST rate, HSN code, weight unit (`KG`, `GM`, `LTR`, `ML`, `PIECE`, `PACKET`), and JSON nutrition/specification payloads.
5. **`ProductVariant`**: Weight variations for products (e.g., 250g, 500g, 1kg pack) with individual pricing and barcode linkage.
6. **`Location`**: Physical store or warehouse node storing address, GST number, receipt headers/footers, delivery radius, and assigned store staff.
7. **`Inventory`**: Multi-location stock mapping (`productId`, `variantId`, `locationId`) maintaining `currentStock` (high precision decimal up to 3 decimal places e.g., 1.425 kg), `thresholdStock`, and `isLowStock` flags.
8. **`Pricing`**: Channel-specific pricing engine (`WEB`, `POS`, `WHATSAPP`) overriding product base prices with channel-specific discounts and promotional dates.
9. **`Order`**: Comprehensive order record storing total amount, status (`PENDING`, `CONFIRMED`, `PACKED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`), payment status, shipping address JSON, delivery slot, discount amount, idempotency key, delivery OTP, delivery/packer photo proof URLs, and rating/feedback links.
10. **`CashierShift`**: Cashier shift tracking entity recording start cash float, cash collected, card/UPI collected, expected end balance, actual count, cash variance, and shift status (`OPEN`, `CLOSED`).
11. **`MortalityLog`**: Spoilage ledger recording lost weight/quantity of fresh produce, degradation reasons (damaged, rotten, expired), and financial loss values.

---

## 7. Complete Backend API Endpoint & Middleware Map

| Endpoint Group | Base Route | Core Functionality & Access Control |
| :--- | :--- | :--- |
| **Auth** | `/api/v1/auth` | User registration, OTP generation, login, JWT token issue, password reset, profile fetch. |
| **Categories** | `/api/v1/categories` | Public category tree fetch, Admin CRUD for parent/child categories & sort order. |
| **Products** | `/api/v1/products` | Public product catalog, MeiliSearch sync, Admin catalog CRUD, publishing toggles. |
| **Variants** | `/api/v1/variants` | Product variant management, weight pricing, SKU & barcode linkage. |
| **Search** | `/api/v1/search` | Fast MeiliSearch full-text search, recent search history logging. |
| **Cart** | `/api/v1/cart` | Get user cart, add item, update quantity, remove item, sync local cart. |
| **Orders** | `/api/v1/orders` | Create order with idempotency check, list orders, cancel order, update order status. |
| **Payments** | `/api/v1/payments` | Razorpay order creation, payment verification, webhook listener, COD confirmation. |
| **Pay Express** | `/api/v1/pay` | Easebuzz payment link generation and payment callback execution. |
| **POS System** | `/api/v1/pos` | Cashier shift open/close, rapid POS checkout, thermal receipt stream, float audit. |
| **Inventory** | `/api/v1/inventory` | Multi-location stock update, restock logs, low stock alerts, mortality log submission. |
| **Locations** | `/api/v1/locations` | Store location management, delivery radius configuration, store status toggles. |
| **Coupons** | `/api/v1/coupons` | Coupon creation, user target assignment, promo code validation engine. |
| **Attendance** | `/api/v1/attendance` | Staff clock-in/clock-out, shift approval, attendance reporting. |
| **Expenses** | `/api/v1/expenses` | Store expense creation, receipt upload, monthly expense reporting. |
| **Support Chat** | `/api/v1/chat` & `/chathub` | Customer-Admin two-way message listing, active support ticket management. |
| **Analytics** | `/api/v1/analytics` | Revenue reports, top-selling items, store performance metrics, margin analysis. |
| **Incidents** | `/api/v1/incidents` | Security incident reporting, resolution tracking, security audit log viewing. |

---

## 8. End-to-End Operational Workflows & Sequence Architecture

### POS Billing & Cashier Shift Lifecycle
```
 [ Cashier Starts Shift ] ──► Open Shift Form ──► Declare Opening Cash Float (e.g., ₹2,000)
           │
           ▼
  [ Active Billing Mode ] ──► Scan Barcode ──► Input Fractional Weight (1.425 KG) ──► Apply POS Price
           │
           ▼
    ( Payment Mode ) ─────► Cash (Display Change) OR Counter Dynamic UPI QR Code
           │
           ▼
 [ Complete Order ] ──────► Deduct Stock Atomically ──► Print Esc/POS Thermal Receipt
           │
           ▼
  [ End Shift Form ] ─────► Count Drawer Totals ──► System Calculates Cash Variance Sign-off
```

---

## 9. In-Depth Analysis of Problems Solved by the Platform

1. **Dual-Channel Stock Overselling**: PostgreSQL atomic database transactions with Prisma ORM prevent overbooking. Real-time WebSocket events broadcast low-stock/out-of-stock badges to all web clients instantly.
2. **Differential Channel Pricing (POS vs Web)**: Channel-aware pricing (`Pricing` entity tied to `Channel` enum: `WEB`, `POS`, `WHATSAPP`) lets store managers set different rates for in-store vs online purchases while sharing a single central catalog.
3. **Rapid Cashier Billing Queues**: Keyboard shortcuts, instant barcode search, and auto-focused weight inputs allow cashiers to complete billing in under 10 seconds.
4. **Cashier Cash Theft Prevention**: Cashier Shift Opening and Closing float audits (`CashierShift`) track exact cash starting float, cash collected, expected end total, and supervisor variance sign-off.
5. **Produce Spoilage & Mortality Accounting**: Dedicated `MortalityLog` captures rotten/damaged fruit weights and financial loss amounts, automatically updating inventory and generating shrinkage reports.
6. **Payment Idempotency & Gateway Resilience**: Unique `idempotencyKey` per order prevents duplicate orders during network dropouts, while webhooks verify signatures and verify statuses directly with gateway APIs.

---

## 10. System Performance, Security & Engineering Highlights

- **Sub-Millisecond Search**: MeiliSearch engine indexing titles, categories, SKUs, and barcodes.
- **Distributed Socket Scaling**: `@socket.io/redis-adapter` enables horizontal node scaling across AWS EC2 container instances.
- **Async Queue Workers**: Redis Bull queues execute heavy background jobs without blocking Express HTTP routes.
- **Security Audit Logs**: Enterprise audit loggers recording table mutations, raw SQL queries, and suspicious request patterns.
- **Zero Downtime Automated AWS Deployments**: Cloud-ready infrastructure setup with Docker Compose, Nginx reverse proxy, and automated deployment scripts (`deploy_aws_full.ps1`).

---

## 11. DevOps, Containerization & AWS Infrastructure Blueprint

### Container Architecture (`docker-compose.yml`)
The platform runs on a multi-container Docker compose network:
* `bmv-server`: Node.js Express API server (Port 5000)
* `bmv-client`: Next.js web application container (Port 3000)
* `bmv-db`: PostgreSQL 15 database container (Port 5435 -> 5432)
* `bmv-redis`: Redis 7 in-memory cache and socket adapter container (Port 6385 -> 6379)
* `bmv-easebuzz`: PayWithEasebuzz NodeJS bridge container (Port 3003 -> 3000)

### Nginx Edge Configuration (`bmv.conf`)
Nginx acts as the primary reverse proxy and edge router:
* Routes web traffic on Port 80/443 to `localhost:3000` (Next.js Client).
* Proxies `/api` and `/uploads` routes to `localhost:5000` (Express Server).
* Proxies `/socket.io` to `localhost:5000` with HTTP/1.1 WebSockets upgrade headers.

### Automated AWS Deployment Pipeline (`deploy_aws_full.ps1`)
1. Builds production Docker images for server and client.
2. Authenticates with AWS Elastic Container Registry (ECR).
3. Pushes tagged container images to ECR repositories.
4. SSHs into AWS EC2 instances, pulls latest container images, and executes zero-downtime rolling updates via Docker Compose.
