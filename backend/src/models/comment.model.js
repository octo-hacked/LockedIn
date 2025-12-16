import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    body: { 
      type: String, 
      required: true,
      trim: true,
    },
    commentBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    commentedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Post", 
      required: true 
    },
    // For nested comments (replies)
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null
    },
    // Like functionality for comments
    likes: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
commentSchema.index({ commentedTo: 1, createdAt: -1 });
commentSchema.index({ commentBy: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });

export const Comment = mongoose.model("Comment", commentSchema);