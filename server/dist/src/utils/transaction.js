"use strict";
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
exports.withTransactionRetry = withTransactionRetry;
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("./logger"));
const appConfig_1 = require("../config/appConfig");
const MAX_RETRIES = appConfig_1.appConfig.orders.transactionRetryLimit;
/**
 * Retries a transaction function if it fails with a serialization error (code 40001).
 * Uses exponential backoff.
 */
function withTransactionRetry(fn_1) {
    return __awaiter(this, arguments, void 0, function* (fn, isolationLevel = "Serializable") {
        let attempt = 0;
        while (attempt < MAX_RETRIES) {
            try {
                return yield prisma_1.default.$transaction(fn, { isolationLevel });
            }
            catch (error) {
                // Check for serialization failure (Postgres code 40001) or deadlock (40P01)
                // Prisma code P2034 is "Transaction failed due to a write conflict or a deadlock."
                const isRetryable = error.code === "P2034" ||
                    (error.meta && error.meta.code === "40001") ||
                    error.message.includes("deadlock") ||
                    error.message.includes("could not serialize access");
                if (isRetryable && attempt < MAX_RETRIES - 1) {
                    attempt++;
                    const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
                    logger_1.default.warn(`Transaction conflict. Retrying... (Attempt ${attempt}/${MAX_RETRIES})`);
                    yield new Promise((res) => setTimeout(res, delay));
                    continue;
                }
                throw error;
            }
        }
        throw new Error("Transaction failed after max retries");
    });
}
