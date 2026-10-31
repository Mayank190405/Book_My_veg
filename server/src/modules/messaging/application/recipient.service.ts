/**
 * Book My Veg — Recipient Resolution Service
 */

import prisma from "../../../config/prisma";

export class RecipientService {
    /**
     * Normalizes a phone string to exactly 91XXXXXXXXXX or standard digits.
     */
    public static sanitizePhone(rawPhone: string): string {
        const clean = (rawPhone || "").replace(/\D/g, "");
        if (clean.length === 10) {
            return `91${clean}`;
        }
        if (clean.startsWith("91") && clean.length === 12) {
            return clean;
        }
        return clean.length >= 10 ? (clean.startsWith("91") ? clean : `91${clean}`) : clean;
    }

    public static isValidPhone(phone: string): boolean {
        const clean = (phone || "").replace(/\D/g, "");
        return clean.length === 12 && clean.startsWith("91");
    }

    /**
     * Resolves customer name and phone from database if not directly provided.
     */
    public static async resolveCustomer(
        customerIdOrPhone: string
    ): Promise<{ id?: string; name: string; phone: string } | null> {
        if (!customerIdOrPhone) return null;

        const isPhone = /^\+?[0-9]{10,14}$/.test(customerIdOrPhone);

        try {
            const user = await prisma.user.findFirst({
                where: {
                    ...(isPhone
                        ? { phone: { contains: customerIdOrPhone.slice(-10) } }
                        : { id: customerIdOrPhone }),
                    isActive: true
                },
                select: { id: true, name: true, phone: true, isActive: true }
            });

            if (user && user.phone) {
                return {
                    id: user.id,
                    name: user.name || "Customer",
                    phone: this.sanitizePhone(user.phone)
                };
            }
        } catch (_) {
            // Ignore DB error and fallback
        }

        if (isPhone) {
            return {
                name: "Customer",
                phone: this.sanitizePhone(customerIdOrPhone)
            };
        }

        return null;
    }
}

