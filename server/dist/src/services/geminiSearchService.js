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
exports.GeminiSearchService = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../config/prisma");
const redis_1 = __importDefault(require("../config/redis"));
class GeminiSearchService {
    static getInstance() {
        if (!GeminiSearchService.instance) {
            GeminiSearchService.instance = new GeminiSearchService();
        }
        return GeminiSearchService.instance;
    }
    /**
     * Main entry point for Smart Search & Multi-Item Shopping List Parsing
     */
    processSmartSearch(query, locationId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
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
                const cached = yield redis_1.default.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
            }
            catch (_b) {
                // cache miss / redis down
            }
            // 2. Determine if query is multi-item using Gemini (with fallback heuristic)
            let geminiResult = yield this.parseWithGemini(cleanQuery);
            if (!geminiResult) {
                // Fallback rule-based parsing if Gemini is unavailable
                geminiResult = this.fallbackRuleBasedParse(cleanQuery);
            }
            // 3. If single item, return isMultiItem: false so UI acts as normal search
            if (!geminiResult.isMultiItem || geminiResult.items.length <= 1) {
                // Check if user explicitly asked for 1 item with quantity like "2 kg tomato"
                if (geminiResult.items.length === 1 && (geminiResult.items[0].quantity > 1 || geminiResult.items[0].unit)) {
                    // User specified a shopping list item e.g. "2 kg tomato" -> keep as shopping list item
                }
                else {
                    const response = {
                        isMultiItem: false,
                        originalQuery: cleanQuery,
                        normalizedQuery: ((_a = geminiResult.items[0]) === null || _a === void 0 ? void 0 : _a.name) || cleanQuery,
                        items: [],
                        summary: { totalItemsParsed: 0, totalMatched: 0, totalUnmatched: 0, estimatedTotal: 0 }
                    };
                    return response;
                }
            }
            // 4. Match extracted items against REAL BookMyVeg PostgreSQL Database
            const matchedItems = yield this.matchItemsAgainstCatalog(geminiResult.items, locationId);
            const totalMatched = matchedItems.filter(i => i.matched).length;
            const totalUnmatched = matchedItems.filter(i => !i.matched).length;
            const estimatedTotal = matchedItems.reduce((acc, i) => acc + (i.lineTotal || 0), 0);
            const response = {
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
                yield redis_1.default.setEx(cacheKey, 120, JSON.stringify(response));
            }
            catch (_c) {
                // ignore cache write error
            }
            return response;
        });
    }
    /**
     * Send natural language input to Google Gemini (gemini-3.6-flash)
     */
    parseWithGemini(query) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
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
                const response = yield axios_1.default.post(url, {
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
                }, {
                    headers: { "Content-Type": "application/json" },
                    timeout: 5000
                });
                const candidate = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.candidates) === null || _b === void 0 ? void 0 : _b[0];
                const text = (_e = (_d = (_c = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
                if (!text)
                    return null;
                // Strip any code fences if present
                const cleanJsonStr = text.replace(/```json/gi, "").replace(/```/g, "").trim();
                const parsed = JSON.parse(cleanJsonStr);
                return {
                    isMultiItem: Boolean(parsed.isMultiItem),
                    items: Array.isArray(parsed.items) ? parsed.items.map((it) => ({
                        raw: String(it.raw || ""),
                        name: String(it.name || "").trim(),
                        hindiName: it.hindiName ? String(it.hindiName).trim() : undefined,
                        quantity: Math.max(1, Number(it.quantity) || 1),
                        unit: it.unit ? String(it.unit).toUpperCase().trim() : null
                    })) : []
                };
            }
            catch (error) {
                console.error("[GeminiSearch] Gemini API error:", ((_h = (_g = (_f = error.response) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.error) === null || _h === void 0 ? void 0 : _h.message) || error.message);
                return null;
            }
        });
    }
    /**
     * Local regex fallback parser for commas, newlines, and "and"
     */
    fallbackRuleBasedParse(query) {
        // Split by newlines or commas or ' and '
        const rawTokens = query.split(/[\n,;]|\band\b/gi).map(s => s.trim()).filter(Boolean);
        const isMulti = rawTokens.length > 1;
        const items = rawTokens.map(token => {
            // Regex to extract quantity and unit e.g. "2 kg tomato", "500g aloo", "3 lemons"
            const match = token.match(/^(\d+(?:\.\d+)?)\s*(kg|kilo|g|gm|gram|grams|ltr|liter|ml|piece|pc|pcs|packet|pack|bunch|bunches)?\s*(.*)$/i);
            if (match) {
                const qty = parseFloat(match[1]) || 1;
                let unit = match[2] ? match[2].toUpperCase() : null;
                if (unit === "KILO")
                    unit = "KG";
                if (unit === "GRAM" || unit === "GRAMS" || unit === "G")
                    unit = "GM";
                if (unit === "PC" || unit === "PCS")
                    unit = "PIECE";
                if (unit === "PACK")
                    unit = "PACKET";
                if (unit === "BUNCHES")
                    unit = "BUNCH";
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
    matchItemsAgainstCatalog(parsedItems, locationId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Fetch all active products from PostgreSQL with variants, pricing, and inventory
            const products = yield prisma_1.basePrisma.product.findMany({
                where: { isActive: true },
                include: {
                    category: { select: { name: true, slug: true } },
                    variants: { where: { isActive: true } },
                    pricing: { where: { isActive: true } },
                    inventory: locationId ? { where: { locationId } } : true
                }
            });
            const matchedList = [];
            for (const item of parsedItems) {
                const targetName = (item.name || "").toLowerCase().trim();
                const targetHindi = (item.hindiName || "").toLowerCase().trim();
                const targetRaw = (item.raw || "").toLowerCase().trim();
                let bestProduct = null;
                let matchScore = 0;
                for (const prod of products) {
                    const pName = prod.name.toLowerCase();
                    const pSlug = prod.slug.toLowerCase();
                    let tags = [];
                    try {
                        if (typeof prod.tags === "string")
                            tags = JSON.parse(prod.tags);
                        else if (Array.isArray(prod.tags))
                            tags = prod.tags;
                    }
                    catch (_c) {
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
                    let selectedVariant = null;
                    let unitPrice = Number(bestProduct.basePrice) || 0;
                    let displayUnit = String(bestProduct.weightUnit || "KG");
                    let computedCartQty = 1;
                    if (bestProduct.variants && bestProduct.variants.length > 0) {
                        // Try to find matching variant by requested quantity & unit
                        const reqUnit = (item.unit || "").toUpperCase();
                        const reqQty = Number(item.quantity) || 1;
                        // Convert requested to grams if possible
                        let targetGrams = 0;
                        if (reqUnit === "GM" || reqUnit === "G")
                            targetGrams = reqQty;
                        else if (reqUnit === "KG")
                            targetGrams = reqQty * 1000;
                        if (targetGrams > 0) {
                            // Find variant with exact matching weight
                            const exactWeightMatch = bestProduct.variants.find((v) => {
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
                            }
                            else {
                                // Find closest standard variant (e.g. 1kg or 500g)
                                const sortedVariants = [...bestProduct.variants].sort((a, b) => {
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
                        }
                        else {
                            // Requested in PIECE / PACKET / default count
                            selectedVariant = bestProduct.variants[0];
                            unitPrice = Number(selectedVariant.price);
                            displayUnit = selectedVariant.weightUnit;
                            computedCartQty = reqQty;
                        }
                    }
                    else if (bestProduct.pricing && bestProduct.pricing.length > 0) {
                        unitPrice = Number(bestProduct.pricing[0].price);
                        computedCartQty = Number(item.quantity) || 1;
                    }
                    else {
                        computedCartQty = Number(item.quantity) || 1;
                    }
                    // Inventory check
                    let stockQuantity = 0;
                    if (Array.isArray(bestProduct.inventory)) {
                        stockQuantity = bestProduct.inventory.reduce((sum, inv) => sum + (Number(inv.currentStock) || 0), 0);
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
                            image: ((_a = bestProduct.images) === null || _a === void 0 ? void 0 : _a[0]) || "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
                            categoryName: ((_b = bestProduct.category) === null || _b === void 0 ? void 0 : _b.name) || "Vegetables",
                            price: unitPrice,
                            unit: displayUnit,
                            variantId: selectedVariant === null || selectedVariant === void 0 ? void 0 : selectedVariant.id,
                            variantName: selectedVariant === null || selectedVariant === void 0 ? void 0 : selectedVariant.name,
                            inStock,
                            stockQuantity
                        },
                        lineTotal: Math.round(lineTotal * 100) / 100
                    });
                }
                else {
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
        });
    }
}
exports.GeminiSearchService = GeminiSearchService;
