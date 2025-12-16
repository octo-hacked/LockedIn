import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'

const generateAccessAndRefreshToken = async (userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async(req,res)=>{
    //take user details
    //validate details
    //check if user already exists:usernamea,amail
    //check for images,check for avatar
    //upload them to cloudinary
    //create user object: create the mongoDB entry
    //remove password and refresh token fields form response
    //check for usewr creation
    //retuen response


    const {fullname,email,username,password} = req.body
    
    if(
        [fullname,email,username,password].some((field)=> field?.trim()==="true")
     ){
        throw new ApiError(400,"All fields are compulsory")
    }

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })
        
    if (existedUser){
        throw new ApiError(409,'User with username or email already exists')
    }


    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage.path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400,"Avatar is required")
    }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUSer = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUSer) {
        throw new ApiError(500,"Something went wrong while user registeration")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUSer, "User registered successfully")
    )
})

const loginUser = asyncHandler(async (req,res)=>{
    //get data
    //username or email
    //find the user 
    //check password
    // access and refresh token
    //send cookies

    const {username,email,password} = req.body;

    if(!username && !email){
        throw new ApiError(400,"username or email is required")
    }

    const user = await User.findOne({
            $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid User Credentials")
    }


    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }


    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{user:loggedInUser,accessToken,refreshToken},"User logged in successfully")
    )
})

const logoutUser = asyncHandler(async(req,res)=>{
    User.findByIdAndUpdate(
        req.user._id,{
            $set:{
                rehreshToken: undefined
            }
        },
        {
            new:true
        }
    )
    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,"User logged out successfully"))
})



const refreshAccesToken = asyncHandler(async (req,res) =>{
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken
    
        if(!incomingRefreshToken){
            throw new ApiError(401,"Token not available or expired")
        }
    
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken._id)
    
        if(!user){
            throw new ApiError(401,"Invalid or expired token")
        }
    
        if(user.refreshToken!==incomingRefreshToken){
            throw new ApiError(401,"Invalid Request")
        }
    
        const {accessToken,refreshToken} = generateAccessAndRefreshToken(user._id)
    
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(200,{accessToken,refreshToken},"tokens refreshed successfully")
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Refresh Token")
    }

})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400,"Invalid old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(new ApiResponse(200,"Password Changed Successfully"))
})


const getCurrentUser = (req,res)=>{
    return res.status(200).json(new ApiResponse(200,"Current User fetched successfully"))
}


const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName, email} = req.body
    if(!fullName || email){
        throw new ApiError(400,"All fields are requiered")
    }

    const user = User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {new:true}).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,"Account Details Updated Successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPaths = req.file?.path

    if (!avatarLocalPaths){
        throw new ApiError(400,"Avatar is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPaths)

    if(!avatar.url){
        throw new ApiError(500,"Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {$set:{
            avatar:avatar.url
        }},
        {new:true}
    ).select("-password")

    return res.status(200).json(new ApiResponse(200,user.select("-refreshToken"),"Avatar updated successfully"))
})


const updatecoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath){
        throw new ApiError(400,"Avatar is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(500,"Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {$set:{
            coverImage:coverImage.url
        }},
        {new:true}
    ).select("-password")

    return res.status(200).json(new ApiResponse(200,user.select("-refreshToken"),"Cover Image Updated Successfully"))
})



const getchannelSubscribers = asyncHandler(async (req,res)=>{
    const {username} = req.params
    if(!username){
        throw new ApiError(400,"Invalid User")
    }

    const channel = User.aggregate([{
        $match:{"username":username?.toLowerCase()}
    },
    {
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subscribers"
        },
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"subscriber",
            as:"subscribedTo"
        }
    },
    {
        $addFields:{
            subscribersCount:{
                $size:"$subscribers"
            },
            channelsSubscribedToCount:{
                $size:"$subscribedTo"
            },
            isSubscribed:{
                $cond:{
                    if:{$in:[req.user._id,"subscribers.subscriber"]},
                    then:true,else:false
                }
            }
        }
    },
    {
        $project:{
            fullName:1,
            username:1,
            subscribersCount:1,
            channelsSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,
            email:1
        }
    }
])
})

const searchUsers = asyncHandler(async (req, res) => {
  try {
    const { q: searchQuery, page = 1, limit = 20 } = req.query;

    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const query = searchQuery.trim();
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Create search conditions for username, fullname, and email
    const searchConditions = {
      $and: [
        {
          _id: { $ne: req.user._id }, // Exclude current user from results
        },
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { fullname: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
          ],
        },
      ],
    };

    // Get users with pagination
    const users = await User.find(searchConditions)
      .select('username fullname email avatar') // Only return necessary fields
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ username: 1 }); // Sort alphabetically

    // Get total count for pagination
    const totalUsers = await User.countDocuments(searchConditions);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1,
          },
        },
        'Users found successfully'
      )
    );
  } catch (error) {
    throw new ApiError(500, error.message || 'Error searching users');
  }
});

// Get user suggestions (recent/popular users)
 const getUserSuggestions = asyncHandler(async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get random users excluding current user
    const suggestions = await User.aggregate([
      {
        $match: {
          _id: { $ne: req.user._id },
        },
      },
      {
        $sample: { size: parseInt(limit) },
      },
      {
        $project: {
          username: 1,
          fullname: 1,
          email: 1,
          avatar: 1,
        },
      },
    ]);

    return res.status(200).json(
      new ApiResponse(200, suggestions, 'User suggestions fetched successfully')
    );
  } catch (error) {
    throw new ApiError(500, error.message || 'Error fetching user suggestions');
  }
});

// Get user by ID (for chat creation verification)
 const getUserById = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }
    const user = await User.findById(userId).select('username fullname email avatar');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return res.status(200).json(
      new ApiResponse(200, user, 'User fetched successfully')
    );
  } catch (error) {
    throw new ApiError(500, error.message || 'Error fetching user');
  }
});





export {registerUser,loginUser, logoutUser, refreshAccesToken, changeCurrentPassword, getCurrentUser, updateAccountDetails,getUserSuggestions,searchUsers,getUserById,updateUserAvatar,updatecoverImage,getchannelSubscribers}