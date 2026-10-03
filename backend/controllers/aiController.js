import Habit from "../models/habitModel.js"
import HabitLog from "../models/habitLog.js"
import AiInsight from "../models/AiInsight.js"
import { chatCompletion, SYSTEM_PROMPTS } from "../utils/aiService.js"
import { lastNDays, calcStreak, todayKey } from "../utils/dateHelpers.js"


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
        const completed = logs.filter(
            (l) => String(l.habitId) === String(h._id)
        ).length;

        return {
            name: h.name,
            category: h.category,
            frequency: h.frequency,
            completedDays: completed,
            targetDays: h.targetDays,
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

        // Check if the user has any active habits
        if (!ctx.perHabit.length) {
            return res.json({
                content:
                    "You don't have any active habits yet. Create your first habit to start tracking, and I'll generate your weekly report.",
            });
        }

        // Build the user's habit data for the AI
        const userMsg = `Here is the user's habit data for the past 7 days (${ctx.days[0]} to ${ctx.days[6]}):

${ctx.perHabit
                .map(
                    (h) =>
                        `- ${h.name} (${h.category}, ${h.frequency}): completed ${h.completedDays} of the past 7 days, target ${h.targetDays} days`
                )
                .join("\n")}

Please write the personalised weekly report now.`;

        // Get AI response
        const { content } = await chatCompletion({
            system: SYSTEM_PROMPTS.weekly,
            user: userMsg,
        });

        // Save the AI insight
        await AiInsight.create({
            userId: req.user._id,
            type: "weekly",
            content,
        });

        // Send response
        res.json({
            content,
        });
    } catch (err) {
        console.error("Weekly report error:", err);

        res.status(500).json({
            message: err.message,
        });
    }
};




export const suggestHabits = async (req, res) => {
    try {
        const { goals, productiveTime, struggles } = req.body;

        const userMsg = `User goals: ${goals || "not provided"}
Most productive time: ${productiveTime || "not provided"}
Past struggles: ${struggles || "not provided"}

Please suggest exactly 3 practical and personalised habits for this user.
Return the response as JSON in this format:

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

        // Get AI suggestions
        const { content } = await chatCompletion({
            system: SYSTEM_PROMPTS.suggestion,
            user: userMsg,
        });

        // Parse AI response
        let suggestions = [];

        try {
            const cleaned = content
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/```\s*$/i, "")
                .trim();

            const parsed = JSON.parse(cleaned);

            suggestions = parsed.suggestions || [];
        } catch (parseError) {
            console.error("AI JSON parsing error:", parseError.message);

            suggestions = [];
        }

        // Fallback suggestions if AI response is invalid
        if (!suggestions.length) {
            suggestions = [
                {
                    name: "10-minute morning walk",
                    description:
                        "Start the day with light movement and fresh air.",
                    frequency: "daily",
                    category: "Fitness",
                    icon: "🚶",
                    reason:
                        "A low-friction way to build consistency early in the day.",
                },
                {
                    name: "Read 5 pages",
                    description:
                        "Do a short daily reading session to build a learning routine.",
                    frequency: "daily",
                    category: "Learning",
                    icon: "📚",
                    reason:
                        "Small daily reading sessions can build significant knowledge over time.",
                },
                {
                    name: "2 minutes of mindful breathing",
                    description:
                        "Pause and breathe slowly to reset your focus.",
                    frequency: "daily",
                    category: "Mindfulness",
                    icon: "🧘",
                    reason:
                        "A tiny anchor habit that can fit into almost any schedule.",
                },
            ];
        }

        // Save suggestions as an AI insight
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

        // Send response
        res.json({
            suggestions,
        });
    } catch (err) {
        console.error("Suggest habits error:", err);

        res.status(500).json({
            message: err.message,
        });
    }
};



