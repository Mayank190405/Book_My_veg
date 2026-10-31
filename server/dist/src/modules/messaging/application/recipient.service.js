"use strict";
/**
 * Book My Veg — Recipient Resolution Service
 */
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
exports.RecipientService = void 0;
const prisma_1 = __importDefault(require("../../../config/prisma"));
class RecipientService {
    /**
     * Normalizes a phone string to exactly 91XXXXXXXXXX or standard digits.
     */
    static sanitizePhone(rawPhone) {
        const clean = (rawPhone || "").replace(/\D/g, "");
        if (clean.length === 10) {
            return `91${clean}`;
        }
        if (clean.startsWith("91") && clean.length === 12) {
            return clean;
        }
        return clean.length >= 10 ? (clean.startsWith("91") ? clean : `91${clean}`) : clean;
    }
    static isValidPhone(phone) {
        const clean = (phone || "").replace(/\D/g, "");
        return clean.length === 12 && clean.startsWith("91");
    }
    /**
     * Resolves customer name and phone from database if not directly provided.
     */
    static resolveCustomer(customerIdOrPhone) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!customerIdOrPhone)
                return null;
            const isPhone = /^\+?[0-9]{10,14}$/.test(customerIdOrPhone);
            try {
                const user = yield prisma_1.default.user.findFirst({
                    where: Object.assign(Object.assign({}, (isPhone
                        ? { phone: { contains: customerIdOrPhone.slice(-10) } }
                        : { id: customerIdOrPhone })), { isActive: true }),
                    select: { id: true, name: true, phone: true, isActive: true }
                });
                if (user && user.phone) {
                    return {
                        id: user.id,
                        name: user.name || "Customer",
                        phone: this.sanitizePhone(user.phone)
                    };
                }
            }
            catch (_) {
                // Ignore DB error and fallback
            }
            if (isPhone) {
                return {
                    name: "Customer",
                    phone: this.sanitizePhone(customerIdOrPhone)
                };
            }
            return null;
        });
    }
}
exports.RecipientService = RecipientService;
