import mongoose from 'mongoose';

export const connectDB = async () => {
    const uri = process.env.MONGO_URL;
    const dbName = process.env.MONGO_DB_NAME || "ai_habit_tracker";

    if (!uri) {
        throw new Error("MONGO_URL is not defined in environment variables");
    }

    try {
        // Attempt connection to configured MONGO_URL (e.g. MongoDB Atlas)
        const conn = await mongoose.connect(uri, {
            dbName,
            serverSelectionTimeoutMS: 5000,
        });
        console.log(
            `MongoDB connected : ${conn.connection.host} (db: ${conn.connection.name})`
        );
        return conn;
    } catch (err) {
        console.warn(`Primary MongoDB connection failed (${err.message}). Attempting local fallback...`);

        const localUri = process.env.MONGO_LOCAL_URL || "mongodb://127.0.0.1:27017/ai_habit_tracker";
        try {
            const conn = await mongoose.connect(localUri, {
                serverSelectionTimeoutMS: 3000,
            });
            console.log(
                `MongoDB connected (local fallback) : ${conn.connection.host} (db: ${conn.connection.name})`
            );
            return conn;
        } catch (localErr) {
            console.error("All MongoDB connections failed.");
            console.error("Primary error:", err.message);
            console.error("Local fallback error:", localErr.message);
            throw err;
        }
    }
};