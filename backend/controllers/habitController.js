import habitModel from "../models/habitModel.js";
import habitLog from "../models/habitLog.js";

export const getHabits = async (req, res) => {
    try {
        const { includeArchived } = req.query;
        const filter = { userId: req.user._id };

        if (includeArchived !== "true") filter.isArchived = false;
        const habits = await habitModel.find(filter).sort({ order: 1, createdAt: 1 });
        res.json(habits);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const createHabit = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            frequency,
            targetDays,
            color,
            icon,
        } = req.body;

        if (!name) return res.status(400).json({ message: "Habit name is required" });

        const count = await habitModel.countDocuments({ userId: req.user._id });
        const habit = await habitModel.create({
            userId: req.user._id,
            name,
            description,
            category,
            frequency,
            targetDays,
            color,
            icon,
            order: count,
        });
        res.status(201).json(habit);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateHabit = async (req, res) => {
    try {
        const habit = await habitModel.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!habit) return res.status(404).json({ message: "Habit not found" });

        const fields = [
            "name",
            "description",
            "category",
            "frequency",
            "targetDays",
            "color",
            "icon",
            "order",
        ];

        for (const f of fields) {
            if (req.body[f] !== undefined) habit[f] = req.body[f];
        }
        await habit.save();
        res.json(habit);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const deleteHabit = async (req, res) => {
    try {

        const habit = await habitModel.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!habit) return res.status(404).json({ message: "Habit not found" });
        await habitLog.deleteMany({ habitId: habit._id, userId: req.user._id });
        res.json({ message: "Habit deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const archiveHabit = async (req, res) => {
    try {
        const habit = await habitModel.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!habit) return res.status(404).json({ message: "Habit not found" })

        habit.isArchived = !habit.isArchived;
        await habit.save();
        res.json(habit);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const reorderHabits = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order))
            return res.status(400).json({ message: "Order must be an array" });
        await Promise.all(
            order.map((id, idx) =>
                habitModel.updateOne(
                    { _id: id, userId: req.user._id },
                    { $set: { order: idx } }
                )
            )
        );
        res.json({ message: "Reordered" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};