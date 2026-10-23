import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        phone: {
            type: String,
            trim: true,
            required: true,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },
        role: {
            type: String,
            enum: ["student", "admin"],
            default: "student",
        },
        mustChangePassword: {
            type: Boolean,
            default: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        resetPasswordTokenHash: {
            type: String,
            select: false,
        },
        resetPasswordExpires: {
            type: Date,
        },
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);