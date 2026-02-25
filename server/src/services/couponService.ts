import { CouponError } from "../utils/errors";

export const couponService = {
    /**
     * Validates a coupon code and returns expected discount.
     * Must be called within a transaction to ensure read consistency.
     */
    async validateCoupon(tx: any, code: string, orderAmount: number) {
        const coupon = await tx.coupon.findUnique({ where: { code } });

        if (!coupon) throw new CouponError("Invalid coupon code");
        if (!coupon.isActive) throw new CouponError("Coupon is inactive");
        if (coupon.expiresAt && new Date() > coupon.expiresAt) throw new CouponError("Coupon expired");
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new CouponError("Coupon usage limit reached");
        if (orderAmount < Number(coupon.minOrderAmount)) throw new CouponError(`Minimum order amount is ₹${coupon.minOrderAmount}`);

        let discountAmount = 0;
        if (coupon.discountType === "FLAT") {
            discountAmount = Number(coupon.discountValue);
        } else {
            discountAmount = (orderAmount * Number(coupon.discountValue)) / 100;
            if (coupon.maxDiscount) {
                discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
            }
        }

        return {
            id: coupon.id,
            code: coupon.code,
            discountAmount
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
