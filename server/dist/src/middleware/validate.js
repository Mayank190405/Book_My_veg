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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const validate = (schema) => (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const parsed = yield schema.parseAsync({
            body: req.body || {},
            query: req.query || {},
            params: req.params || {},
        });
        // Propagation: Back-fill data without breaking Express internal getters
        if (parsed.body)
            req.body = parsed.body;
        if (parsed.query)
            Object.assign(req.query, parsed.query);
        if (parsed.params)
            Object.assign(req.params, parsed.params);
        return next();
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            console.error("DEBUG: Validation Failed for route", req.originalUrl, ":", JSON.stringify(error.errors, null, 2));
            return res.status(400).json({
                message: "Validation failed",
                errors: error.errors.map((e) => ({
                    field: e.path.join("."),
                    message: e.message,
                })),
            });
        }
        console.error("DEBUG: Unexpected Validation Error:", error.message, error.stack);
        return res.status(400).json({ message: "Invalid request data structure" });
    }
});
exports.validate = validate;
