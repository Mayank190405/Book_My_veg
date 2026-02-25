/**
 * POS Utility Functions
 */

/**
 * Parses machine-generated QR code for weighted items.
 * Format: productId-quantity (e.g., "101-0.25")
 */
export const parseWeightedQR = (qrString: string) => {
    const [productId, quantityStr] = qrString.split('-');
    if (!productId || !quantityStr) return null;

    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity)) return null;

    return { productId, quantity };
};

/**
 * Cash Denominations supported by POS
 */
export const CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

/**
 * Calculates total cash amount based on denominations.
 * notes: Record<string, number> where key is denomination and value is count.
 */
export const calculateTotalCash = (notes: Record<number, number>): number => {
    return Object.entries(notes).reduce((total, [denom, count]) => {
        return total + (Number(denom) * (count || 0));
    }, 0);
};

/**
 * Determines if enough change is available or can be provided.
 * Standard logic for now: returns change amount.
 */
export const calculateChange = (totalAmount: number, cashProvided: number) => {
    const changeAmount = cashProvided - totalAmount;
    return {
        amount: changeAmount,
        isPossible: changeAmount >= 0
    };
};
