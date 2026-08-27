import { Router } from "express";
import { 
    getDashboardStats, 
    openShift, 
    closeShift, 
    getSalesReports,
    getCustomerSalesAndDueReports,
    getCustomerDetailedReport,
    getDailyProductReport
} from "../controllers/dashboardController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Dashboard Analytics (Protected)
router.get("/stats", authenticate, getDashboardStats);
router.get("/reports", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), getSalesReports);
router.get("/daily-product-reports", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), getDailyProductReport);
router.get("/customer-reports", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), getCustomerSalesAndDueReports);
router.get("/customer-reports/:customerId", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), getCustomerDetailedReport);

// Shift Management (Hub/Staff specific)
router.post("/shift/open", authenticate, openShift);
router.post("/shift/close", authenticate, closeShift);

export default router;

