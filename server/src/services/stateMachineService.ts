
import { OrderStatus, Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { InventoryService, InventoryLogType } from "./inventoryService";
import { AccountingService } from "./accountingService";

export class StateMachineService {
    /**
     * Define valid state transitions.
     */
    private static VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
        [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        [OrderStatus.PAYMENT_PENDING]: [OrderStatus.CONFIRMED, OrderStatus.FAILED, OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
        [OrderStatus.PROCESSING]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
        [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
        [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
        [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
        [OrderStatus.CANCELLED]: [],
        [OrderStatus.RETURNED]: [],
        [OrderStatus.FAILED]: []
    };

    /**
     * Transition an order to a new state with side effects.
     * NOTE: Uses the provided tx if available, otherwise uses direct prisma calls.
     * We do NOT wrap in a new interactive transaction here because the PrismaPg
     * driver adapter does not support interactive transactions.
     */
    static async transitionOrder(params: {
        orderId: string;
        newState: OrderStatus;
        staffId?: string;
        remark?: string;
    }, tx?: any) {
        const db = tx || prisma;

        const order = await db.order.findUnique({
            where: { id: params.orderId },
            include: { items: true }
        });

        if (!order) throw new Error("Order not found.");

        // 1. Validate Transition
        const allowed = this.VALID_TRANSITIONS[order.status];
        if (!allowed || !allowed.includes(params.newState)) {
            throw new Error(`Invalid transition from ${order.status} to ${params.newState}`);
        }

        // 2. Handle Side Effects
        // SIDE EFFECT: Deduct Inventory on PACKED for Web Orders
        if (params.newState === OrderStatus.PACKED) {
            await InventoryService.deductStock({
                items: order.items,
                locationId: "MAIN_WAREHOUSE",
                type: InventoryLogType.SALE,
                staffId: params.staffId
            }, db);
        }

        // 3. Update Order State
        const updatedOrder = await db.order.update({
            where: { id: params.orderId },
            data: { status: params.newState }
        });

        // 4. Log History
        await db.orderStatusHistory.create({
            data: {
                orderId: params.orderId,
                status: params.newState,
                remark: params.remark,
                changedBy: params.staffId || "SYSTEM"
            }
        });

        return updatedOrder;
    }
}
