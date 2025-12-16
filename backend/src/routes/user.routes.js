import { Router } from "express";
import { loginUser, logoutUser, refreshAccesToken, registerUser,getCurrentUser,getUserById,searchUsers,getUserSuggestions } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router()

router.post('/register',
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
])
,registerUser)

router.route("/login").post(loginUser)

//Secured routes
router.route("/logout").post(verifyJwt,logoutUser)

router.route("/refresh-token").post(refreshAccesToken)

router.route("/search").get(verifyJwt, searchUsers);
router.route("/suggestions").get(verifyJwt, getUserSuggestions);
router.route("/:userId").get(verifyJwt, getUserById);

export default router;