import axios from "axios";
import { basePrisma as prisma } from "../config/prisma";
import redisClient from "../config/redis";

export interface ParsedItem {
    raw: string;
    name: string;
    hindiName?: string;
    quantity: number;
    unit?: string | null;
}

export interface MatchedShoppingItem {
    rawInput: string;
    parsedName: string;
    parsedHindiName?: string;
    requestedQuantity: number;
    requestedUnit: string;
    matched: boolean;
    product: {
        id: string;
        name: string;
        slug: string;
        image: string;
        categoryName: string;
        price: number;
        unit: string;
        variantId?: string;
        variantName?: string;
        inStock: boolean;
        stockQuantity: number;
    } | null;
    lineTotal: number;
    statusMessage?: string;
}

export interface SmartSearchResponse {
    isMultiItem: boolean;
    originalQuery: string;
    normalizedQuery?: string;
    items: MatchedShoppingItem[];
    summary: {
        totalItemsParsed: number;
        totalMatched: number;
        totalUnmatched: number;
        estimatedTotal: number;
    };
}

export class GeminiSearchService {
    private static instance: GeminiSearchService;

    public static getInstance(): GeminiSearchService {
        if (!GeminiSearchService.instance) {
            GeminiSearchService.instance = new GeminiSearchService();
        }
        return GeminiSearchService.instance;
    }

    /**
     * Main entry point for Smart Search & Multi-Item Shopping List Parsing
     */
    async processSmartSearch(query: string, locationId?: string): Promise<SmartSearchResponse> {
        const cleanQuery = (query || "").trim();
        if (!cleanQuery) {
            return {
                isMultiItem: false,
                originalQuery: "",
                items: [],
                summary: { totalItemsParsed: 0, totalMatched: 0, totalUnmatched: 0, estimatedTotal: 0 }
            };
        }

        // 1. Check Redis Cache
        const cacheKey = `smartsearch:${locationId || "all"}:${cleanQuery.toLowerCase()}`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch {
            // cache miss / redis down
        }

        // 2. Determine if query is multi-item using Gemini (with fallback heuristic)
        let geminiResult = await this.parseWithGemini(cleanQuery);

        if (!geminiResult) {
            // Fallback rule-based parsing if Gemini is unavailable
            geminiResult = this.fallbackRuleBasedParse(cleanQuery);
        }

        // 3. If single item, return isMultiItem: false so UI acts as normal search
        if (!geminiResult.isMultiItem || geminiResult.items.length <= 1) {
            // Check if user explicitly asked for 1 item with quantity like "2 kg tomato"
            if (geminiResult.items.length === 1 && (geminiResult.items[0].quantity > 1 || geminiResult.items[0].unit)) {
                // User specified a shopping list item e.g. "2 kg tomato" -> keep as shopping list item
            } else {
                const response: SmartSearchResponse = {
                    isMultiItem: false,
                    originalQuery: cleanQuery,
                    normalizedQuery: geminiResult.items[0]?.name || cleanQuery,
                    items: [],
                    summary: { totalItemsParsed: 0, totalMatched: 0, totalUnmatched: 0, estimatedTotal: 0 }
                };
                return response;
            }
        }

        // 4. Match extracted items against REAL BookMyVeg PostgreSQL Database
        const matchedItems = await this.matchItemsAgainstCatalog(geminiResult.items, locationId);

        const totalMatched = matchedItems.filter(i => i.matched).length;
        const totalUnmatched = matchedItems.filter(i => !i.matched).length;
        const estimatedTotal = matchedItems.reduce((acc, i) => acc + (i.lineTotal || 0), 0);

        const response: SmartSearchResponse = {
            isMultiItem: true,
            originalQuery: cleanQuery,
            items: matchedItems,
            summary: {
                totalItemsParsed: matchedItems.length,
                totalMatched,
                totalUnmatched,
                estimatedTotal: Math.round(estimatedTotal * 100) / 100
            }
        };

        // Cache result for 2 minutes
        try {
            await redisClient.setEx(cacheKey, 120, JSON.stringify(response));
        } catch {
            // ignore cache write error
        }

        return response;
    }

