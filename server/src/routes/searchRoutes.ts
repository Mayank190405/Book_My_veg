import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
    getSearchHistory,
    recordSearch,
    clearSearchHistory,
    getPopularSearches
} from "../controllers/searchController";

const router = Router();

router.get("/history", authenticate, getSearchHistory);
router.post("/history", authenticate, recordSearch);
router.delete("/history", authenticate, clearSearchHistory);
router.get("/popular", getPopularSearches);

export default router;
