import mongoose from "mongoose";
import { getTestDatabaseUri, assertTestDatabaseIsolation, maskUri } from "./testDbGuard.js";

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB(customUri = null) {
    const isTest = process.env.NODE_ENV === "test";
    const uri = customUri || (isTest ? getTestDatabaseUri() : process.env.MONGODB_URI);

    if (!uri) {
        throw new Error(isTest ? "TEST_MONGODB_URI is missing from .env" : "MONGODB_URI is missing from .env");
    }

    if (mongoose.connection.readyState === 1) {
        if (isTest) assertTestDatabaseIsolation(mongoose);
        return mongoose.connection;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
        }).then((m) => {
            if (isTest) {
                assertTestDatabaseIsolation(m);
            }
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