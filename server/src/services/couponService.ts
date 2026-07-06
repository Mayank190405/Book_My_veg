import { CouponError } from "../utils/errors";

export interface CartItemInput {
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
    categoryId?: string;
    name?: string;
}

export const couponService = {
    /**
     * Validates a coupon code and returns expected discount.
     * Must be called within a transaction to ensure read consistency.
     */
    async validateCoupon(
        tx: any, 
        code: string, 
        orderAmount: number, 
        userId?: string, 
        cartItems: CartItemInput[] = [], 
        paymentMethod?: string,
        pincode?: string
    ) {
        const normalizedCode = code.toUpperCase().trim();
        
        // Fetch coupon and all targeting associations
        const coupon = await tx.coupon.findUnique({
            where: { code: normalizedCode },
            include: {
                targetedUsers: true // Fetch individually targeted user rows
            }
        });

        if (!coupon) throw new CouponError("Invalid coupon code");
        if (!coupon.isActive) throw new CouponError("This coupon is currently inactive");
        
        // ── 1. Temporal & Scheduling Checks ─────────────────────────
        const now = new Date();
        if (coupon.expiresAt && now > coupon.expiresAt) {
            throw new CouponError("Coupon expired");
        }
        
        if (coupon.scheduleRulesJson) {
            const rules = coupon.scheduleRulesJson as any;
            if (rules.daysOfWeek && rules.daysOfWeek.length > 0) {
                if (!rules.daysOfWeek.includes(now.getDay())) {
                    throw new CouponError("This coupon is not valid on this day of the week.");
                }
            }
            if (rules.startHour !== undefined && rules.endHour !== undefined) {
                const currentHour = now.getHours();
                if (currentHour < rules.startHour || currentHour >= rules.endHour) {
                    throw new CouponError(`This exclusive deal is only redeemable between ${rules.startHour}:00 and ${rules.endHour}:00!`);
                }
            }
        }

        // ── 2. Geofence & Location Checks ───────────────────────────
        if (coupon.allowedPincodes && coupon.allowedPincodes.length > 0) {
            let activePincode = pincode;
            if (!activePincode && userId) {
                // If pincode isn't passed, fetch the default address of the user
                const defaultAddress = await tx.address.findFirst({
                    where: { userId, isDefault: true }
                });
                activePincode = defaultAddress?.pincode || undefined;
            }
            if (!activePincode || !coupon.allowedPincodes.includes(activePincode)) {
                throw new CouponError("This coupon is not available for your delivery location.");
            }
        }

        // ── 3. Payment Method Checks ────────────────────────────────
        if (paymentMethod && coupon.allowedPayment.length > 0) {
            const normalizedPayments = coupon.allowedPayment.map((p: string) => p.toUpperCase().trim());
            if (!normalizedPayments.includes(paymentMethod.toUpperCase().trim())) {
                throw new CouponError(`This promo requires payment via: ${coupon.allowedPayment.join(", ")}`);
            }
        }

        // ── 4. Dedicated User Targeting Checks ──────────────────────
        const isIndividuallyTargeted = coupon.targetedUsers && coupon.targetedUsers.length > 0;
        if (isIndividuallyTargeted) {
            if (!userId) {
                throw new CouponError("Please log in to apply this exclusive coupon.");
            }
            const hasAccess = coupon.targetedUsers.some((target: any) => target.userId === userId);
            if (!hasAccess) {
                throw new CouponError("This is an exclusive coupon dedicated to specific users.");
            }
        }

        // ── 5. Segment & Loyalty Group Checks ───────────────────────
        const requiresSegmentCheck = coupon.userSegments && coupon.userSegments.length > 0 && !coupon.userSegments.includes("ALL");
        if (requiresSegmentCheck) {
            if (!userId) {
                throw new CouponError("Please log in to apply this exclusive coupon.");
            }
            const currentUser = await tx.user.findUnique({ where: { id: userId } });
            if (!currentUser) throw new CouponError("User profile not found.");

            const ordersCount = await tx.order.count({
                where: { userId, status: { not: "CANCELLED" } }
            });

            const matchesSegment = coupon.userSegments.some((segment: any) => {
                if (segment === "FIRST_ORDER_BUYERS") {
                    return ordersCount === 0;
                }
                if (segment === "LOYAL_SHOPPERS") {
                    return ordersCount >= 3;
                }
                if (segment === "STUDENTS") {
                    return (currentUser.email && currentUser.email.toLowerCase().endsWith(".edu")) || 
                           (currentUser.profileAddress && currentUser.profileAddress.toLowerCase().includes("hostel"));
                }
                if (segment === "CORPORATE_PANTRY") {
                    return (currentUser.profileAddress && currentUser.profileAddress.toLowerCase().includes("office")) || 
                           (currentUser.profileAddress && currentUser.profileAddress.toLowerCase().includes("corp"));
                }
                return false;
            });

            if (!matchesSegment) {
                throw new CouponError("You do not qualify for this group-specific offer.");
            }
        }

        // ── 6. Global & Personal Usage Limit Checks ─────────────────
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            throw new CouponError("Coupon usage limit reached.");
        }

        if (userId) {
            const userUsedCount = await tx.order.count({
                where: { userId, couponId: coupon.id, status: { not: "CANCELLED" } }
            });
            if (userUsedCount >= coupon.userUsageLimit) {
                throw new CouponError(`You have already redeemed this coupon the maximum allowed ${coupon.userUsageLimit} time(s).`);
            }
        }

        // ── 7. Order Amount Verification ────────────────────────────
        if (orderAmount < Number(coupon.minOrderAmount)) {
            throw new CouponError(`Minimum order amount for this coupon is ₹${coupon.minOrderAmount}`);
        }

        // ── 8. Cart Rules & Combo Validation ────────────────────────
        if (coupon.cartRulesJson) {
            const rules = coupon.cartRulesJson as any;
            
            // Category Spend Checks (e.g. Dairy orders above ₹499)
            if (rules.requireCategorySpend) {
                const categorySpend = cartItems
                    .filter((item: any) => item.categoryId === rules.requireCategorySpend.id)
                    .reduce((sum: number, item: any) => sum + (Number(item.price) * Number(item.quantity)), 0);
                
                if (categorySpend < rules.requireCategorySpend.minSpend) {
                    throw new CouponError(`Spend at least ₹${rules.requireCategorySpend.minSpend} in the ${rules.requireCategorySpend.name || 'required'} category to unlock this coupon!`);
                }
            }

            // Combo Items Checks (e.g. Atta + Rice + Dal combo)
            if (rules.requireComboItems && rules.requireComboItems.length > 0) {
                const cartProductIds = cartItems.map((item: any) => item.productId);
                const hasAllComboItems = rules.requireComboItems.every((requiredId: string) => 
                    cartProductIds.includes(requiredId)
                );
                if (!hasAllComboItems) {
                    throw new CouponError("Add all required items in this combo pack to unlock the discount!");
                }
            }

            // Specific Required Items with Quantities Check (e.g. Buy 3 dairy products)
            if (rules.requireItems && rules.requireItems.length > 0) {
                for (const reqItem of rules.requireItems) {
                    const cartItem = cartItems.find((item: any) => item.productId === reqItem.id);
                    if (!cartItem || Number(cartItem.quantity) < reqItem.qty) {
                        const productName = reqItem.name || "required product";
                        throw new CouponError(`You must add at least ${reqItem.qty} quantity of ${productName} to unlock this coupon.`);
                    }
                }
            }
        }

        // ── 9. Discount Calculations based on Coupon Type ──────────
        let discountAmount = 0;

        if (coupon.type === "DISCOUNT") {
            if (coupon.discountType === "FLAT") {
                discountAmount = Number(coupon.discountValue || 0);
            } else {
                discountAmount = (orderAmount * Number(coupon.discountValue || 0)) / 100;
            }
        } else if (coupon.type === "ITEM_DISCOUNT") {
            if (coupon.rewardProductId) {
                const targetItem = cartItems.find((item: any) => item.productId === coupon.rewardProductId);
                if (!targetItem) {
                    throw new CouponError("Add the discounted product to your cart to receive the coupon benefit!");
                }
                const itemPrice = Number(targetItem.price || 0);
                if (coupon.discountType === "FLAT") {
                    discountAmount = Number(coupon.discountValue || 0) * Number(targetItem.quantity);
                } else {
                    discountAmount = ((itemPrice * Number(coupon.discountValue || 0)) / 100) * Number(targetItem.quantity);
                }
            }
        } else if (coupon.type === "SPECIAL_PRICE_ITEM") {
            if (coupon.rewardProductId && coupon.specialPrice !== null) {
                const targetItem = cartItems.find((item: any) => item.productId === coupon.rewardProductId);
                if (!targetItem) {
                    throw new CouponError("Add the special deal product to your cart to get the discounted price!");
                }
                const originalPrice = Number(targetItem.price || 0);
                const specialPrice = Number(coupon.specialPrice || 0);
                if (originalPrice > specialPrice) {
                    // Discount is the savings on one item (or up to quantity if we allow bulk, let's cap at 1 unit for premium offers)
                    discountAmount = (originalPrice - specialPrice);
                }
            }
        } else if (coupon.type === "FREE_GIFT") {
            if (coupon.rewardProductId) {
                const targetItem = cartItems.find((item: any) => item.productId === coupon.rewardProductId);
                if (!targetItem) {
                    throw new CouponError("Add the free reward product to your cart to redeem this coupon!");
                }
                const originalPrice = Number(targetItem.price || 0);
                // The cost of 1 unit of this product is fully discounted
                discountAmount = originalPrice;
            }
        } else if (coupon.type === "CASHBACK") {
            // Cashback is credited to user wallet, discountAmount is 0 for the checkout bill itself
            // but we can compute it for audit or visual confirmation
            discountAmount = 0;
        }

        // Apply max discount cap
        if (coupon.maxDiscount && discountAmount > Number(coupon.maxDiscount)) {
            discountAmount = Number(coupon.maxDiscount);
        }

        // Ensure discount is not greater than the order amount itself
        discountAmount = Math.min(discountAmount, orderAmount);

        return {
            id: coupon.id,
            code: coupon.code,
            discountAmount,
            type: coupon.type,
            rewardProductId: coupon.rewardProductId,
            specialPrice: coupon.specialPrice,
            description: coupon.description || (coupon.discountType === "FLAT" ? `₹${Number(coupon.discountValue)} OFF` : `${Number(coupon.discountValue)}% OFF`)
        };
    },

    /**
     * Increments coupon usage count.
     */
    async incrementUsage(tx: any, couponId: string) {
        await tx.coupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } }
        });
    }
};
