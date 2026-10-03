import express, { Router } from "express";
import { getAllStats, getHabitStats, getHeatmap, getRange, getToday, markComplete, unmarkComplete } from "../controllers/logControllers.js";
import { protect } from "../middleware/auth.js"

const router = express.Router();
router.use(protect)

router.post("/",markComplete);
router.delete("/", unmarkComplete);
router.get("/today", getToday);
router.get("/range", getRange);
router.get("/heatmap", getHeatmap);
router.get("/stats", getAllStats);
router.get("/stats/:habitId", getHabitStats);

export default router;
