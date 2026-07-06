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
exports.updateCartItem = exports.getCart = exports.syncCart = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const syncCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { items } = req.body; // Expecting { productId, variantId, quantity }[]
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        // 1. Get or Create Cart for User
        let cart = yield prisma_1.default.cart.findUnique({ where: { userId } });
        if (!cart) {
            cart = yield prisma_1.default.cart.create({ data: { userId } });
        }
        // 2. Manual Upsert items (Avoid composite key null crash)
        for (const item of items) {
            // Verify product exists as registry may have reset
            const product = yield prisma_1.default.product.findUnique({ where: { id: item.productId } });
            if (!product)
                continue; // Skip stale identifiers
            const vId = item.variantId || null;
            const existing = yield prisma_1.default.cartItem.findFirst({
                where: { cartId: cart.id, productId: item.productId, variantId: vId }
            });
            if (existing) {
                yield prisma_1.default.cartItem.update({
                    where: { id: existing.id },
                    data: {
                        quantity: item.quantity,
                        metadata: item.metadata || undefined
                    }
                });
            }
            else {
                yield prisma_1.default.cartItem.create({
                    data: {
                        cartId: cart.id,
                        productId: item.productId,
                        variantId: vId,
                        quantity: item.quantity,
                        metadata: item.metadata || undefined
                    }
                });
            }
        }
        // 3. Fetch updated cart
        const updatedCart = yield prisma_1.default.cart.findUnique({
            where: { id: cart.id },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true
                    }
                }
            }
        });
        res.json(updatedCart);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error syncing cart" });
    }
});
exports.syncCart = syncCart;
const getCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        let cart = yield prisma_1.default.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!cart) {
            cart = yield prisma_1.default.cart.create({
                data: { userId },
                include: { items: { include: { product: true, variant: true } } }
            });
        }
        res.json(cart);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching cart" });
    }
});
exports.getCart = getCart;
const updateCartItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { productId, variantId, quantity } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    if (!productId)
        return res.status(400).json({ message: "productId is required" });
    try {
        let cart = yield prisma_1.default.cart.findUnique({ where: { userId } });
        if (!cart) {
            cart = yield prisma_1.default.cart.create({ data: { userId } });
        }
        // Verify product registry entry exists
        const product = yield prisma_1.default.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ message: "Requested merchandise not found in registry" });
        }
        if (quantity <= 0) {
            // Remove item
            yield prisma_1.default.cartItem.deleteMany({
                where: {
                    cartId: cart.id,
                    productId,
                    variantId: variantId || null
                }
            });
        }
        else {
            // Manual Upsert item (Avoid composite key null crash)
            const vId = variantId || null;
            const existing = yield prisma_1.default.cartItem.findFirst({
                where: { cartId: cart.id, productId, variantId: vId }
            });
            if (existing) {
                yield prisma_1.default.cartItem.update({
                    where: { id: existing.id },
                    data: {
                        quantity,
                        metadata: req.body.metadata || undefined
                    }
                });
            }
            else {
                yield prisma_1.default.cartItem.create({
                    data: {
                        cartId: cart.id,
                        productId,
                        variantId: vId,
                        quantity,
                        metadata: req.body.metadata || undefined
                    }
                });
            }
        }
        const updatedCart = yield prisma_1.default.cart.findUnique({
            where: { id: cart.id },
            include: { items: { include: { product: true, variant: true } } }
        });
        res.json(updatedCart);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating cart item" });
    }
});
exports.updateCartItem = updateCartItem;
