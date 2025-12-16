import express from "express";
import cors from 'cors';
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { initializeChatSocket } from "./socket/chat.socket.js";
import {verifyJwt} from './middlewares/auth.middleware.js'
import { Server } from "socket.io";
import requestIp from "request-ip";
import { User } from "./models/user.model.js";
import jwt from "jsonwebtoken";

const app = express()
const httpServer = createServer(app);


const allowedOrigins = [
  "http://localhost:3000",
  "https://f25eac5ccded46f5baaa0ad55feac9bc-br-516829e5f53743bea66f7aaae.fly.dev",
  "https://builder.io/app/projects/f25eac5ccded46f5baaa0ad55feac9bc" // 👈 add the real origin here
];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});


// const io = new Server(httpServer, {
//   cors: {
//     origin: " http://localhost:8080",
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });
app.set("io", io);

app.use(cors({

  origin: (origin, callback) => {
    
    // allow server-to-server or tools like Postman
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// app.use(cors({
//     origin: " http://localhost:8080",
//     credentials: true
// }))

app.use(express.json({limit: '16kb'}))
app.use(express.urlencoded({extended: true, limit:'16kb'}))
app.use(express.static('public'))
app.use(cookieParser())
app.use(requestIp.mw());

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
  
    
    if (!token) {
      return next(new Error("Authentication token missing"));
    }

    // Verify the JWT token
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    // Get user from database
    const user = await User.findById(decodedToken._id).select("-password -refreshToken");
   
    
    if (!user) {
      return next(new Error("Invalid token - user not found"));
    }

    // Attach user info to socket
    socket.userId = user._id.toString();
    socket.user = user;
    
    next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    next(new Error("Authentication failed"));
  }
});

initializeChatSocket(io);


//routes import 
import userRouter from './routes/user.routes.js'
import chatRoutes from "./routes/chat.routes.js";
import postRoutes from "./routes/post.routes.js";
import followRoutes from "./routes/follow.routes.js";


//routes declaration
app.use('/api/v1/users',userRouter)
app.use('/api/v1/chats',verifyJwt, chatRoutes);
app.use('/api/v1/posts', verifyJwt, postRoutes);
app.use('/api/v1/follow', verifyJwt, followRoutes);


app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

export {app,httpServer}