import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI is missing from .env");
    }

    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
        }).then((m) => {
            console.log("MongoDB Atlas connected successfully");
            return m;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        console.error("MongoDB connection failed:", error.message);
        throw error;
    }

    return cached.conn;
}