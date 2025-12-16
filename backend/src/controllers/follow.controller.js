import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Follow } from '../models/follow.model.js';
import { User } from '../models/user.model.js';
import mongoose from 'mongoose';

// Follow a user
export const followUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "Cannot follow yourself");
  }

  const userToFollow = await User.findById(userId);
  if (!userToFollow) {
    throw new ApiError(404, "User not found");
  }

  const existingFollow = await Follow.findOne({
    followedBy: req.user._id,
    followedTo: userId
  });

  if (existingFollow) {
    throw new ApiError(400, "Already following this user");
  }

  await Follow.create({
    followedBy: req.user._id,
    followedTo: userId
  });

  res.status(201).json(
    new ApiResponse(201, null, "User followed successfully")
  );
});

// Unfollow a user
export const unfollowUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const followRelation = await Follow.findOneAndDelete({
    followedBy: req.user._id,
    followedTo: userId
  });

  if (!followRelation) {
    throw new ApiError(400, "Not following this user");
  }

  res.json(new ApiResponse(200, null, "User unfollowed successfully"));
});

// Get user's followers
export const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const targetUserId = userId || req.user._id;

  const followers = await Follow.aggregate([
    { $match: { followedTo: new mongoose.Types.ObjectId(targetUserId) } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "followedBy",
        foreignField: "_id",
        as: "follower",
        pipeline: [
          { $project: { username: 1, fullname: 1, avatar: 1, email: 1 } }
        ]
      }
    },
    {
      $addFields: {
        follower: { $first: "$follower" }
      }
    },
    {
      $project: {
        follower: 1,
        createdAt: 1
      }
    }
  ]);

  const totalFollowers = await Follow.countDocuments({ 
    followedTo: new mongoose.Types.ObjectId(targetUserId) 
  });

  res.json(
    new ApiResponse(200, {
      followers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalFollowers / parseInt(limit)),
        totalFollowers,
        hasNextPage: parseInt(page) < Math.ceil(totalFollowers / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1,
      }
    }, "Followers fetched successfully")
  );
});

// Get user's following
export const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const targetUserId = userId || req.user._id;

  const following = await Follow.aggregate([
    { $match: { followedBy: new mongoose.Types.ObjectId(targetUserId) } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "followedTo",
        foreignField: "_id",
        as: "following",
        pipeline: [
          { $project: { username: 1, fullname: 1, avatar: 1, email: 1 } }
        ]
      }
    },
    {
      $addFields: {
        following: { $first: "$following" }
      }
    },
    {
      $project: {
        following: 1,
        createdAt: 1
      }
    }
  ]);

  const totalFollowing = await Follow.countDocuments({ 
    followedBy: new mongoose.Types.ObjectId(targetUserId) 
  });

  res.json(
    new ApiResponse(200, {
      following,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalFollowing / parseInt(limit)),
        totalFollowing,
        hasNextPage: parseInt(page) < Math.ceil(totalFollowing / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1,
      }
    }, "Following fetched successfully")
  );
});

// Check if user is following another user
export const checkFollowStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const isFollowing = await Follow.findOne({
    followedBy: req.user._id,
    followedTo: userId
  });

  res.json(
    new ApiResponse(200, { isFollowing: !!isFollowing }, "Follow status checked")
  );
});