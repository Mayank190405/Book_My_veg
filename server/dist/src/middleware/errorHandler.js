"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const appConfig_1 = require("../config/appConfig");
const errorHandler = (err, req, res, next) => {
    let statusCode = 500;
    let message = "Internal Server Error";
    if (err instanceof errors_1.AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    // Log the error
    if (statusCode >= 500) {
        console.error("🔥 RAW ERROR:", err);
        logger_1.default.error("Unhandled Error", {
            method: req.method,
            url: req.url,
            stack: err.stack,
            error: err.message
        });
    }
    else {
        logger_1.default.warn("Operational Error", {
            method: req.method,
            url: req.url,
            error: err.message
        });
    }
    res.status(statusCode).json({
        status: "error",
        statusCode,
        message: appConfig_1.appConfig.env === "development" || err instanceof errors_1.AppError ? message : "Something went wrong",
    });
};
exports.errorHandler = errorHandler;
