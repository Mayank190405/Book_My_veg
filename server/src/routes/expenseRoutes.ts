import { Router } from "express";
import * as expenseController from "../controllers/expenseController";

const router = Router();

router.post("/", expenseController.recordExpense);
router.get("/store/:locationId", expenseController.getStoreExpenses);
router.get("/summary", expenseController.getGlobalSummary);

export default router;
