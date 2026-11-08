import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        financialSnapshot: {
            coursePrice: { type: Number, default: null },
            commissionRate: { type: Number, default: null }, // e.g., 0.20 for 20%
            platformCommission: { type: Number, default: null },
            teacherShare: { type: Number, default: null },
            currency: { type: String, default: "INR" },
            collectionMethod: {
                type: String,
                enum: ["manual_platform", "platform_escrow", "direct_teacher"],
                default: "manual_platform",
            },
            calculatedAt: { type: Date, default: null },
        },
        transactionReference: {
            type: String,
            required: true,
            trim: true,
        },
        proofUrl: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
        rejectionReason: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

// Cache original financial snapshot state when document is loaded
paymentSchema.post("init", function () {
    this._originalFinancialSnapshot = this.financialSnapshot?.calculatedAt
        ? JSON.stringify(this.financialSnapshot)
        : null;
});

// Guard against mutation on document.save()
paymentSchema.pre("save", async function () {
    if (!this.isNew && this.isModified("financialSnapshot")) {
        if (this._originalFinancialSnapshot) {
            throw new Error("Financial snapshot is immutable once recorded.");
        }
        const existing = await this.constructor.findById(this._id).select("financialSnapshot").lean();
        if (existing?.financialSnapshot?.calculatedAt) {
            throw new Error("Financial snapshot is immutable once recorded.");
        }
    }
});

// Guard against mutation on query updates (updateOne, updateMany, findOneAndUpdate, replaceOne, findOneAndReplace)
paymentSchema.pre(
    ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"],
    async function () {
        const update = this.getUpdate();
        if (!update) return;

        const modifiesSnapshot =
            update.financialSnapshot !== undefined ||
            update.$set?.financialSnapshot !== undefined ||
            update.$unset?.financialSnapshot !== undefined ||
            Object.keys(update.$set || {}).some((k) => k.startsWith("financialSnapshot.")) ||
            Object.keys(update.$unset || {}).some((k) => k.startsWith("financialSnapshot.")) ||
            // In replaceOne/findOneAndReplace, update is the replacement document
            (update.title !== undefined || update.amount !== undefined || update.status !== undefined);

        if (modifiesSnapshot) {
            const filter = this.getFilter();
            const existing = await this.model.findOne(filter).select("financialSnapshot").lean();
            if (existing?.financialSnapshot?.calculatedAt) {
                // If it's a replacement or modifying financialSnapshot when already calculated
                const isAttemptingSnapshotChange =
                    update.financialSnapshot !== undefined ||
                    update.$set?.financialSnapshot !== undefined ||
                    update.$unset?.financialSnapshot !== undefined ||
                    Object.keys(update.$set || {}).some((k) => k.startsWith("financialSnapshot.")) ||
                    Object.keys(update.$unset || {}).some((k) => k.startsWith("financialSnapshot.")) ||
                    (this.op === "replaceOne" || this.op === "findOneAndReplace");

                if (isAttemptingSnapshotChange) {
                    throw new Error("Financial snapshot is immutable once recorded.");
                }
            }
        }
    }
);

// Intercept Model.bulkWrite to block batch mutations touching financialSnapshot
paymentSchema.static("bulkWrite", function (ops, options) {
    if (Array.isArray(ops)) {
        for (const op of ops) {
            const update =
                op.updateOne?.update ||
                op.updateMany?.update ||
                op.replaceOne?.replacement;

            if (update) {
                const touchesSnapshot =
                    update.financialSnapshot !== undefined ||
                    update.$set?.financialSnapshot !== undefined ||
                    update.$unset?.financialSnapshot !== undefined ||
                    Object.keys(update.$set || {}).some((k) => k.startsWith("financialSnapshot.")) ||
                    Object.keys(update.$unset || {}).some((k) => k.startsWith("financialSnapshot."));

                if (touchesSnapshot) {
                    throw new Error("Financial snapshot is immutable and cannot be mutated via bulkWrite.");
                }
            }
        }
    }
    return mongoose.Model.bulkWrite.apply(this, arguments);
});

export default mongoose.model("Payment", paymentSchema);