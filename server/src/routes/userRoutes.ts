import { Router } from "express";
import { updateProfile, searchUsers } from "../controllers/userController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateProfileSchema } from "../schemas/authSchemas";

const router = Router();

router.put("/profile", authenticate, validate(updateProfileSchema), updateProfile);
router.get("/search", authenticate, searchUsers);

export default router;
