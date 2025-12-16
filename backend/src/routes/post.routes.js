import express from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";
import {
  createPost,
  getFeed,
  getReels,
  getUserPosts,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  deleteComment,
  sharePost,
  getPostComments,
  getCommentReplies,
  updateComment,
  toggleCommentLike,
  getCommentStats
} from "../controllers/post.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJwt);

// Post CRUD routes
router.post(
  "/create", 
  upload.single("media"), 
  createPost
);

router.get("/feed", getFeed);
router.get("/reels", getReels);
router.get("/user/:userId", getUserPosts); // Optional userId, defaults to current user
router.get("/:postId", getPost);

router.patch("/:postId", updatePost);
router.delete("/:postId", deletePost);

// Post interaction routes
router.post("/:postId/like", toggleLike);
router.post("/:postId/comments", addComment);
router.delete("/comments/:commentId", deleteComment);
router.post("/:postId/share", sharePost);

// Comment routes
router.get("/:postId/comments", getPostComments);          // Get comments for a post
router.post("/:postId/comments", addComment);              // Add comment/reply to post
router.get("/:postId/comments/stats", getCommentStats);    // Get comment statistics

// Individual comment routes
router.get("/comments/:commentId/replies", getCommentReplies);  // Get replies for a comment
router.patch("/comments/:commentId", updateComment);            // Update comment
router.delete("/comments/:commentId", deleteComment);           // Delete comment
router.post("/comments/:commentId/like", toggleCommentLike);    // Like/unlike comment


export default router;