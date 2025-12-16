import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    comments: {
      type: Number,
      default: 0,
    },
    contentType: {
      type: String,
      enum: ["text", "image", "video", "audio", "link"],
      required: true,
    },
    category: {
      type: String,
      enum: ["news", "memes", "other", "tech", "lifestyle", "entertainment", "sports"],
      default: "other",
    },
    isLowDopamine: {
      type: Boolean,
      default: false,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    remixedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
    shares: {
      type: Number,
      default: 0,
    },
    media: {
      type: String, // URL for image/video/audio files
    },
    // Additional fields for better functionality
    tags: [{
      type: String,
      trim: true,
    }],
    location: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // For scheduling posts
    scheduledFor: {
      type: Date,
    },
    isPublished: {
      type: Boolean,
      default: true,
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
postSchema.index({ uploadedBy: 1, createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });
postSchema.index({ isLowDopamine: 1, createdAt: -1 });
postSchema.index({ contentType: 1, createdAt: -1 });
postSchema.index({ tags: 1 });

// Virtual for formatted creation time
postSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
});

// Ensure virtual fields are serialized
postSchema.set('toJSON', {
  virtuals: true
});

export default mongoose.model("Post", postSchema);