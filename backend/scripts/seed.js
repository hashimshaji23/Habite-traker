import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import User from "../models/userModel.js";
import Habit from "../models/habitModel.js";
import HabitLog from "../models/habitLog.js";
import AiInsight from "../models/AiInsight.js";
import { subDays, format } from "date-fns";

const seed = async () => {
    try {
        await connectDB();
        console.log("Seeding database...");

        // Find or create demo user
        const email = "demo@example.com";
        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                name: "Alex Morgan",
                email,
                password: "password123",
                avatar: "A",
                morningMotivation: true,
            });
            console.log("Created demo user: demo@example.com / password123");
        } else {
            user.password = "password123";
            await user.save();
            console.log("Reset password for demo user:", user.email);
        }

        // Clean old data for this demo user
        await Habit.deleteMany({ userId: user._id });
        await HabitLog.deleteMany({ userId: user._id });
        await AiInsight.deleteMany({ userId: user._id });

        const habitsData = [
            {
                name: "Drink 2L Water",
                description: "Stay hydrated throughout the day",
                category: "Health",
                frequency: "daily",
                targetDays: 7,
                color: "#0ea5e9",
                icon: "💧",
                order: 0,
            },
            {
                name: "Morning Run",
                description: "30-minute outdoor jog before work",
                category: "Fitness",
                frequency: "daily",
                targetDays: 5,
                color: "#ef4444",
                icon: "🏃",
                order: 1,
            },
            {
                name: "Read 20 Pages",
                description: "Read non-fiction or engineering books",
                category: "Learning",
                frequency: "daily",
                targetDays: 7,
                color: "#6366f1",
                icon: "📚",
                order: 2,
            },
            {
                name: "Mindful Meditation",
                description: "10-minute breathwork session",
                category: "Mindfulness",
                frequency: "daily",
                targetDays: 7,
                color: "#8b5cf6",
                icon: "🧘",
                order: 3,
            },
            {
                name: "Strength Training",
                description: "Full body workout in the gym",
                category: "Fitness",
                frequency: "weekly",
                targetDays: 4,
                color: "#f59e0b",
                icon: "🏋️",
                order: 4,
            },
        ];

        const createdHabits = await Habit.insertMany(
            habitsData.map((h) => ({ ...h, userId: user._id }))
        );
        console.log(`Created ${createdHabits.length} habits`);

        // Generate logs for the last 60 days
        const logs = [];
        const today = new Date();

        for (let i = 0; i < 60; i++) {
            const date = subDays(today, i);
            const dateStr = format(date, "yyyy-MM-dd");

            for (const habit of createdHabits) {
                // Different completion probabilities per habit
                let prob = 0.8;
                if (habit.name === "Drink 2L Water") prob = 0.92;
                if (habit.name === "Morning Run") prob = 0.65;
                if (habit.name === "Read 20 Pages") prob = 0.78;
                if (habit.name === "Mindful Meditation") prob = 0.82;
                if (habit.name === "Strength Training") prob = 0.55;

                // Ensure current streak is active for top habits (last 5 days)
                if (i <= 5 && (habit.name === "Drink 2L Water" || habit.name === "Read 20 Pages")) {
                    prob = 1.0;
                }

                if (Math.random() < prob) {
                    logs.push({
                        userId: user._id,
                        habitId: habit._id,
                        completedDate: dateStr,
                        notes: "",
                    });
                }
            }
        }

        await HabitLog.insertMany(logs);
        console.log(`Created ${logs.length} habit logs`);

        // Create sample AI Weekly Report
        await AiInsight.create({
            userId: user._id,
            type: "weekly",
            content: `### 🌟 Great momentum this week!

You've maintained exceptional consistency on **Drink 2L Water** and **Read 20 Pages**, achieving a 100% completion rate over the last 5 days.

**Key Strengths:**
- Hydration is firmly anchored in your daily routine.
- Evening reading habits are showing strong adherence.

**Opportunity for Growth:**
- **Morning Run** dipped slightly midweek (Wednesday/Thursday). Consider preparing your running gear the night before to reduce morning friction.

Keep up the tremendous dedication — you're building habits that truly last!`,
        });

        console.log("Seeding complete! You can now log in with demo@example.com / password123");
        process.exit(0);
    } catch (err) {
        console.error("Seed error:", err);
        process.exit(1);
    }
};

seed();
