import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import Post from '../models/post.model.js';
import { User } from '../models/user.model.js';
import { Comment } from '../models/comment.model.js';
import { Like } from '../models/like.model.js';
import { Share } from '../models/share.model.js';
import mongoose from 'mongoose';

// Common aggregation pipeline for comment data
const commentAggregationPipeline = (userId) => [
  {
    $lookup: {
      from: "users",
      localField: "commentBy",
      foreignField: "_id",
      as: "commentBy",
      pipeline: [
        { $project: { username: 1, fullname: 1, avatar: 1, email: 1 } }
      ]
    }
  },
  {
    $lookup: {
      from: "likes",
      localField: "_id",
      foreignField: "likedTo",
      as: "commentLikes",
      pipeline: [
        { $match: { likeType: "comment" } }
      ]
    }
  },
  {
    $addFields: {
      commentBy: { $first: "$commentBy" },
      likesCount: { $size: "$commentLikes" },
      isLikedByUser: {
        $in: [new mongoose.Types.ObjectId(userId), "$commentLikes.likedBy"]
      },
      timeAgo: {
        $let: {
          vars: {
            diffMs: { $subtract: [new Date(), "$createdAt"] },
          },
          in: {
            $switch: {
              branches: [
                {
                  case: { $lt: ["$diffMs", 3600000] }, // Less than 1 hour
                  then: {
                    $concat: [
                      { $toString: { $floor: { $divide: ["$diffMs", 60000] } } },
                      "m"
                    ]
                  }
                },
                {
                  case: { $lt: ["$diffMs", 86400000] }, // Less than 1 day
                  then: {
                    $concat: [
                      { $toString: { $floor: { $divide: ["$diffMs", 3600000] } } },
                      "h"
                    ]
                  }
                },
                {
                  case: { $lt: ["$diffMs", 604800000] }, // Less than 1 week
                  then: {
                    $concat: [
                      { $toString: { $floor: { $divide: ["$diffMs", 86400000] } } },
                      "d"
                    ]
                  }
                }
              ],
              default: {
                $concat: [
                  { $toString: { $floor: { $divide: ["$diffMs", 604800000] } } },
                  "w"
                ]
              }
            }
          }
        }
      }
    }
  },
  {
    $project: {
      commentLikes: 0
    }
  }
];

// Create a new post
export const createPost = asyncHandler(async (req, res) => {
  const { title, description, contentType, isLowDopamine = false, category = "other" } = req.body;

  if (!title?.trim()) {
    throw new ApiError(400, "Title is required");
  }

  if (!["text", "image", "video", "audio", "link"].includes(contentType)) {
    throw new ApiError(400, "Invalid content type");
  }

  // Handle media upload if present
  let mediaUrl = "";
  if (req.file) {
    const uploadResult = await uploadOnCloudinary(req.file.path);
    if (!uploadResult) {
      throw new ApiError(500, "Failed to upload media file");
    }
    mediaUrl = uploadResult.url;
  }

  // Get the next post ID
  const lastPost = await Post.findOne().sort({ id: -1 });
  const nextId = lastPost ? lastPost.id + 1 : 1;

  const post = await Post.create({
    id: nextId,
    title: title.trim(),
    description: description?.trim() || "",
    contentType,
    isLowDopamine,
    category,
    uploadedBy: req.user._id,
    media: mediaUrl,
  });

  const populatedPost = await Post.findById(post._id)
    .populate("uploadedBy", "username fullname avatar email")
    .populate("remixedWith", "title id");

  res.status(201).json(
    new ApiResponse(201, populatedPost, "Post created successfully")
  );
});

// Get user's feed with pagination and filters
export const getFeed = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    lowDopamineOnly = false,
    sortBy = "createdAt"
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  

  // Build filter object
  const filter = {};
  if (category && category !== "all") {
    filter.category = category;
  }
  if (lowDopamineOnly === "true") {
    filter.isLowDopamine = true;
  }

  // Aggregation pipeline for posts with user interactions
  const posts = await Post.aggregate([
    { $match: filter },
    { $sort: { [sortBy]: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "uploadedBy",
        foreignField: "_id",
        as: "uploadedBy",
        pipeline: [
          { $project: { username: 1, fullname: 1, avatar: 1, email: 1 } }
        ]
      }
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "likedTo",
        as: "likesList"
      }
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "commentedTo",
        as: "commentsList"
      }
    },
    {
      $lookup: {
        from: "shares",
        localField: "_id",
        foreignField: "post",
        as: "sharesList"
      }
    },
    {
      $addFields: {
        uploadedBy: { $first: "$uploadedBy" },
        likes: { $size: "$likesList" },
        comments: { $size: "$commentsList" },
        shares: { $size: "$sharesList" },
        isLikedByUser: {
          $in: [req.user._id, "$likesList.likedBy"]
        }
      }
    },
    {
      $project: {
        likesList: 0,
        commentsList: 0,
        sharesList: 0
      }
    }
  ]);

  const totalPosts = await Post.countDocuments(filter);

  res.json(
    new ApiResponse(200, {
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / parseInt(limit)),
        totalPosts,
        hasNextPage: parseInt(page) < Math.ceil(totalPosts / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1,
      }
    }, "Feed fetched successfully")
  );
});

