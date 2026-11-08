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
            enum: ["student", "teacher", "super_admin", "admin"],
            default: "student",
        },
        teacherProfile: {
            headline: { type: String, trim: true, default: "" },
            bio: { type: String, trim: true, default: "" },
            payoutUpiId: { type: String, trim: true, default: "" },
            payoutBankDetails: {
                accountName: { type: String, trim: true, default: "" },
                bankName: { type: String, trim: true, default: "" },
                accountNumber: { type: String, trim: true, default: "" },
                ifscCode: { type: String, trim: true, default: "" },
            },
            commissionRate: {
                type: Number,
                default: 0.20,
                min: 0,
                max: 1,
            },
            isApproved: {
                type: Boolean,
                default: false,
            },
            approvedAt: {
                type: Date,
                default: null,
            },
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
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
        // E13: Profile avatar cache-busting version (avoids storing full URL)
        avatarVersion: {
            type: Number,
            default: 0,
        },
        // E13: Email verification workflow fields
        pendingEmail: {
            type: String,
            lowercase: true,
            trim: true,
            default: null,
        },
        emailVerifyTokenHash: {
            type: String,
            select: false,
        },
        emailVerifyExpires: {
            type: Date,
        },
    },
    { timestamps: true }
);

// Normalize legacy "admin" role to "super_admin" on save
userSchema.pre("validate", function () {
    if (this.role === "admin") {
        this.role = "super_admin";
    }
});

export default mongoose.model("User", userSchema);