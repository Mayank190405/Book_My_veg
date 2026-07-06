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
exports.invalidateProductCache = invalidateProductCache;
exports.invalidateCategoryCache = invalidateCategoryCache;
exports.invalidateTrendingCache = invalidateTrendingCache;
const redis_1 = __importDefault(require("../config/redis"));
/**
 * Invalidates all cache keys related to a product.
 */
function invalidateProductCache(productId, categoryId) {
    return __awaiter(this, void 0, void 0, function* () {
        const keys = [];
        if (productId)
            keys.push(`product:${productId}`);
        if (categoryId) {
            keys.push(`category:${categoryId}`);
        }
        // Always clear general product lists (like search results or trending if they have no specific keys)
        // In a mature app, we'd clear specific list keys.
        const productListKeys = yield redis_1.default.keys("products:*");
        keys.push(...productListKeys);
        const trendingKeys = yield redis_1.default.keys("trending:*");
        keys.push(...trendingKeys);
        if (keys.length > 0) {
            // Filter unique keys
            const uniqueKeys = [...new Set(keys)];
            yield redis_1.default.del(uniqueKeys);
        }
    });
}
/**
 * Invalidates category cache (and its parent if exists).
 */
function invalidateCategoryCache(categoryId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield redis_1.default.del(`category:${categoryId}`);
    });
}
/**
 * Invalidates trending for a specific location (or all if no locationId).
 */
function invalidateTrendingCache(locationId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (locationId) {
            yield redis_1.default.del(`trending:${locationId}`);
        }
        else {
            const keys = yield redis_1.default.keys("trending:*");
            if (keys.length > 0)
                yield redis_1.default.del(keys);
        }
    });
}
