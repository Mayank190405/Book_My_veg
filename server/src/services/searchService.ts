// server/src/services/searchService.ts

import prisma from "../config/prisma";

export interface SearchProduct {
    id: string;
    name: string;
    sku: string;
    barcode: string;
    description: string;
    categoryName: string;
    locationIds: string[];
    isActive: boolean;
    image: string;
    basePrice: number;
    tags?: string[];
}

function getLevenshteinDistance(a: string, b: string): number {
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
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export class SearchService {
    private static instance: SearchService;

    private constructor() {
        // No MeiliSearch initialization needed anymore
    }

    public static getInstance(): SearchService {
        if (!SearchService.instance) {
            SearchService.instance = new SearchService();
        }
        return SearchService.instance;
    }

    /**
     * No-op init since we are not using an external search engine
     */
    async init() {
        console.log('SearchService initialized with local database JSON tags search.');
    }

    static mapProduct(product: any): SearchProduct {
        let tagsArray: string[] = [];
        try {
            if (typeof product.tags === 'string') {
                tagsArray = JSON.parse(product.tags);
            } else if (Array.isArray(product.tags)) {
                tagsArray = product.tags;
            }
        } catch (e) {
            tagsArray = [];
        }

        return {
            id: product.id,
            name: product.name,
            sku: product.sku || '',
            barcode: product.barcode || '',
            description: product.description || '',
            categoryName: product.category?.name || 'Uncategorized',
            locationIds: Array.isArray(product.inventory) 
                ? product.inventory.map((inv: any) => inv.locationId)
                : [],
            isActive: product.isActive,
            image: product.images?.[0] || '',
            basePrice: Number(product.basePrice || 0),
            tags: tagsArray
        };
    }

    async indexProduct(product: any) {
        // No-op for local database search
    }

    async indexProducts(products: any[]) {
        // No-op for local database search
    }

    async deleteProduct(productId: string) {
        // No-op for local database search
    }

    async search(query: string, options: { 
        limit?: number; 
        offset?: number; 
        locationId?: string;
        isActive?: boolean;
    } = {}) {
        try {
            const cleanQuery = query.trim().toLowerCase();
            const limit = options.limit || 20;
            const offset = options.offset || 0;

            // Fetch products from database
            const products = await prisma.product.findMany({
                where: {
                    isActive: options.isActive !== undefined ? options.isActive : true,
                    // If locationId filter is provided, we check inventory relation
                    ...(options.locationId && {
                        inventory: {
                            some: {
                                locationId: options.locationId
                            }
                        }
                    })
                },
                include: {
                    category: true,
                    inventory: true
                }
            });

            // Match and score products locally
            const matchedProducts = products.map((product) => {
                const nameLower = product.name.toLowerCase();
                const skuLower = (product.sku || '').toLowerCase();
                const barcodeLower = (product.barcode || '').toLowerCase();
                const descLower = (product.description || '').toLowerCase();
                const categoryLower = (product.category?.name || '').toLowerCase();

                let parsedTags: string[] = [];
                try {
                    const rawProduct = product as any;
                    if (typeof rawProduct.tags === 'string') {
                        parsedTags = JSON.parse(rawProduct.tags);
                    } else if (Array.isArray(rawProduct.tags)) {
                        parsedTags = rawProduct.tags as any;
                    }
                } catch (e) {
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

                    if (
                        nameLower.includes(cleanQuery) ||
                        skuLower.includes(cleanQuery) ||
                        barcodeLower.includes(cleanQuery) ||
                        descLower.includes(cleanQuery) ||
                        categoryLower.includes(cleanQuery)
                    ) {
                        isMatch = true;
                    }
                } else {
                    // Empty query matches all active products
                    isMatch = true;
                    tagPosition = 0;
                }

                if (!isMatch) return null;

                const spellingScore = cleanQuery ? getLevenshteinDistance(cleanQuery, nameLower) : 0;

                return {
                    product,
                    tagPosition,
                    spellingScore,
                };
            }).filter(Boolean) as { product: any; tagPosition: number; spellingScore: number }[];

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
        } catch (error) {
            console.error('[SearchService] Local Search Error:', error);
            return { hits: [], nbHits: 0 };
        }
    }
}