// Get reels (video posts)
export const getReels = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, lowDopamineOnly = false } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { contentType: "video" };
  if (lowDopamineOnly === "true") {
    filter.isLowDopamine = true;
  }

  const reels = await Post.aggregate([
    { $match: filter },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "uploadedBy",
        foreignField: "_id",
        as: "uploadedBy",
        pipeline: [
          { $project: { username: 1, fullname: 1, avatar: 1, email: 1 } }
        ]
      }
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "likedTo",
        as: "likesList"
      }
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "commentedTo",
        as: "commentsList"
      }
    },
    {
      $addFields: {
        uploadedBy: { $first: "$uploadedBy" },
        likes: { $size: "$likesList" },
        comments: { $size: "$commentsList" },
        isLikedByUser: {
          $in: [req.user._id, "$likesList.likedBy"]
        }
      }
    },
    {
      $project: {
        likesList: 0,
        commentsList: 0
      }
    }
  ]);

  const totalReels = await Post.countDocuments(filter);

  res.json(
    new ApiResponse(200, {
      reels,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReels / parseInt(limit)),
        totalReels,
        hasNextPage: parseInt(page) < Math.ceil(totalReels / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1,
      }
    }, "Reels fetched successfully")
  );
});

// Get user's own posts
export const getUserPosts = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const targetUserId = userId || req.user._id;

  const posts = await Post.aggregate([
    { $match: { uploadedBy: new mongoose.Types.ObjectId(targetUserId) } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "uploadedBy",
        foreignField: "_id",
        as: "uploadedBy",
        pipeline: [
          { $project: { username: 1, fullname: 1, avatar: 1, email: 1 } }
        ]
      }
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "likedTo",
        as: "likesList"
      }
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "commentedTo",
        as: "commentsList"
      }
    },
    {
      $addFields: {
        uploadedBy: { $first: "$uploadedBy" },
        likes: { $size: "$likesList" },
        comments: { $size: "$commentsList" },
        isLikedByUser: {
          $in: [req.user._id, "$likesList.likedBy"]
        }
      }
    },
    {
      $project: {
        likesList: 0,
        commentsList: 0
      }
    }
  ]);

  const totalPosts = await Post.countDocuments({
    uploadedBy: new mongoose.Types.ObjectId(targetUserId)
  });

  res.json(
    new ApiResponse(200, {
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / parseInt(limit)),
        totalPosts,
        hasNextPage: parseInt(page) < Math.ceil(totalPosts / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1,
      }
    }, "User posts fetched successfully")
  );
});

// Get single post
export const getPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await Post.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(postId) } },
    {
      $lookup: {
        from: "users",
        localField: "uploadedBy",
        foreignField: "_id",
        as: "uploadedBy",
        pipeline: [
          { $project: { username: 1, fullname: 1, avatar: 1, email: 1 } }
        ]
      }
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "likedTo",
        as: "likesList"
      }
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "commentedTo",
        as: "commentsList",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "commentBy",
              foreignField: "_id",
              as: "commentBy",
              pipeline: [
                { $project: { username: 1, fullname: 1, avatar: 1 } }
              ]
            }
          },
          {
            $addFields: {
              commentBy: { $first: "$commentBy" }
            }
          },
          { $sort: { createdAt: -1 } }
        ]
      }
    },
    {
      $addFields: {
        uploadedBy: { $first: "$uploadedBy" },
        likes: { $size: "$likesList" },
        comments: { $size: "$commentsList" },
        isLikedByUser: {
          $in: [req.user._id, "$likesList.likedBy"]
        }
      }
    },
    {
      $project: {
        likesList: 0
      }
    }
  ]);

  if (!post.length) {
    throw new ApiError(404, "Post not found");
  }

  // Increment views
  await Post.findByIdAndUpdate(postId, { $inc: { views: 1 } });

  res.json(new ApiResponse(200, post[0], "Post fetched successfully"));
});

