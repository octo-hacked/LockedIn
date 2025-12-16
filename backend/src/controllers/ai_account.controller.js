import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

const getNewsData = asyncHandler(async(req, res) => {
    try {
        const response = await fetch(`https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY}&q=technology&language=en`);
    } catch (error) {
        
    }
});