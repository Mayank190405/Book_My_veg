
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

export interface LedgerEntryInput {
    accountId: String;
    debit: number | Prisma.Decimal;
    credit: number | Prisma.Decimal;
}

export interface JournalEntryInput {
    date?: Date;
    reference?: String;
    description?: String;
    transactionId: String;
    locationId: String;
    staffId?: String;
    entries: LedgerEntryInput[];
}

export class AccountingService {
    /**
     * Creates a balanced JournalEntry with multiple LedgerEntries.
     * Enforces double-entry principle (Sum of Debits = Sum of Credits).
     * Enforces PeriodLock constraints.
     */
    static async createJournalEntry(input: JournalEntryInput, tx?: any) {
        const db = tx || prisma;
        const entryDate = input.date || new Date();

        // 1. Check Period Lock
        const year = entryDate.getFullYear();
        const month = entryDate.getMonth() + 1;
        const lock = await db.periodLock.findUnique({
            where: { year_month: { year, month } }
        });

        if (lock && lock.isLocked) {
            throw new Error(`Accounting period ${month}/${year} is locked.`);
        }

        // 2. Validate Balance
        let totalDebit = new Prisma.Decimal(0);
        let totalCredit = new Prisma.Decimal(0);

        for (const entry of input.entries) {
            totalDebit = totalDebit.plus(new Prisma.Decimal(entry.debit));
            totalCredit = totalCredit.plus(new Prisma.Decimal(entry.credit));
        }

        if (!totalDebit.equals(totalCredit)) {
            throw new Error(`Journal Entry is not balanced. Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`);
        }

        // 3. Persist Journal and Ledger Entries
        return await db.journalEntry.create({
            data: {
                date: entryDate,
                reference: input.reference,
                description: input.description,
                transactionId: input.transactionId,
                locationId: input.locationId,
                staffId: input.staffId,
                ledgerEntries: {
                    create: input.entries.map((e) => ({
                        accountId: e.accountId,
                        debit: e.debit,
                        credit: e.credit,
                        locationId: input.locationId,
                        fiscalYear: year,
                        fiscalMonth: month
                    }))
                }
            },
            include: {
                ledgerEntries: true
            }
        });
    }

    /**
     * Calculates account balance from ledger aggregates.
     * No stored "due" or "balance" fields as per the mandate.
     */
    static async getAccountBalance(accountId: string, locationId?: string) {
        const result = await prisma.ledgerEntry.aggregate({
            where: {
                accountId,
                ...(locationId && { locationId })
            },
            _sum: {
                debit: true,
                credit: true
            }
        });

        const debits = result._sum.debit || new Prisma.Decimal(0);
        const credits = result._sum.credit || new Prisma.Decimal(0);

        // Balance calculation depends on account type (Asset/Expense: DR-CR, Liability/Revenue: CR-DR)
        // For simplicity, we return both and let the domain layer decide.
        return {
            debits,
            credits,
            balance: debits.minus(credits)
        };
    }
}
