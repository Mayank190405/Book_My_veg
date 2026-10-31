/**
 * Book My Veg — In-Memory & Distributed Idempotency Policy
 * Prevents rapid double-clicks, duplicate API dispatches, and in-flight concurrent execution.
 */

export class IdempotencyPolicy {
    private static activeKeys = new Map<string, number>();
    private static readonly DEFAULT_LOCK_TTL_MS = 15000; // 15 seconds lock

    /**
     * Attempts to acquire an in-flight lock for an idempotency key.
     * Returns true if lock was acquired, false if an operation with this key is already running.
     */
    public static acquireLock(key: string, ttlMs: number = this.DEFAULT_LOCK_TTL_MS): boolean {
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

    public static releaseLock(key: string): void {
        this.activeKeys.delete(key);
    }

    private static cleanup(): void {
        const now = Date.now();
        for (const [key, expiresAt] of this.activeKeys.entries()) {
            if (now >= expiresAt) {
                this.activeKeys.delete(key);
            }
        }
    }
}

