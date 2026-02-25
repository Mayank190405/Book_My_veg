/**
 * Order State Machine
 * Enforces valid status transitions and cancellation policy.
 */

export type OrderStatus =
    | "PENDING"
    | "PAYMENT_PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "PACKED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | "FAILED";

// Valid forward transitions
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ["PAYMENT_PENDING", "CANCELLED", "FAILED"],
    PAYMENT_PENDING: ["CONFIRMED", "FAILED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["PACKED", "CANCELLED"],
    PACKED: ["OUT_FOR_DELIVERY"],        // ← no cancellation after PACKED
    OUT_FOR_DELIVERY: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
    FAILED: ["PAYMENT_PENDING"],         // allow retry
};

// Statuses from which cancellation IS allowed
const CANCELLABLE: OrderStatus[] = ["PENDING", "PAYMENT_PENDING", "CONFIRMED", "PROCESSING"];

export class InvalidTransitionError extends Error {
    constructor(from: string, to: string) {
        super(`Invalid order transition: ${from} → ${to}`);
        this.name = "InvalidTransitionError";
    }
}

export class CancellationNotAllowedError extends Error {
    constructor(status: string) {
        super(`Order cannot be cancelled at status: ${status}`);
        this.name = "CancellationNotAllowedError";
    }
}

/**
 * Validates a status transition. Throws on invalid.
 */
export function assertValidTransition(from: OrderStatus, to: OrderStatus): void {
    const allowed = TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
        throw new InvalidTransitionError(from, to);
    }
}

/**
 * Validates cancellation is allowed from the given status.
 */
export function assertCancellable(status: OrderStatus): void {
    if (!CANCELLABLE.includes(status)) {
        throw new CancellationNotAllowedError(status);
    }
}
