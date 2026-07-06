"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionConflictError = exports.CouponError = exports.StockError = exports.SlotFullError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class SlotFullError extends AppError {
    constructor(message = "Delivery slot is full") {
        super(message, 409); // Conflict
    }
}
exports.SlotFullError = SlotFullError;
class StockError extends AppError {
    constructor(message = "Insufficient stock") {
        super(message, 409); // Conflict
    }
}
exports.StockError = StockError;
class CouponError extends AppError {
    constructor(message = "Invalid coupon") {
        super(message, 400); // Bad Request
    }
}
exports.CouponError = CouponError;
class TransactionConflictError extends AppError {
    constructor(message = "Transaction conflict, please retry") {
        super(message, 409);
    }
}
exports.TransactionConflictError = TransactionConflictError;
