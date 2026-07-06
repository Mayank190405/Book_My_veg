"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const geocodingController_1 = require("../controllers/geocodingController");
const router = (0, express_1.Router)();
router.get("/autocomplete", geocodingController_1.autocomplete);
router.get("/reverse", geocodingController_1.reverseGeocode);
exports.default = router;
