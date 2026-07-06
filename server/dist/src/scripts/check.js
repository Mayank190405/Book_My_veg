"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log('DATABASE_URL starts with:', (_a = process.env.DATABASE_URL) === null || _a === void 0 ? void 0 : _a.substring(0, 20));
