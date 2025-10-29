
// server/src/index.ts
import "dotenv/config";
import streamingServiceRoutes from "./routes/streamingService.routes";//10/20
import circleRouter from "./routes/circles";
import postsRouter from "./routes/posts";
import authRouter from "./routes/auth";
import { authLimiter } from "./middleware/rateLimit";
import meRouter from "./routes/me";
import express from "express";
import cors from "cors";
import { connectToDB } from "./db";
import agentRouter from "./routes/agent";
import viewingsRouter from "./routes/viewings";


const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/auth", authLimiter, authRouter);
app.use("/circles", circleRouter);
app.use("/posts", postsRouter);
//10/20 commit
app.use("/api", streamingServiceRoutes);
app.use("/agent", agentRouter)
app.use("/viewings", viewingsRouter);


app.get("/", (_req, res) => {
  res.send("🎬 Bfflix API is running! Try /health for a status check.");
});

app.get("/health", (_req, res) => {
  const dbState = ["disconnected","connected","connecting","disconnecting"][require("mongoose").connection.readyState] || "unknown";
  res.json({ ok: true, message: "Bfflix API is running!", db: dbState });
});

const PORT = process.env.PORT || 8080;

async function start() {
  try {
    const uri = process.env.MONGODB_URI as string;
    await connectToDB(uri);
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 Bfflix API on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

start();