// Update post
export const updatePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { title, description, isLowDopamine, category } = req.body;

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.uploadedBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to update this post");
  }

  const updateData = {};
  if (title) updateData.title = title.trim();
  if (description !== undefined) updateData.description = description.trim();
  if (isLowDopamine !== undefined) updateData.isLowDopamine = isLowDopamine;
  if (category) updateData.category = category;

  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    updateData,
    { new: true }
  ).populate("uploadedBy", "username fullname avatar email");

  res.json(new ApiResponse(200, updatedPost, "Post updated successfully"));
});

// Delete post
export const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.uploadedBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to delete this post");
  }

  // Delete related comments, likes, and shares
  await Comment.deleteMany({ commentedTo: postId });
  await Like.deleteMany({ likedTo: postId });
  await Share.deleteMany({ post: postId });

  // Delete the post
  await Post.findByIdAndDelete(postId);

  res.json(new ApiResponse(200, null, "Post deleted successfully"));
});

// Like/Unlike post
export const toggleLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const existingLike = await Like.findOne({
    likedBy: req.user._id,
    likedTo: postId
  });

  if (existingLike) {
    // Unlike
    await Like.findByIdAndDelete(existingLike._id);
    await Post.findByIdAndUpdate(postId, { $inc: { likes: -1 } });

    res.json(new ApiResponse(200, { isLiked: false }, "Post unliked"));
  } else {
    // Like
    await Like.create({
      likedBy: req.user._id,
      likedTo: postId
    });
    await Post.findByIdAndUpdate(postId, { $inc: { likes: 1 } });

    res.json(new ApiResponse(200, { isLiked: true }, "Post liked"));
  }
});

// Get comments for a specific post
export const getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
    includeReplies = false
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Verify post exists
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  // Build match condition (only top-level comments or all comments)
  const matchCondition = {
    commentedTo: new mongoose.Types.ObjectId(postId)
  };

  if (!includeReplies || includeReplies === "false") {
    matchCondition.parentComment = null; // Only top-level comments
  }

  const comments = await Comment.aggregate([
    { $match: matchCondition },
    { $sort: sort },
    { $skip: skip },
    { $limit: parseInt(limit) },
    ...commentAggregationPipeline(req.user._id)
  ]);

  // If including replies, get reply counts for top-level comments
  if (!includeReplies || includeReplies === "false") {
    for (let comment of comments) {
      const replyCount = await Comment.countDocuments({
        parentComment: comment._id
      });
      comment.replyCount = replyCount;
    }
  }

  const totalComments = await Comment.countDocuments(matchCondition);

  res.json(
    new ApiResponse(200, {
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / parseInt(limit)),
        totalComments,
        hasNextPage: parseInt(page) < Math.ceil(totalComments / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1,
      }
    }, "Comments fetched successfully")
  );
});

// Get replies for a specific comment
export const getCommentReplies = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "asc"
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Verify parent comment exists
  const parentComment = await Comment.findById(commentId);
  if (!parentComment) {
    throw new ApiError(404, "Parent comment not found");
  }

  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  const replies = await Comment.aggregate([
    {
      $match: {
        parentComment: new mongoose.Types.ObjectId(commentId)
      }
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: parseInt(limit) },
    ...commentAggregationPipeline(req.user._id)
  ]);

  const totalReplies = await Comment.countDocuments({
    parentComment: new mongoose.Types.ObjectId(commentId)
  });

  res.json(
    new ApiResponse(200, {
      replies,
      parentComment: {
        _id: parentComment._id,
        body: parentComment.body,
        commentBy: parentComment.commentBy
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReplies / parseInt(limit)),
        totalReplies,
        hasNextPage: parseInt(page) < Math.ceil(totalReplies / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1,
      }
    }, "Replies fetched successfully")
  );
});

// Add comment to post
export const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { body, parentCommentId } = req.body;

  if (!body?.trim()) {
    throw new ApiError(400, "Comment body is required");
  }

  // Verify post exists
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  // If it's a reply, verify parent comment exists
  if (parentCommentId) {
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      throw new ApiError(404, "Parent comment not found");
    }

    // Ensure parent comment belongs to the same post
    if (parentComment.commentedTo.toString() !== postId) {
      throw new ApiError(400, "Parent comment does not belong to this post");
    }
  }

  const commentData = {
    body: body.trim(),
    commentBy: req.user._id,
    commentedTo: postId,
  };

  if (parentCommentId) {
    commentData.parentComment = parentCommentId;
  }

  const comment = await Comment.create(commentData);

  // Get the populated comment
  const populatedComment = await Comment.aggregate([
    { $match: { _id: comment._id } },
    ...commentAggregationPipeline(req.user._id)
  ]);

  // Update post comment count (only for top-level comments)
  if (!parentCommentId) {
    await Post.findByIdAndUpdate(postId, { $inc: { comments: 1 } });
  }

  res.status(201).json(
    new ApiResponse(201, populatedComment[0],
      parentCommentId ? "Reply added successfully" : "Comment added successfully"
    )
  );
});

