import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
    getSearchHistory,
    recordSearch,
    clearSearchHistory,
    getPopularSearches,
    smartSearchList
} from "../controllers/searchController";

const router = Router();

router.get("/history", authenticate, getSearchHistory);
router.post("/history", authenticate, recordSearch);
router.delete("/history", authenticate, clearSearchHistory);
router.get("/popular", getPopularSearches);
router.post("/smart-list", smartSearchList);

export default router;
