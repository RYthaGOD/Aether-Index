/**
 * AetherIndex Rate Limiter | Sovereign Sliding Window
 */
export class RateLimiter {
    private usage: Map<string, number[]> = new Map();
    private windowMs: number = 60000; // 1 Minute

    constructor() {}

    /**
     * Checks if a request is allowed for a given key.
     * @param key The API Key or ID to track
     * @param limitRpm The maximum requests allowed per minute
     */
    isAllowed(key: string, limitRpm: number): boolean {
        const now = Date.now();
        const timestamps = this.usage.get(key) || [];
        
        // Filter out expired timestamps
        const activeTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
        
        if (activeTimestamps.length >= limitRpm) {
            this.usage.set(key, activeTimestamps); // Clean up expired ones even if denied
            return false;
        }

        activeTimestamps.push(now);
        this.usage.set(key, activeTimestamps);
        return true;
    }

    /**
     * Clean up very old keys to prevent memory growth (Sovereign Guard)
     */
    gc() {
        const now = Date.now();
        for (const [key, timestamps] of this.usage.entries()) {
            const active = timestamps.filter(ts => now - ts < this.windowMs);
            if (active.length === 0) {
                this.usage.delete(key);
            } else {
                this.usage.set(key, active);
            }
        }
    }
}

export const rateLimiter = new RateLimiter();

// Run GC every 5 minutes
setInterval(() => rateLimiter.gc(), 300000);
