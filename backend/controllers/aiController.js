import Habit from "../models/habitModel.js";
import HabitLog from "../models/habitLog.js";
import AiInsight from "../models/AiInsight.js";
import { chatCompletion, SYSTEM_PROMPTS, parseJSON } from "../utils/aiService.js";
import { lastNDays, calcStreak, todayKey } from "../utils/dateHelpers.js";

const buildWeeklyContext = async (userId) => {
    const habits = await Habit.find({
        userId,
        isArchived: false,
    });

    const days = lastNDays(7);

    const logs = await HabitLog.find({
        userId,
        completedDate: {
            $gte: days[0],
            $lte: days[days.length - 1],
        },
    });

    const perHabit = habits.map((h) => {
        const completedDates = new Set(
            logs
                .filter((l) => String(l.habitId) === String(h._id))
                .map((l) => l.completedDate)
        );

        return {
            name: h.name,
            category: h.category,
            frequency: h.frequency,
            completedDays: completedDates.size,
            targetDays: h.targetDays || 7,
        };
    });

    return {
        days,
        perHabit,
    };
};

export const weeklyReport = async (req, res) => {
    try {
        const ctx = await buildWeeklyContext(req.user._id);

        if (!ctx.perHabit.length) {
            return res.json({
                content:
                    "You don't have any active habits yet. Create your first habit to start tracking, and I'll generate your weekly report.",
            });
        }

        const userMsg = `Here is the user's habit data for the past 7 days (${ctx.days[0]} to ${ctx.days[6]}):

${ctx.perHabit
    .map(
        (h) =>
            `- ${h.name} (${h.category}, ${h.frequency}): completed ${h.completedDays} of the past 7 days, target ${h.targetDays} days`
    )
    .join("\n")}

Please write the personalised weekly report now.`;

        const { ok, content } = await chatCompletion({
            system: SYSTEM_PROMPTS.weekly,
            user: userMsg,
        });

        if (!ok || !content) {
            return res.status(502).json({
                message: content || "Failed to generate weekly report with AI. Please try again.",
            });
        }

        const insight = await AiInsight.create({
            userId: req.user._id,
            type: "weekly",
            content,
        });

        res.json({
            content,
            createdAt: insight.createdAt,
            _id: insight._id,
        });
    } catch (err) {
        console.error("Weekly report error:", err);
        res.status(500).json({ message: err.message });
    }
};

export const suggestHabits = async (req, res) => {
    try {
        const { goals, productiveTime, struggles } = req.body;

        const userMsg = `User goals: ${goals || "not provided"}
Most productive time: ${productiveTime || "not provided"}
Past struggles: ${struggles || "not provided"}

Please suggest exactly 3 practical and personalised habits for this user.
Return the response strictly as valid JSON in this format:

{
  "suggestions": [
    {
      "name": "Habit name",
      "description": "Short description",
      "frequency": "daily",
      "category": "Fitness",
      "icon": "🏃",
      "reason": "Why this habit is suitable"
    }
  ]
}`;

        const { ok, content } = await chatCompletion({
            system: SYSTEM_PROMPTS.suggestion,
            user: userMsg,
        });

        let suggestions = [];

        if (ok && content) {
            const parsed = parseJSON(content);
            if (Array.isArray(parsed)) {
                suggestions = parsed;
            } else if (parsed && Array.isArray(parsed.suggestions)) {
                suggestions = parsed.suggestions;
            }
        }

        // Fallback suggestions if AI response was unparseable
        if (!suggestions || !suggestions.length) {
            suggestions = [
                {
                    name: "10-minute morning walk",
                    description: "Start the day with light movement and fresh air.",
                    frequency: "daily",
                    category: "Fitness",
                    icon: "🚶",
                    reason: "A low-friction way to build consistency early in the day.",
                },
                {
                    name: "Read 5 pages",
                    description: "Do a short daily reading session to build a learning routine.",
                    frequency: "daily",
                    category: "Learning",
                    icon: "📚",
                    reason: "Small daily reading sessions build significant knowledge over time.",
                },
                {
                    name: "2 minutes of mindful breathing",
                    description: "Pause and breathe slowly to reset your focus.",
                    frequency: "daily",
                    category: "Mindfulness",
                    icon: "🧘",
                    reason: "A tiny anchor habit that can fit into almost any schedule.",
                },
            ];
        }

        if (ok) {
            await AiInsight.create({
                userId: req.user._id,
                type: "suggestion",
                content: JSON.stringify(suggestions),
                meta: {
                    goals,
                    productiveTime,
                    struggles,
                },
            });
        }

        res.json({ suggestions });
    } catch (err) {
        console.error("Suggest habits error:", err);
        res.status(500).json({ message: err.message });
    }
};

