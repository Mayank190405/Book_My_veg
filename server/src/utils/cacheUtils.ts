import redisClient from "../config/redis";

/**
 * Invalidates all cache keys related to a product.
 */
export async function invalidateProductCache(productId?: string, categoryId?: string): Promise<void> {
    const keys: string[] = [];
    if (productId) keys.push(`product:${productId}`);

    if (categoryId) {
        keys.push(`category:${categoryId}`);
    }

    // Always clear general product lists (like search results or trending if they have no specific keys)
    // In a mature app, we'd clear specific list keys.
    const productListKeys = await redisClient.keys("products:*");
    keys.push(...productListKeys);
    
    const trendingKeys = await redisClient.keys("trending:*");
    keys.push(...trendingKeys);

    if (keys.length > 0) {
        // Filter unique keys
        const uniqueKeys = [...new Set(keys)];
        await redisClient.del(uniqueKeys);
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
