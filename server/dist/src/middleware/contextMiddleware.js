"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextMiddleware = void 0;
const context_1 = require("../utils/context");
const contextMiddleware = (req, res, next) => {
    var _a, _b, _c;
    // If authenticate middleware has already run, it will have attached req.user
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId) || req.headers['x-location-id'];
    const role = (_c = req.user) === null || _c === void 0 ? void 0 : _c.role;
    (0, context_1.runWithContext)({ userId, locationId, role }, () => {
        next();
    });
};
exports.contextMiddleware = contextMiddleware;