export const recoveryPlan = async (req, res) => {
    try {
        const { habitId } = req.body;

        const habit = await Habit.findOne({
            _id: habitId,
            userId: req.user._id,
        });

        if (!habit) {
            return res.status(404).json({ message: "Habit not found" });
        }

        const logs = await HabitLog.find({
            userId: req.user._id,
            habitId,
        }).sort({ completedDate: -1 });

        const keys = logs.map((l) => l.completedDate);
        const { current, longest } = calcStreak(keys);

        const userMsg = `Habit: ${habit.name} (${habit.category}).
Description: ${habit.description || "none"}.
Frequency: ${habit.frequency || "not specified"}.
Current streak: ${current} days.
Longest streak: ${longest} days.

The user recently broke their streak. Create a simple and personalised 3-day recovery plan to help them restart this habit without guilt or pressure.`;

        const { ok, content } = await chatCompletion({
            system: SYSTEM_PROMPTS.recovery,
            user: userMsg,
        });

        if (ok && content) {
            await AiInsight.create({
                userId: req.user._id,
                type: "recovery",
                content,
                meta: {
                    habitId,
                    currentStreak: current,
                    longestStreak: longest,
                },
            });
        }

        res.json({ content });
    } catch (err) {
        console.error("Recovery plan error:", err);
        res.status(500).json({ message: err.message });
    }
};

export const chatAnalysis = async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ message: "Question is required" });
        }

        const habits = await Habit.find({
            userId: req.user._id,
            isArchived: false,
        });

        const days = lastNDays(30);

        const logs = await HabitLog.find({
            userId: req.user._id,
            completedDate: {
                $gte: days[0],
                $lte: days[days.length - 1],
            },
        });

        const context = habits
            .map((h) => {
                const hLogs = logs.filter(
                    (l) => String(l.habitId) === String(h._id)
                );

                const byDow = [0, 0, 0, 0, 0, 0, 0];
                for (const l of hLogs) {
                    const dow = new Date(l.completedDate).getDay();
                    byDow[dow] += 1;
                }

                return `- ${h.name} (${h.category}, ${h.frequency}):
Completed ${hLogs.length} times in the last 30 days.
Sunday: ${byDow[0]}, Monday: ${byDow[1]}, Tuesday: ${byDow[2]},
Wednesday: ${byDow[3]}, Thursday: ${byDow[4]},
Friday: ${byDow[5]}, Saturday: ${byDow[6]}`;
            })
            .join("\n");

        const userMsg = `User question: "${question}"

User data (last 30 days):
${context || "No habit data available."}

Answer the user's question using only the provided habit data.`;

        const { ok, content } = await chatCompletion({
            system: SYSTEM_PROMPTS.chat,
            user: userMsg,
        });

        if (ok && content) {
            await AiInsight.create({
                userId: req.user._id,
                type: "chat",
                content,
                meta: { question },
            });
        }

        res.json({ content });
    } catch (err) {
        console.error("Chat analysis error:", err);
        res.status(500).json({ message: err.message });
    }
};

export const morningMotivation = async (req, res) => {
    try {
        const habits = await Habit.find({
            userId: req.user._id,
            isArchived: false,
        });

        if (!habits.length) {
            return res.json({
                content:
                    "Good morning! Add your first habit today and let's get the momentum started.",
            });
        }

        const days = lastNDays(30);

        const logs = await HabitLog.find({
            userId: req.user._id,
            completedDate: {
                $gte: days[0],
                $lte: days[days.length - 1],
            },
        });

        const ctx = habits
            .map((h) => {
                const hLogs = logs
                    .filter((l) => String(l.habitId) === String(h._id))
                    .map((l) => l.completedDate)
                    .sort()
                    .reverse();

                const { current } = calcStreak(hLogs);
                return `${h.name}: current streak ${current}`;
            })
            .join("\n");

        const today = todayKey();
        const todayLogs = logs.filter((l) => l.completedDate === today);
        const done = todayLogs.length;
        const total = habits.length;

        const userMsg = `Today's habits and streaks:
${ctx}

Done today: ${done}/${total}.

Write the morning motivation message now.`;

        const { ok, content } = await chatCompletion({
            system: SYSTEM_PROMPTS.morning,
            user: userMsg,
            temperature: 0.8,
        });

        if (ok && content) {
            await AiInsight.create({
                userId: req.user._id,
                type: "morning",
                content,
            });
        }

        res.json({ content });
    } catch (err) {
        console.error("Morning motivation error:", err);
        res.status(500).json({ message: err.message });
    }
};

export const getInsightsHistory = async (req, res) => {
    try {
        const { type, limit = 20 } = req.query;
        const filter = { userId: req.user._id };
        if (type) filter.type = type;

        const insights = await AiInsight.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit));

        res.json(insights);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getLatestWeekly = async (req, res) => {
    try {
        const latest = await AiInsight.findOne({
            userId: req.user._id,
            type: "weekly",
        }).sort({ createdAt: -1 });

        res.json(latest || null);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};