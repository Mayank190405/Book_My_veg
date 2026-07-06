"use strict";
// server/src/services/searchService.ts
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
exports.SearchService = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
function getLevenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}
class SearchService {
    constructor() {
        // No MeiliSearch initialization needed anymore
    }
    static getInstance() {
        if (!SearchService.instance) {
            SearchService.instance = new SearchService();
        }
        return SearchService.instance;
    }
    /**
     * No-op init since we are not using an external search engine
     */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('SearchService initialized with local database JSON tags search.');
        });
    }
    static mapProduct(product) {
        var _a, _b;
        let tagsArray = [];
        try {
            if (typeof product.tags === 'string') {
                tagsArray = JSON.parse(product.tags);
            }
            else if (Array.isArray(product.tags)) {
                tagsArray = product.tags;
            }
        }
        catch (e) {
            tagsArray = [];
        }
        return {
            id: product.id,
            name: product.name,
            sku: product.sku || '',
            barcode: product.barcode || '',
            description: product.description || '',
            categoryName: ((_a = product.category) === null || _a === void 0 ? void 0 : _a.name) || 'Uncategorized',
            locationIds: Array.isArray(product.inventory)
                ? product.inventory.map((inv) => inv.locationId)
                : [],
            isActive: product.isActive,
            image: ((_b = product.images) === null || _b === void 0 ? void 0 : _b[0]) || '',
            basePrice: Number(product.basePrice || 0),
            tags: tagsArray
        };
    }
    indexProduct(product) {
        return __awaiter(this, void 0, void 0, function* () {
            // No-op for local database search
        });
    }
    indexProducts(products) {
        return __awaiter(this, void 0, void 0, function* () {
            // No-op for local database search
        });
    }
    deleteProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            // No-op for local database search
        });
    }
    search(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, options = {}) {
            try {
                const cleanQuery = query.trim().toLowerCase();
                const limit = options.limit || 20;
                const offset = options.offset || 0;
                // Fetch products from database
                const products = yield prisma_1.default.product.findMany({
                    where: Object.assign({ isActive: options.isActive !== undefined ? options.isActive : true }, (options.locationId && {
                        inventory: {
                            some: {
                                locationId: options.locationId
                            }
                        }
                    })),
                    include: {
                        category: true,
                        inventory: true
                    }
                });
                // Match and score products locally
                const matchedProducts = products.map((product) => {
                    var _a;
                    const nameLower = product.name.toLowerCase();
                    const skuLower = (product.sku || '').toLowerCase();
                    const barcodeLower = (product.barcode || '').toLowerCase();
                    const descLower = (product.description || '').toLowerCase();
                    const categoryLower = (((_a = product.category) === null || _a === void 0 ? void 0 : _a.name) || '').toLowerCase();
                    let parsedTags = [];
                    try {
                        const rawProduct = product;
                        if (typeof rawProduct.tags === 'string') {
                            parsedTags = JSON.parse(rawProduct.tags);
                        }
                        else if (Array.isArray(rawProduct.tags)) {
                            parsedTags = rawProduct.tags;
                        }
                    }
                    catch (e) {
                        parsedTags = [];
                    }
                    parsedTags = parsedTags.map((t) => String(t).trim().toLowerCase());
                    // Check if matches query
                    let isMatch = false;
                    let tagPosition = 9999; // fallback if no tag matches
                    // Check tags first to compute priority index
                    if (cleanQuery) {
                        const matchedTagIdx = parsedTags.findIndex(tag => tag.includes(cleanQuery));
                        if (matchedTagIdx !== -1) {
                            isMatch = true;
                            tagPosition = matchedTagIdx;
                        }
                        if (nameLower.includes(cleanQuery) ||
                            skuLower.includes(cleanQuery) ||
                            barcodeLower.includes(cleanQuery) ||
                            descLower.includes(cleanQuery) ||
                            categoryLower.includes(cleanQuery)) {
                            isMatch = true;
                        }
                    }
                    else {
                        // Empty query matches all active products
                        isMatch = true;
                        tagPosition = 0;
                    }
                    if (!isMatch)
                        return null;
                    const spellingScore = cleanQuery ? getLevenshteinDistance(cleanQuery, nameLower) : 0;
                    return {
                        product,
                        tagPosition,
                        spellingScore,
                    };
                }).filter(Boolean);
                // Sort products by priority rules
                matchedProducts.sort((a, b) => {
                    // Rule 1: Tag matching position (lower index is better)
                    if (a.tagPosition !== b.tagPosition) {
                        return a.tagPosition - b.tagPosition;
                    }
                    // Rule 2: Spelling similarity/Levenshtein score (lower distance is better)
                    if (a.spellingScore !== b.spellingScore) {
                        return a.spellingScore - b.spellingScore;
                    }
                    // Rule 3: Alphabetical name comparison fallback
                    return a.product.name.localeCompare(b.product.name);
                });
                // Map and paginate results
                const totalMatchingCount = matchedProducts.length;
                const paginatedResults = matchedProducts.slice(offset, offset + limit);
                const mappedHits = paginatedResults.map(item => SearchService.mapProduct(item.product));
                return {
                    hits: mappedHits,
                    nbHits: totalMatchingCount
                };
            }
            catch (error) {
                console.error('[SearchService] Local Search Error:', error);
                return { hits: [], nbHits: 0 };
            }
        });
    }
}
exports.SearchService = SearchService;
