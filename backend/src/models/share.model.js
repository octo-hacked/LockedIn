import mongoose from "mongoose";

const shareSchema = new mongoose.Schema(
  {
    sharedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    sharedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }, // optional, for direct shares
    post: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Post", 
      required: true 
    },
    shareType: {
      type: String,
      enum: ["public", "direct", "story"],
      default: "public"
    },
    message: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
shareSchema.index({ sharedBy: 1, createdAt: -1 });
shareSchema.index({ post: 1, createdAt: -1 });
shareSchema.index({ sharedTo: 1, createdAt: -1 });

export const Share = mongoose.model("Share", shareSchema);