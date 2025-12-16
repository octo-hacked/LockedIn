import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    attachments: [{
      url: String,
      localPath: String,
    }],
    readBy: [{
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      readAt: {
        type: Date,
        default: Date.now,
      }
    }],
    isEdited: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

export const Message = mongoose.model("Message", messageSchema);