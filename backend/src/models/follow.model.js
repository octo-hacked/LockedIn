import mongoose from "mongoose";

const followSchema = new mongoose.Schema(
  {
    followedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    followedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    // Optional: follow type for different relationships
    followType: {
      type: String,
      enum: ["follow", "close_friend", "mute"],
      default: "follow"
    }
  },
  { timestamps: true }
);

// Compound index to prevent duplicate follows
followSchema.index({ followedBy: 1, followedTo: 1 }, { unique: true });
followSchema.index({ followedTo: 1, createdAt: -1 });
followSchema.index({ followedBy: 1, createdAt: -1 });

export const Follow = mongoose.model("Follow", followSchema);