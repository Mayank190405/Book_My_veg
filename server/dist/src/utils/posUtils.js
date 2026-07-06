"use strict";
/**
 * POS Utility Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateChange = exports.calculateTotalCash = exports.CASH_DENOMINATIONS = exports.parseWeightedQR = void 0;
/**
 * Parses machine-generated QR code for weighted items.
 * Format: productId-quantity (e.g., "101-0.25")
 */
const parseWeightedQR = (qrString) => {
    const [productId, quantityStr] = qrString.split('-');
    if (!productId || !quantityStr)
        return null;
    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity))
        return null;
    return { productId, quantity };
};
exports.parseWeightedQR = parseWeightedQR;
/**
 * Cash Denominations supported by POS
 */
exports.CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];
/**
 * Calculates total cash amount based on denominations.
 * notes: Record<string, number> where key is denomination and value is count.
 */
const calculateTotalCash = (notes) => {
    return Object.entries(notes).reduce((total, [denom, count]) => {
        return total + (Number(denom) * (count || 0));
    }, 0);
};
exports.calculateTotalCash = calculateTotalCash;
/**
 * Determines if enough change is available or can be provided.
 * Standard logic for now: returns change amount.
 */
const calculateChange = (totalAmount, cashProvided) => {
    const changeAmount = cashProvided - totalAmount;
    return {
        amount: changeAmount,
        isPossible: changeAmount >= 0
    };
};
exports.calculateChange = calculateChange;
