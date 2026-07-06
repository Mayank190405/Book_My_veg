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
const prisma_1 = __importDefault(require("../config/prisma"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Seeding store-1 location...');
        let location = yield prisma_1.default.location.findFirst({ where: { slug: 'store-1' } });
        if (!location) {
            location = yield prisma_1.default.location.create({
                data: {
                    name: 'Store 1',
                    slug: 'store-1',
                    address: 'Store 1 Address',
                    contactNumber: '1111111111'
                }
            });
            console.log('Created Store-1 location.');
        }
        // Update existing POS user to be under store-1, because they are likely testing that
        yield prisma_1.default.user.updateMany({
            where: { role: 'POS_OPERATOR' },
            data: { locationId: location.id }
        });
        console.log('Assigned POS operators to store-1.');
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.default.$disconnect();
}));
