
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { 
    addStoreExpense,
    getStoreExpenses
} from "../controllers/expenseController";

const router = Router();

router.use(authenticate);

router.post("/add", addStoreExpense);
router.get("/store/:locationId", getStoreExpenses);

export default router;
