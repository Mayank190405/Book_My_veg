import { Request, Response } from "express";
import prisma from "../config/prisma";

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

export const syncCart = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { items } = req.body; // Expecting { productId, variantId, quantity }[]

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        // 1. Get or Create Cart for User
        let cart = await prisma.cart.findUnique({ where: { userId } });
        if (!cart) {
            cart = await prisma.cart.create({ data: { userId } });
        }

        // 2. Upsert items
        for (const item of items) {
            await prisma.cartItem.upsert({
                where: {
                    cartId_productId_variantId: {
                        cartId: cart.id,
                        productId: item.productId,
                        variantId: item.variantId || null
                    }
                },
                update: {
                    quantity: item.quantity,
                    metadata: item.metadata || undefined
                },
                create: {
                    cartId: cart.id,
                    productId: item.productId,
                    variantId: item.variantId || null,
                    quantity: item.quantity,
                    metadata: item.metadata || undefined
                }
            });
        }

        // 3. Fetch updated cart
        const updatedCart = await prisma.cart.findUnique({
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

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error syncing cart" });
    }
};

export const getCart = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        let cart = await prisma.cart.findUnique({
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
            cart = await prisma.cart.create({
                data: { userId },
                include: { items: { include: { product: true, variant: true } } }
            });
        }

        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: "Error fetching cart" });
    }
};

export const updateCartItem = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { productId, variantId, quantity } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        let cart = await prisma.cart.findUnique({ where: { userId } });
        if (!cart) {
            cart = await prisma.cart.create({ data: { userId } });
        }

        if (quantity <= 0) {
            // Remove item
            await prisma.cartItem.deleteMany({
                where: {
                    cartId: cart.id,
                    productId,
                    variantId: variantId || null
                }
            });
        } else {
            // Upsert item
            await prisma.cartItem.upsert({
                where: {
                    cartId_productId_variantId: {
                        cartId: cart.id,
                        productId,
                        variantId: variantId || null
                    }
                },
                update: {
                    quantity,
                    metadata: req.body.metadata || undefined
                },
                create: {
                    cartId: cart.id,
                    productId,
                    variantId: variantId || null,
                    quantity,
                    metadata: req.body.metadata || undefined
                }
            });
        }

        const updatedCart = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: { items: { include: { product: true, variant: true } } }
        });

        res.json(updatedCart);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating cart item" });
    }
};
