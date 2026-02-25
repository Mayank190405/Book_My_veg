export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class SlotFullError extends AppError {
    constructor(message = "Delivery slot is full") {
        super(message, 409); // Conflict
    }
}

export class StockError extends AppError {
    constructor(message = "Insufficient stock") {
        super(message, 409); // Conflict
    }
}

export class CouponError extends AppError {
    constructor(message = "Invalid coupon") {
        super(message, 400); // Bad Request
    }
}

export class TransactionConflictError extends AppError {
    constructor(message = "Transaction conflict, please retry") {
        super(message, 409);
    }
}
