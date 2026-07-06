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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsBuffer = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const logger_1 = __importDefault(require("../utils/logger"));
exports.metricsBuffer = {
    /**
     * Push a metric item to the high-speed Redis list buffer.
     */
    pushMetric(item) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullItem = Object.assign(Object.assign({}, item), { timestamp: new Date().toISOString() });
                yield redis_1.default.lPush("integration_metrics_buffer", JSON.stringify(fullItem));
            }
            catch (err) {
                logger_1.default.error("Failed to buffer API metric in Redis:", err);
            }
        });
    }
};
