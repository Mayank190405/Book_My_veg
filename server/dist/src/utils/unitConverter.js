"use strict";
/**
 * Comprehensive Unit Converter Utility
 * Validates and converts variant weight/quantities into base product inventory units
 * Supports: KG, GM, LTR, ML, PIECE, PACKET
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUnit = normalizeUnit;
exports.convertVariantToBaseQuantity = convertVariantToBaseQuantity;
exports.calculateAvailablePackStock = calculateAvailablePackStock;
function normalizeUnit(unitStr) {
    if (!unitStr)
        return "GM";
    const u = unitStr.trim().toUpperCase();
    if (u === "KG" || u === "KILOGRAM" || u === "KILOGRAMS")
        return "KG";
    if (u === "G" || u === "GM" || u === "GRAM" || u === "GRAMS")
        return "GM";
    if (u === "LTR" || u === "LITER" || u === "LITRE" || u === "LITRES")
        return "LTR";
    if (u === "ML" || u === "MILLILITER" || u === "MILLILITERS")
        return "ML";
    if (u === "PIECE" || u === "PCS" || u === "PC" || u === "PIECES")
        return "PIECE";
    if (u === "PACKET" || u === "PKT" || u === "PACK" || u === "PACKETS" || u === "PKTS")
        return "PACKET";
    return u;
}
/**
 * Calculates how many base product inventory units are consumed by N units of a variant
 */
function convertVariantToBaseQuantity(variantWeight, variantUnitRaw, baseUnitRaw, itemCount = 1) {
    const weight = Number(variantWeight) || 1;
    const vUnit = normalizeUnit(variantUnitRaw);
    const bUnit = normalizeUnit(baseUnitRaw);
    // 1. Weight Conversions (KG <-> GM)
    if (bUnit === "KG" && vUnit === "GM") {
        return (weight / 1000) * itemCount;
    }
    if (bUnit === "GM" && vUnit === "KG") {
        return (weight * 1000) * itemCount;
    }
    // 2. Volume Conversions (LTR <-> ML)
    if (bUnit === "LTR" && vUnit === "ML") {
        return (weight / 1000) * itemCount;
    }
    if (bUnit === "ML" && vUnit === "LTR") {
        return (weight * 1000) * itemCount;
    }
    // 3. Direct Unit Match or Count Units (PIECE, PACKET, matching units)
    return weight * itemCount;
}
/**
 * Calculates available pack count on Website given base product stock
 */
function calculateAvailablePackStock(baseStock, variantWeight, variantUnitRaw, baseUnitRaw) {
    const baseConsumedPerPack = convertVariantToBaseQuantity(variantWeight, variantUnitRaw, baseUnitRaw, 1);
    if (baseConsumedPerPack <= 0)
        return 0;
    return Math.floor(baseStock / baseConsumedPerPack);
}
