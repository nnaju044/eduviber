import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        thumbnail: {
            type: String,
            default: "",
        },
        instructor: {
            type: String,
            default: "",
        },
        isPublished: {
            type: Boolean,
            default: false,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Fallback to primary admin if ownerId is omitted during legacy creation
courseSchema.pre("validate", async function () {
    if (!this.ownerId) {
        try {
            const admin = await mongoose.model("User").findOne({
                role: { $in: ["super_admin", "admin"] },
            }).select("_id").lean();
            if (admin) {
                this.ownerId = admin._id;
            }
        } catch {
            // Safe fallback during unpopulated test fixtures
        }
    }
});

export default mongoose.model("Course", courseSchema);