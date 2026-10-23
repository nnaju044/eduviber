import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

async function createAdmin() {
    try {
        const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD } =
            process.env;

        if (
            !MONGODB_URI ||
            !ADMIN_NAME ||
            !ADMIN_EMAIL ||
            !ADMIN_PHONE ||
            !ADMIN_PASSWORD
        ) {
            throw new Error("Missing required admin setup environment variables.");
        }

        if (ADMIN_PASSWORD.length < 12) {
            throw new Error("Admin password must be at least 12 characters.");
        }

        await mongoose.connect(MONGODB_URI);

        const email = ADMIN_EMAIL.trim().toLowerCase();
        const existing = await User.findOne({ email });

        if (existing) {
            throw new Error(
                "An account with this email already exists. No account was changed."
            );
        }

        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

        await User.create({
            name: ADMIN_NAME.trim(),
            email,
            phone: ADMIN_PHONE.trim(),
            passwordHash,
            role: "admin",
            mustChangePassword: false,
            isActive: true,
        });

        console.log("Admin account created successfully.");
        console.log(`Admin email: ${email}`);
    } catch (error) {
        console.error("Admin setup failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect().catch(() => { });
    }
}

createAdmin();