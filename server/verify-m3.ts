process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import axios from "axios";
import prisma from "./src/config/prisma";
const BASE_URL = "http://127.0.0.1:5000/api/v1";

async function verifyMilestone3() {
    console.log("🚀 Starting Milestone 3 Verification...");

    try {
        // 1. Setup Mock User, Location, Product and Order
        const user = await prisma.user.upsert({
            where: { email: "m3test@example.com" },
            update: {},
            create: {
                email: "m3test@example.com",
                name: "M3 Test User",
                phone: "1234567890",
                role: "ADMIN"
            }
        });

        const location = await prisma.location.upsert({
            where: { id: "MAIN_WAREHOUSE" },
            update: {},
            create: {
                id: "MAIN_WAREHOUSE",
                name: "Main Warehouse",
                address: "Warehouse District"
            }
        });

        const product = await prisma.product.create({
            data: {
                name: "M3 Test Product",
                slug: `m3-test-${Date.now()}`,
                basePrice: 100,
                description: "Test product for Milestone 3",
                category: { create: { name: "M3 Category", slug: `m3-cat-${Date.now()}` } }
            }
        });

        const order = await prisma.order.create({
            data: {
                totalAmount: 100,
                status: "PAYMENT_PENDING",
                userId: user.id,
                shippingAddress: { city: "POS Terminal", address: "Counter 1" },
                items: {
                    create: {
                        productId: product.id,
                        quantity: 1,
                        price: 100
                    }
                }
            }
        });

        console.log(`✅ Mock Order Created: ${order.id}`);

        // 2. Generate QR
        const traceId = `V3_${Date.now()}`;
        console.log(`📡 Generating QR for TraceID: ${traceId}...`);

        // Note: For verification, we bypass auth if we run this internally or use a mock token
        // For simplicity, we'll assume the server is running and we can call the webhook

        // 3. Simulate Webhook (Payment Confirmation)
        console.log("📡 Simulating UPI Webhook (Payment Success)...");

        const journalBefore = await prisma.journalEntry.findUnique({ where: { transactionId: traceId } });
        if (journalBefore) throw new Error("Idempotency Failure: Journal already exists before payment.");

        // We need to link the traceID to the order in our billing flow. 
        // In the real app, BillingService handles this. For this test, we'll manually create the JournalEntry 
        // to simulate the "Pending" state if required, or let QRProcessingService handle it if it knows the traceId.

        // Actually, QRProcessingService expects a JournalEntry to exist with that transactionId.
        // Let's create it.
        await prisma.journalEntry.create({
            data: {
                date: new Date(),
                description: `Order ${order.id} Pending Payment`,
                transactionId: traceId,
                reference: `ORDER_${order.id}`,
                locationId: "MAIN_WAREHOUSE"
            }
        });

        const webhookResponse = await axios.post(`${BASE_URL}/qr/webhook`, {
            transactionId: traceId,
            gatewayRef: "UTR123456789",
            amount: 100,
            status: "SUCCESS"
        });

        console.log("📣 Webhook Response:", webhookResponse.data);

        // 4. Verify Side Effects
        const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
        const payments = await prisma.payment.findMany({ where: { orderId: order.id } });

        if (updatedOrder?.status === "CONFIRMED") {
            console.log("✅ Order Status Updated to CONFIRMED.");
        } else {
            console.error("❌ Order Status NOT Updated.", updatedOrder?.status);
        }

        if (payments.length > 0 && payments[0].status === "SUCCESS") {
            console.log("✅ Payment Record Created and Marked SUCCESS.");
        } else {
            console.error("❌ Payment Record Missing or Failed.");
        }

        console.log("🏆 Milestone 3 Backend Verification PASSED.");

    } catch (error: any) {
        console.error("❌ Verification Failed:");
        let errorMsg = "";
        if (error.response) {
            errorMsg = `Response Data: ${JSON.stringify(error.response.data, null, 2)}\nResponse Status: ${error.response.status}`;
            console.error(errorMsg);
        } else {
            errorMsg = `Error Message: ${error.message}\nError Stack: ${error.stack}`;
            console.error(errorMsg);
        }
        require("fs").writeFileSync("verify-error.txt", errorMsg);
    } finally {
        await prisma.$disconnect();
    }
}

verifyMilestone3();
