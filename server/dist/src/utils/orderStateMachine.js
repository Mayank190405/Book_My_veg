"use strict";
/**
 * Order State Machine
 * Enforces valid status transitions and cancellation policy.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancellationNotAllowedError = exports.InvalidTransitionError = void 0;
exports.assertValidTransition = assertValidTransition;
exports.assertCancellable = assertCancellable;
// Valid forward transitions
const TRANSITIONS = {
    PENDING: ["PAYMENT_PENDING", "CANCELLED", "FAILED"],
    PAYMENT_PENDING: ["CONFIRMED", "FAILED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["PACKED", "CANCELLED"],
    PACKED: ["OUT_FOR_DELIVERY"], // ← no cancellation after PACKED
    OUT_FOR_DELIVERY: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
    FAILED: ["PAYMENT_PENDING"], // allow retry
};
// Statuses from which cancellation IS allowed
const CANCELLABLE = ["PENDING", "PAYMENT_PENDING", "CONFIRMED", "PROCESSING"];
class InvalidTransitionError extends Error {
    constructor(from, to) {
        super(`Invalid order transition: ${from} → ${to}`);
        this.name = "InvalidTransitionError";
    }
}
exports.InvalidTransitionError = InvalidTransitionError;
class CancellationNotAllowedError extends Error {
    constructor(status) {
        super(`Order cannot be cancelled at status: ${status}`);
        this.name = "CancellationNotAllowedError";
    }
}
exports.CancellationNotAllowedError = CancellationNotAllowedError;
/**
 * Validates a status transition. Throws on invalid.
 */
function assertValidTransition(from, to) {
    var _a;
    const allowed = (_a = TRANSITIONS[from]) !== null && _a !== void 0 ? _a : [];
    if (!allowed.includes(to)) {
        throw new InvalidTransitionError(from, to);
    }
}
/**
 * Validates cancellation is allowed from the given status.
 */
function assertCancellable(status) {
    if (!CANCELLABLE.includes(status)) {
        throw new CancellationNotAllowedError(status);
    }
}
