import express from "express";
import { verifyJwt } from "../middlewares/auth.middleware.js";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus
} from "../controllers/follow.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJwt);

// Follow/Unfollow routes
router.post("/:userId", followUser);
router.delete("/:userId", unfollowUser);

// Get followers and following
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

// Check follow status
router.get("/:userId/status", checkFollowStatus);

export default router;