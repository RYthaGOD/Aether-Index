import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

/**
 * AetherIndex Rate Limiter | Institutional Sliding Window
 * Uses Redis ZSETs for cross-instance persistence and precision.
 */
export class RateLimiter {
    private redis: RedisClientType | null = null;
    private memoryUsage: Map<string, number[]> = new Map();
    private windowMs: number = 60000; // 1 Minute
    private isRedisEnabled: boolean = false;

    constructor() {
        this.initRedis();
    }

    private async initRedis() {
        try {
            this.redis = createClient({ url: config.redis.url });
            this.redis.on('error', (err) => {
                console.warn('[RateLimiter] Redis Error - Falling back to Memory:', err.message);
                this.isRedisEnabled = false;
            });
            await this.redis.connect();
            this.isRedisEnabled = true;
            console.log('[RateLimiter] Persistent Redis Link Established.');
        } catch (err) {
            console.warn('[RateLimiter] Redis Connection Failed - Sovereignty Resiliency Active (Memory Only).');
            this.isRedisEnabled = false;
        }
    }

    /**
     * Checks if a request is allowed for a given key.
     * Uses Redis ZSET sliding window if available, fallback to in-memory.
     */
    async isAllowed(key: string, limitRpm: number): Promise<boolean> {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        if (this.isRedisEnabled && this.redis) {
            try {
                const redisKey = `rl:${key}`;
                const multi = this.redis.multi();
                
                multi.zRemRangeByScore(redisKey, 0, windowStart);
                multi.zAdd(redisKey, { score: now, value: `${now}-${Math.random()}` });
                multi.zCard(redisKey);
                multi.expire(redisKey, 60);

                const results = await multi.exec();
                const count = Number(results[2]);

                return count <= limitRpm;
            } catch (err) {
                this.isRedisEnabled = false; // Disable if redis fails during op
                return this.memoryAllowed(key, limitRpm, now);
            }
        }

        return this.memoryAllowed(key, limitRpm, now);
    }

    private memoryAllowed(key: string, limitRpm: number, now: number): boolean {
        const timestamps = this.memoryUsage.get(key) || [];
        const activeTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
        
        if (activeTimestamps.length >= limitRpm) {
            this.memoryUsage.set(key, activeTimestamps);
            return false;
        }

        activeTimestamps.push(now);
        this.memoryUsage.set(key, activeTimestamps);
        return true;
    }

    /**
     * Clean up in-memory usage
     */
    gc() {
        const now = Date.now();
        for (const [key, timestamps] of this.memoryUsage.entries()) {
            const active = timestamps.filter(ts => now - ts < this.windowMs);
            if (active.length === 0) {
                this.memoryUsage.delete(key);
            } else {
                this.memoryUsage.set(key, active);
            }
        }
    }
}

export const rateLimiter = new RateLimiter();

// Run Memory GC every 5 minutes
setInterval(() => rateLimiter.gc(), 300000);