// Update a comment
export const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { body } = req.body;

  if (!body?.trim()) {
    throw new ApiError(400, "Comment body is required");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // Check if user owns the comment
  if (comment.commentBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to update this comment");
  }

  // Update comment
  await Comment.findByIdAndUpdate(commentId, {
    body: body.trim(),
    updatedAt: new Date()
  });

  // Get the updated populated comment
  const updatedComment = await Comment.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(commentId) } },
    ...commentAggregationPipeline(req.user._id)
  ]);

  res.json(
    new ApiResponse(200, updatedComment[0], "Comment updated successfully")
  );
});

// Delete comment
export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.commentBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to delete this comment");
  }

  // Delete all replies to this comment
  const deletedReplies = await Comment.deleteMany({
    parentComment: commentId
  });

  // Delete the comment itself
  await Comment.findByIdAndDelete(commentId);

  // Delete any likes on this comment and its replies
  await Like.deleteMany({
    likedTo: { $in: [commentId, ...(await Comment.find({ parentComment: commentId })).map(c => c._id)] },
    likeType: "comment"
  });

  // Update post comment count (only for top-level comments)
  if (!comment.parentComment) {
    const decrementBy = 1 + deletedReplies.deletedCount; // Original comment + replies
    await Post.findByIdAndUpdate(comment.commentedTo, {
      $inc: { comments: -decrementBy }
    });
  }

  res.json(
    new ApiResponse(200, {
      deletedComment: commentId,
      deletedReplies: deletedReplies.deletedCount
    }, "Comment deleted successfully")
  );
});

// Like/Unlike a comment
export const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const existingLike = await Like.findOne({
    likedBy: req.user._id,
    likedTo: commentId,
    likeType: "comment"
  });

  if (existingLike) {
    // Unlike
    await Like.findByIdAndDelete(existingLike._id);
    await Comment.findByIdAndUpdate(commentId, { $inc: { likes: -1 } });

    res.json(new ApiResponse(200, {
      isLiked: false,
      commentId: commentId
    }, "Comment unliked"));
  } else {
    // Like
    await Like.create({
      likedBy: req.user._id,
      likedTo: commentId,
      likeType: "comment"
    });
    await Comment.findByIdAndUpdate(commentId, { $inc: { likes: 1 } });

    res.json(new ApiResponse(200, {
      isLiked: true,
      commentId: commentId
    }, "Comment liked"));
  }
});

// Get comment statistics
export const getCommentStats = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const stats = await Comment.aggregate([
    { $match: { commentedTo: new mongoose.Types.ObjectId(postId) } },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        topLevelComments: {
          $sum: { $cond: [{ $eq: ["$parentComment", null] }, 1, 0] }
        },
        replies: {
          $sum: { $cond: [{ $ne: ["$parentComment", null] }, 1, 0] }
        }
      }
    }
  ]);

  const commentStats = stats.length > 0 ? stats[0] : {
    totalComments: 0,
    topLevelComments: 0,
    replies: 0
  };

  // Get most liked comment
  const mostLikedComment = await Comment.aggregate([
    { $match: { commentedTo: new mongoose.Types.ObjectId(postId) } },
    { $sort: { likes: -1 } },
    { $limit: 1 },
    ...commentAggregationPipeline(req.user._id)
  ]);

  res.json(
    new ApiResponse(200, {
      ...commentStats,
      mostLikedComment: mostLikedComment[0] || null
    }, "Comment statistics fetched successfully")
  );
});

// Share post
export const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { sharedTo } = req.body; // Optional: specific user to share with

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const shareData = {
    sharedBy: req.user._id,
    post: postId
  };

  if (sharedTo) {
    shareData.sharedTo = sharedTo;
  }

  const share = await Share.create(shareData);
  await Post.findByIdAndUpdate(postId, { $inc: { shares: 1 } });

  res.status(201).json(
    new ApiResponse(201, share, "Post shared successfully")
  );
});