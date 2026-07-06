import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validate = (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = await schema.parseAsync({
            body: req.body || {},
            query: req.query || {},
            params: req.params || {},
        });

        // Propagation: Back-fill data without breaking Express internal getters
        if (parsed.body) req.body = parsed.body;
        if (parsed.query) Object.assign(req.query, parsed.query);
        if (parsed.params) Object.assign(req.params, parsed.params);

        return next();
    } catch (error: any) {
        if (error instanceof ZodError) {
            console.error("DEBUG: Validation Failed for route", req.originalUrl, ":", JSON.stringify(error.errors, null, 2));
            return res.status(400).json({
                message: "Validation failed",
                errors: error.errors.map((e: any) => ({
                    field: e.path.join("."),
                    message: e.message,
                })),
            });
        }
        console.error("DEBUG: Unexpected Validation Error:", error.message, error.stack);
        return res.status(400).json({ message: "Invalid request data structure" });
    }
};
