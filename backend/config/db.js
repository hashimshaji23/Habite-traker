import mongoose from 'mongoose';

export const connectDB = async () => {

    try {
        const uri = process.env.MONGO_URL;
        if (!uri) throw new Error("MONGO_URL is not defined");
        const conn = await mongoose.connect(uri, {
            dbName: process.env.MONGO_DB_NAME || "ai_habit_tracker",
        });
        console.log(
            `MongoDB connected : ${conn.connection.host} (db: ${conn.connection.name})`
        );

    } catch (err) {
        console.error("MongoDB connection error:", err.message);
        process.exit(1);
    }
}