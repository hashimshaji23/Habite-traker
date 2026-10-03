import express from 'express';
import {
    chatAnalysis,
    morningMotivation,
    recoveryPlan,
    suggestHabits,
    weeklyReport,
    getInsightsHistory,
    getLatestWeekly,
} from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post("/weekly-report", weeklyReport);
router.get("/weekly-report/latest", getLatestWeekly);
router.post("/suggest-habits", suggestHabits);
router.post('/recovery-plan', recoveryPlan);
router.post("/chat", chatAnalysis);
router.get("/morning", morningMotivation);
router.get("/history", getInsightsHistory);

export default router;