    /**
     * Send natural language input to Google Gemini (gemini-3.6-flash)
     */
    private async parseWithGemini(query: string): Promise<{ isMultiItem: boolean; items: ParsedItem[] } | null> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("[GeminiSearch] GEMINI_API_KEY not configured. Falling back to local parser.");
            return null;
        }

        const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const systemPrompt = `You are a grocery list parser for an Indian farm-fresh grocery store "Book My Veg".
Analyze the user's search text.
The user might type or paste:
1. A single product search (e.g. "tomato", "chili", "shimla mirchi")
2. A multi-item grocery shopping list (e.g. "2 kg tomato, 1 kg potato, dhaniya, 500g paneer, 2 milk" or separated by newlines, "and", commas).

Rules:
- Understand English, Hindi, Hinglish, and regional names (e.g. Aloo = Potato, Kanda/Pyaaz = Onion, Tamatar = Tomato, Hari Mirchi = Green Chili, Kothimbir/Dhaniya = Coriander, Bhindi = Lady Finger, Matar = Green Peas, Nimbu = Lemon, Adrak = Ginger, Lahsun = Garlic, Palak = Spinach, Seb = Apple).
- Correct common typos (e.g. "tometo" -> "Tomato", "potatos" -> "Potato").
- Extract:
  - "raw": the exact snippet
  - "name": English canonical name
  - "hindiName": Hindi name
  - "quantity": numeric quantity (default 1 if not specified)
  - "unit": unit if specified (e.g. "KG", "GM", "PACKET", "PIECE", "BUNCH", "LTR", "ML", or null)
- If the text has only ONE single query without quantities/units (e.g. "tomato"), set isMultiItem to false.
- If the text mentions multiple items OR mentions a specific quantity + item (e.g. "2 kg tomato"), set isMultiItem to true.

Output ONLY valid JSON in this exact structure without markdown:
{
  "isMultiItem": true/false,
  "items": [
    {
      "raw": "2 kg tomato",
      "name": "Tomato",
      "hindiName": "Tamatar",
      "quantity": 2,
      "unit": "KG"
    }
  ]
}`;

        try {
            const response = await axios.post(
                url,
                {
                    contents: [
                        {
                            parts: [
                                { text: systemPrompt },
                                { text: `User input: "${query}"` }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json"
                    }
                },
                {
                    headers: { "Content-Type": "application/json" },
                    timeout: 5000
                }
            );

            const candidate = response.data?.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text;
            if (!text) return null;

            // Strip any code fences if present
            const cleanJsonStr = text.replace(/```json/gi, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleanJsonStr);

            return {
                isMultiItem: Boolean(parsed.isMultiItem),
                items: Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
                    raw: String(it.raw || ""),
                    name: String(it.name || "").trim(),
                    hindiName: it.hindiName ? String(it.hindiName).trim() : undefined,
                    quantity: Math.max(1, Number(it.quantity) || 1),
                    unit: it.unit ? String(it.unit).toUpperCase().trim() : null
                })) : []
            };
        } catch (error: any) {
            console.error("[GeminiSearch] Gemini API error:", error.response?.data?.error?.message || error.message);
            return null;
        }
    }

    /**
     * Local regex fallback parser for commas, newlines, and "and"
     */
    private fallbackRuleBasedParse(query: string): { isMultiItem: boolean; items: ParsedItem[] } {
        // Split by newlines or commas or ' and '
        const rawTokens = query.split(/[\n,;]|\band\b/gi).map(s => s.trim()).filter(Boolean);
        const isMulti = rawTokens.length > 1;

        const items: ParsedItem[] = rawTokens.map(token => {
            // Regex to extract quantity and unit e.g. "2 kg tomato", "500g aloo", "3 lemons"
            const match = token.match(/^(\d+(?:\.\d+)?)\s*(kg|kilo|g|gm|gram|grams|ltr|liter|ml|piece|pc|pcs|packet|pack|bunch|bunches)?\s*(.*)$/i);
            
            if (match) {
                const qty = parseFloat(match[1]) || 1;
                let unit = match[2] ? match[2].toUpperCase() : null;
                if (unit === "KILO") unit = "KG";
                if (unit === "GRAM" || unit === "GRAMS" || unit === "G") unit = "GM";
                if (unit === "PC" || unit === "PCS") unit = "PIECE";
                if (unit === "PACK") unit = "PACKET";
                if (unit === "BUNCHES") unit = "BUNCH";
                const name = (match[3] || token).trim();
                return { raw: token, name: name || token, quantity: qty, unit };
            }

            return { raw: token, name: token, quantity: 1, unit: null };
        });

        return { isMultiItem: isMulti, items };
    }

    /**
     * Strictly match parsed items against REAL BookMyVeg catalog products in PostgreSQL
     */
    private async matchItemsAgainstCatalog(
        parsedItems: ParsedItem[],
        locationId?: string
    ): Promise<MatchedShoppingItem[]> {
        // Fetch all active products from PostgreSQL with variants, pricing, and inventory
        const products = await prisma.product.findMany({
            where: { isActive: true },
            include: {
                category: { select: { name: true, slug: true } },
                variants: { where: { isActive: true } },
                pricing: { where: { isActive: true } },
                inventory: locationId ? { where: { locationId } } : true
            }
        });

        const matchedList: MatchedShoppingItem[] = [];

        for (const item of parsedItems) {
            const targetName = (item.name || "").toLowerCase().trim();
            const targetHindi = (item.hindiName || "").toLowerCase().trim();
            const targetRaw = (item.raw || "").toLowerCase().trim();

            let bestProduct: any = null;
            let matchScore = 0;

            for (const prod of products) {
                const pName = prod.name.toLowerCase();
                const pSlug = prod.slug.toLowerCase();

                let tags: string[] = [];
                try {
                    if (typeof prod.tags === "string") tags = JSON.parse(prod.tags);
                    else if (Array.isArray(prod.tags)) tags = prod.tags as any;
                } catch {
                    tags = [];
                }
                const tagList = tags.map(t => String(t).toLowerCase());

                let score = 0;
                let isStrongMatch = false;

                // 1. Direct name match (exact or word boundary)
                if (pName.includes(targetName) || pSlug.includes(targetName)) {
                    score += 15;
                    isStrongMatch = true;
                }
                // 2. Hindi name match
                if (targetHindi && (pName.includes(targetHindi) || tagList.some(t => t.includes(targetHindi)))) {
                    score += 15;
                    isStrongMatch = true;
                }
                // 3. Tag match
                if (tagList.some(t => t === targetName || (targetName.length >= 3 && t.includes(targetName)))) {
                    score += 10;
                    isStrongMatch = true;
                }
                // 4. Word boundary check
                const nameWords = pName.split(/[\s(),/-]+/).filter(Boolean);
                if (nameWords.includes(targetName)) {
                    score += 12;
                    isStrongMatch = true;
                }

                // Never match purely on secondary description mentions unless strong match
                if (isStrongMatch && score > matchScore) {
                    matchScore = score;
                    bestProduct = prod;
                }
            }

            // Only accept if a strong catalog match was established
            if (bestProduct && matchScore >= 10) {
                let selectedVariant: any = null;
                let unitPrice = Number(bestProduct.basePrice) || 0;
                let displayUnit = String(bestProduct.weightUnit || "KG");
                let computedCartQty = 1;

                if (bestProduct.variants && bestProduct.variants.length > 0) {
                    // Try to find matching variant by requested quantity & unit
                    const reqUnit = (item.unit || "").toUpperCase();
                    const reqQty = Number(item.quantity) || 1;

                    // Convert requested to grams if possible
                    let targetGrams = 0;
                    if (reqUnit === "GM" || reqUnit === "G") targetGrams = reqQty;
                    else if (reqUnit === "KG") targetGrams = reqQty * 1000;

                    if (targetGrams > 0) {
                        // Find variant with exact matching weight
                        const exactWeightMatch = bestProduct.variants.find((v: any) => {
                            const vWeight = Number(v.weight) || 0;
                            const vUnit = String(v.weightUnit || "").toUpperCase();
                            const vGrams = (vUnit === "KG") ? vWeight * 1000 : vWeight;
                            return Math.abs(vGrams - targetGrams) < 5;
                        });

                        if (exactWeightMatch) {
                            selectedVariant = exactWeightMatch;
                            unitPrice = Number(exactWeightMatch.price);
                            displayUnit = exactWeightMatch.weightUnit;
                            computedCartQty = 1;
                        } else {
                            // Find closest standard variant (e.g. 1kg or 500g)
                            const sortedVariants = [...bestProduct.variants].sort((a: any, b: any) => {
                                const aG = (a.weightUnit === "KG" ? Number(a.weight) * 1000 : Number(a.weight));
                                const bG = (b.weightUnit === "KG" ? Number(b.weight) * 1000 : Number(b.weight));
                                return Math.abs(aG - targetGrams) - Math.abs(bG - targetGrams);
                            });
                            selectedVariant = sortedVariants[0];
                            unitPrice = Number(selectedVariant.price);
                            displayUnit = selectedVariant.weightUnit;
                            const vG = selectedVariant.weightUnit === "KG" ? Number(selectedVariant.weight) * 1000 : Number(selectedVariant.weight);
                            computedCartQty = vG > 0 ? Math.max(1, Math.round(targetGrams / vG)) : 1;
                        }
                    } else {
                        // Requested in PIECE / PACKET / default count
                        selectedVariant = bestProduct.variants[0];
                        unitPrice = Number(selectedVariant.price);
                        displayUnit = selectedVariant.weightUnit;
                        computedCartQty = reqQty;
                    }
                } else if (bestProduct.pricing && bestProduct.pricing.length > 0) {
                    unitPrice = Number(bestProduct.pricing[0].price);
                    computedCartQty = Number(item.quantity) || 1;
                } else {
                    computedCartQty = Number(item.quantity) || 1;
                }

                // Inventory check
                let stockQuantity = 0;
                if (Array.isArray(bestProduct.inventory)) {
                    stockQuantity = bestProduct.inventory.reduce((sum: number, inv: any) => sum + (Number(inv.currentStock) || 0), 0);
                }
                const inStock = stockQuantity > 0;

                const lineTotal = unitPrice * computedCartQty;

                matchedList.push({
                    rawInput: item.raw,
                    parsedName: item.name,
                    parsedHindiName: item.hindiName,
                    requestedQuantity: computedCartQty,
                    requestedUnit: item.unit || displayUnit,
                    matched: true,
                    product: {
                        id: bestProduct.id,
                        name: bestProduct.name,
                        slug: bestProduct.slug,
                        image: bestProduct.images?.[0] || "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
                        categoryName: bestProduct.category?.name || "Vegetables",
                        price: unitPrice,
                        unit: displayUnit,
                        variantId: selectedVariant?.id,
                        variantName: selectedVariant?.name,
                        inStock,
                        stockQuantity
                    },
                    lineTotal: Math.round(lineTotal * 100) / 100
                });
            } else {
                // Item not found in real catalogue (e.g. Paneer or Milk if not yet seeded)
                matchedList.push({
                    rawInput: item.raw,
                    parsedName: item.name,
                    parsedHindiName: item.hindiName,
                    requestedQuantity: item.quantity || 1,
                    requestedUnit: item.unit || "item",
                    matched: false,
                    product: null,
                    lineTotal: 0,
                    statusMessage: "Not currently available in store catalogue"
                });
            }
        }

        return matchedList;
    }
}
