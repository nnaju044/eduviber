import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        deviceName: {
            type: String,
            default: "Personal Device",
            trim: true,
        },
        deviceType: {
            type: String,
            default: "Desktop",
            trim: true,
        },
        browser: {
            type: String,
            default: "Browser",
            trim: true,
        },
        os: {
            type: String,
            default: "Unknown",
            trim: true,
        },
        ipAddress: {
            type: String,
            default: "",
        },
        lastActiveAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        isRevoked: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    { timestamps: true }
);

deviceSchema.index({ userId: 1, isRevoked: 1 });

export default mongoose.model("Device", deviceSchema);

