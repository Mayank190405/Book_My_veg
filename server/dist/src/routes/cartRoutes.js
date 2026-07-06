"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cartController_1 = require("../controllers/cartController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate); // Protect all cart routes
router.post("/sync", cartController_1.syncCart);
router.get("/", cartController_1.getCart);
router.post("/update", cartController_1.updateCartItem);
exports.default = router;
