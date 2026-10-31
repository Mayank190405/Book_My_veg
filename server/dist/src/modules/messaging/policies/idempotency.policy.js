"use strict";
/**
 * Book My Veg — In-Memory & Distributed Idempotency Policy
 * Prevents rapid double-clicks, duplicate API dispatches, and in-flight concurrent execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyPolicy = void 0;
class IdempotencyPolicy {
    /**
     * Attempts to acquire an in-flight lock for an idempotency key.
     * Returns true if lock was acquired, false if an operation with this key is already running.
     */
    static acquireLock(key, ttlMs = this.DEFAULT_LOCK_TTL_MS) {
        const now = Date.now();
        const existingExpiresAt = this.activeKeys.get(key);
        if (existingExpiresAt && now < existingExpiresAt) {
            return false; // Still locked
        }
        this.activeKeys.set(key, now + ttlMs);
        // Auto-cleanup stale keys periodically
        if (this.activeKeys.size > 1000) {
            this.cleanup();
        }
        return true;
    }
    static releaseLock(key) {
        this.activeKeys.delete(key);
    }
    static cleanup() {
        const now = Date.now();
        for (const [key, expiresAt] of this.activeKeys.entries()) {
            if (now >= expiresAt) {
                this.activeKeys.delete(key);
            }
        }
    }
}
exports.IdempotencyPolicy = IdempotencyPolicy;
IdempotencyPolicy.activeKeys = new Map();
IdempotencyPolicy.DEFAULT_LOCK_TTL_MS = 15000; // 15 seconds lock
