import * as XLSX from "xlsx";
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";
import { InventoryService } from "./inventoryService";

export interface BulkImportRow {
    name: string;
    sku?: string;
    description?: string;
    basePrice: number;
    categoryId: string;
    stock: number;
    unit?: string;
}

export class BulkImportService {
    private static generateSlug(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w ]+/g, "")
            .replace(/ +/g, "-");
    }

    static async importFromExcel(buffer: Buffer, locationId: string, staffId: string) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet) as any[];

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        const categories = await prisma.category.findMany();
        const categoryMap = new Map<string, string>();
        categories.forEach(c => {
            categoryMap.set(c.name.toLowerCase(), c.id);
            categoryMap.set(c.id, c.id);
        });

        for (const row of data) {
            try {
                const name = row.name || row.Name;
                const sku = row.sku || row.SKU || row.code || row.Code;
                const price = parseFloat(row.price || row.Price || row.basePrice || row.BasePrice);
                const catInput = String(row.category || row.Category || row.categoryId || row.CategoryId || "").toLowerCase();
                const stock = parseInt(row.stock || row.Stock || row.qty || row.Qty || "0");
                const unit = row.unit || row.Unit || "KG";

                if (!name || isNaN(price)) {
                    throw new Error(`Invalid row: Missing name or price for ${name || 'unknown'}`);
                }

                const categoryId = categoryMap.get(catInput);
                if (!categoryId) {
                    throw new Error(`Category not found: ${catInput}`);
                }

                const slug = this.generateSlug(name) + "-" + (sku || Math.random().toString(36).substring(7));

                await prisma.$transaction(async (tx) => {
                    const product = await tx.product.upsert({
                        where: { sku: sku || name },
                        update: {
                            name,
                            basePrice: new Prisma.Decimal(price),
                            categoryId,
                            weightUnit: (unit.toUpperCase() === "PCS" ? "PIECE" : unit.toUpperCase()) as any
                        },
                        create: {
                            sku: sku || name,
                            slug,
                            name,
                            basePrice: new Prisma.Decimal(price),
                            categoryId,
                            weightUnit: (unit.toUpperCase() === "PCS" ? "PIECE" : unit.toUpperCase()) as any,
                            isActive: true
                        }
                    });

                    // 2. Fetch existing inventory for logging
                    const existingInv = await tx.inventory.findUnique({
                        where: {
                            productId_locationId_variantId: {
                                productId: product.id,
                                locationId,
                                variantId: null as any
                            }
                        }
                    });

                    const beforeQty = existingInv?.currentStock || 0;
                    const afterQty = beforeQty + stock;

                    if (afterQty < 0) {
                        throw new Error(`Invalid quantity: ${name} stock cannot fall below 0.`);
                    }

                    // 3. Update Inventory via locked wrapper
                    await InventoryService.adjustGlobalInventory(tx, {
                        productId: product.id,
                        variantId: undefined, // no variant supported in bulk import yet
                        locationId,
                        qtyDelta: stock,
                        referenceType: 'ADJUSTMENT',
                        referenceId: 'BULK_IMPORT',
                        staffId
                    });

                    // 4. Log Inventory change
                    await tx.inventoryLog.create({
                        data: {
                            productId: product.id,
                            locationId,
                            beforeQty: new Prisma.Decimal(beforeQty),
                            afterQty: new Prisma.Decimal(afterQty),
                            delta: new Prisma.Decimal(stock),
                            type: "ADJUSTMENT",
                            staffId
                        }
                    });
                });

                results.success++;
            } catch (err: any) {
                results.failed++;
                results.errors.push(err.message);
            }
        }

        return results;
    }
}
