import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    likedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    likedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Post", 
      required: true 
    },
    // Optional: like type for different content types
    likeType: {
      type: String,
      enum: ["post", "comment"],
      default: "post"
    }
  },
  { timestamps: true }
);

// Compound index to prevent duplicate likes
likeSchema.index({ likedBy: 1, likedTo: 1 }, { unique: true });
likeSchema.index({ likedTo: 1, createdAt: -1 });

export const Like = mongoose.model("Like", likeSchema);