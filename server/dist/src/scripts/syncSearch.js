"use strict";
// server/src/scripts/syncSearch.ts
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
const prisma_1 = __importDefault(require("../config/prisma"));
const searchService_1 = require("../services/searchService");
const context_1 = require("../utils/context");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load env from server root
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🚀 Starting Bulk Sync to Meilisearch...`);
        try {
            // Wrap execution in a context to satisfy Audit middleware and data isolation
            // This will bypass the mandatory checks in prisma.ts
            yield (0, context_1.runWithContext)({ userId: 'SYSTEM', role: 'SUPER_ADMIN' }, () => __awaiter(this, void 0, void 0, function* () {
                // 1. Initialize Settings
                const searchService = searchService_1.SearchService.getInstance();
                yield searchService.init();
                // 2. Fetch all active products
                console.log('📦 Fetching products from database...');
                const products = yield prisma_1.default.product.findMany({
                    where: { isActive: true },
                    include: {
                        category: true,
                        inventory: true
                    }
                });
                console.log(`🔍 Found ${products.length} products to index.`);
                // 3. Batch indexing
                const chunkSize = 100;
                for (let i = 0; i < products.length; i += chunkSize) {
                    const chunk = products.slice(i, i + chunkSize);
                    yield searchService.indexProducts(chunk);
                    console.log(`✅ Indexed ${Math.min(i + chunkSize, products.length)}/${products.length}...`);
                }
                console.log('✨ Bulk Sync Completed Successfully!');
            }));
        }
        catch (error) {
            console.error('❌ Bulk Sync Failed:', error);
        }
        finally {
            yield prisma_1.default.$disconnect();
        }
    });
}
main().catch(console.error);
