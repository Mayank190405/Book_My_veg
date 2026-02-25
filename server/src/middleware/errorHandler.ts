import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import logger from "../utils/logger";
import { appConfig } from "../config/appConfig";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    let statusCode = 500;
    let message = "Internal Server Error";

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }

    // Log the error
    if (statusCode >= 500) {
        logger.error("Unhandled Error", {
            method: req.method,
            url: req.url,
            stack: err.stack,
            error: err.message
        });
    } else {
        logger.warn("Operational Error", {
            method: req.method,
            url: req.url,
            error: err.message
        });
    }

    res.status(statusCode).json({
        status: "error",
        statusCode,
        message: appConfig.env === "development" || err instanceof AppError ? message : "Something went wrong",
    });
};
