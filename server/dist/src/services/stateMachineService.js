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
exports.StateMachineService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
const inventoryService_1 = require("./inventoryService");
class StateMachineService {
    /**
     * Transition an order to a new state with side effects.
     * NOTE: Uses the provided tx if available, otherwise uses direct prisma calls.
     * We do NOT wrap in a new interactive transaction here because the PrismaPg
     * driver adapter does not support interactive transactions.
     */
    static transitionOrder(params, tx) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = tx || prisma_1.default;
            const order = yield db.order.findUnique({
                where: { id: params.orderId },
                include: { items: true }
            });
            if (!order)
                throw new Error("Order not found.");
            // 1. Validate Transition
            const allowed = this.VALID_TRANSITIONS[order.status];
            if (!allowed || !allowed.includes(params.newState)) {
                throw new Error(`Invalid transition from ${order.status} to ${params.newState}`);
            }
            // 2. Handle Side Effects
            // SIDE EFFECT: Deduct Inventory on PACKED for Web Orders
            if (params.newState === client_1.OrderStatus.PACKED) {
                yield inventoryService_1.InventoryService.deductStock({
                    items: order.items,
                    locationId: "MAIN_WAREHOUSE",
                    type: inventoryService_1.InventoryLogType.SALE,
                    staffId: params.staffId
                }, db);
            }
            // 3. Update Order State
            const updatedOrder = yield db.order.update({
                where: { id: params.orderId },
                data: { status: params.newState }
            });
            // 4. Log History
            yield db.orderStatusHistory.create({
                data: {
                    orderId: params.orderId,
                    status: params.newState,
                    remark: params.remark,
                    changedBy: params.staffId || "SYSTEM"
                }
            });
            return updatedOrder;
        });
    }
}
exports.StateMachineService = StateMachineService;
/**
 * Define valid state transitions.
 */
StateMachineService.VALID_TRANSITIONS = {
    [client_1.OrderStatus.PENDING]: [client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.CANCELLED],
    [client_1.OrderStatus.PAYMENT_PENDING]: [client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.FAILED, client_1.OrderStatus.CANCELLED],
    [client_1.OrderStatus.CONFIRMED]: [client_1.OrderStatus.PROCESSING, client_1.OrderStatus.CANCELLED],
    [client_1.OrderStatus.PROCESSING]: [client_1.OrderStatus.PACKED, client_1.OrderStatus.CANCELLED],
    [client_1.OrderStatus.PACKED]: [client_1.OrderStatus.SHIPPED, client_1.OrderStatus.CANCELLED],
    [client_1.OrderStatus.SHIPPED]: [client_1.OrderStatus.OUT_FOR_DELIVERY, client_1.OrderStatus.CANCELLED],
    [client_1.OrderStatus.OUT_FOR_DELIVERY]: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.FAILED],
    [client_1.OrderStatus.DELIVERED]: [client_1.OrderStatus.RETURNED],
    [client_1.OrderStatus.CANCELLED]: [],
    [client_1.OrderStatus.RETURNED]: [],
    [client_1.OrderStatus.FAILED]: []
};