export const recoveryPlan = async (req, res) => {
    try {
        const { habitId } = req.body;

        // Find the habit belonging to the logged-in user
        const habit = await Habit.findOne({
            _id: habitId,
            userId: req.user._id,
        });

        if (!habit) {
            return res.status(404).json({
                message: "Habit not found",
            });
        }

        // Get logs for this habit
        const logs = await HabitLog.find({
            userId: req.user._id,
            habitId,
        }).sort({ completedDate: -1 });

        // Extract completed dates
        const keys = logs.map((l) => l.completedDate);

        // Calculate streak
        const { current, longest } = calcStreak(keys);

        // Build AI prompt
        const userMsg = `Habit: ${habit.name} (${habit.category}).
Description: ${habit.description || "none"}.
Frequency: ${habit.frequency || "not specified"}.
Current streak: ${current} days.
Longest streak: ${longest} days.

The user recently broke their streak. Create a simple and personalised 3-day recovery plan to help them restart this habit.`;

        // Get AI recovery plan
        const { content } = await chatCompletion({
            system: SYSTEM_PROMPTS.recovery,
            user: userMsg,
        });

        // Save AI insight
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

        // Send response
        res.json({
            content,
        });
    } catch (err) {
        console.error("Recovery plan error:", err);

        res.status(500).json({
            message: err.message,
        });
    }
};


export const chatAnalysis = async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({
                message: "Question is required",
            });
        }

        // Get user's active habits
        const habits = await Habit.find({
            userId: req.user._id,
            isArchived: false,
        });

        // Get the last 30 days
        const days = lastNDays(30);

        // Get user's habit logs
        const logs = await HabitLog.find({
            userId: req.user._id,
            completedDate: {
                $gte: days[0],
                $lte: days[days.length - 1],
            },
        });

        // Build context for AI
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

        // Build AI message
        const userMsg = `User question: "${question}"

User data (last 30 days):
${context || "No habit data available."}

Answer the user's question using only the provided habit data.`;

        // Get AI response
        const { content } = await chatCompletion({
            system: SYSTEM_PROMPTS.chat,
            user: userMsg,
        });

        // Save AI insight
        await AiInsight.create({
            userId: req.user._id,
            type: "chat",
            content,
            meta: {
                question,
            },
        });

        // Send response
        res.json({
            content,
        });
    } catch (err) {
        console.error("Chat analysis error:", err);

        res.status(500).json({
            message: err.message,
        });
    }
};



export const morningMotivation = async (req, res) => {
    try {
        // Get user's active habits
        const habits = await Habit.find({
            userId: req.user._id,
            isArchived: false,
        });

        // If the user has no habits
        if (!habits.length) {
            return res.json({
                content:
                    "Good morning! Add your first habit today and let's get the momentum started.",
            });
        }

        // Get the last 30 days
        const days = lastNDays(30);

        // Get habit logs
        const logs = await HabitLog.find({
            userId: req.user._id,
            completedDate: {
                $gte: days[0],
                $lte: days[days.length - 1],
            },
        });

        // Build habit context
        const ctx = habits
            .map((h) => {
                const hLogs = logs
                    .filter(
                        (l) => String(l.habitId) === String(h._id)
                    )
                    .map((l) => l.completedDate)
                    .sort()
                    .reverse();

                const { current } = calcStreak(hLogs);

                return `${h.name}: current streak ${current}`;
            })
            .join("\n");

        // Get today's date
        const today = todayKey();

        // Find today's completed habits
        const todayLogs = logs.filter(
            (l) => l.completedDate === today
        );

        const done = todayLogs.length;
        const total = habits.length;

        // Build AI message
        const userMsg = `Today's habits and streaks:
${ctx}

Done today: ${done}/${total}.

Write the morning motivation message now.`;

        // Get AI response
        const { content } = await chatCompletion({
            system: SYSTEM_PROMPTS.morning,
            user: userMsg,
            temperature: 0.8,
        });

        // Save AI insight
        await AiInsight.create({
            userId: req.user._id,
            type: "morning",
            content,
        });

        // Send response
        res.json({
            content,
        });
    } catch (err) {
        console.error("Morning motivation error:", err);

        res.status(500).json({
            message: err.message,
        });
    }
};