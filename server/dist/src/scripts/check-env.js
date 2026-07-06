"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({ path: path_1.default.join(__dirname, '../../.env') });
const dbUrl = process.env.DATABASE_URL || '';
const directUrl = process.env.DIRECT_URL || '';
console.log('--- DB Config Debug ---');
console.log('DATABASE_URL present:', !!dbUrl);
if (dbUrl) {
    const parts = dbUrl.split('@');
    if (parts.length > 1) {
        console.log('DATABASE_URL host:', parts[1]);
        const userPart = parts[0].split('//')[1];
        if (userPart) {
            console.log('DATABASE_URL user:', userPart.split(':')[0]);
        }
    }
}
console.log('DIRECT_URL present:', !!directUrl);
if (directUrl) {
    const parts = directUrl.split('@');
    if (parts.length > 1) {
        console.log('DIRECT_URL host:', parts[1]);
        const userPart = parts[0].split('//')[1];
        if (userPart) {
            console.log('DIRECT_URL user:', userPart.split(':')[0]);
        }
    }
}
console.log('--- End ---');
