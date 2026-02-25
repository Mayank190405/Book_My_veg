import redisClient from "../config/redis";

/**
 * Invalidates all cache keys related to a product.
 */
export async function invalidateProductCache(productId: string, categoryId?: string): Promise<void> {
    const keys: string[] = [`product:${productId}`];

    if (categoryId) {
        keys.push(`category:${categoryId}`);
    }

    // Trending keys are location-scoped; delete all trending keys
    // (Use SCAN in production to avoid blocking with large keysets)
    const trendingKeys = await redisClient.keys("trending:*");
    keys.push(...trendingKeys);

    if (keys.length > 0) {
        await redisClient.del(keys);
    }
}

/**
 * Invalidates category cache (and its parent if exists).
 */
export async function invalidateCategoryCache(categoryId: string): Promise<void> {
    await redisClient.del(`category:${categoryId}`);
}

/**
 * Invalidates trending for a specific location (or all if no locationId).
 */
export async function invalidateTrendingCache(locationId?: string): Promise<void> {
    if (locationId) {
        await redisClient.del(`trending:${locationId}`);
    } else {
        const keys = await redisClient.keys("trending:*");
        if (keys.length > 0) await redisClient.del(keys);
    }
}
