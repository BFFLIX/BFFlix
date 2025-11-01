
import mongoose from "mongoose";
import { env } from "./config/env";

let dbReady = false;
export function isDbReady() { return dbReady; }

export async function connectToDB() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    dbReady = true;
    console.log("[DB] Connected");

    mongoose.connection.on("disconnected", () => {
      dbReady = false;
      console.error("[DB] Disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      dbReady = true;
      console.log("[DB] Reconnected");
    });
  } catch (err) {
    dbReady = false;
    console.error("[DB] Initial connect error:", err);
    // App stays up; routes (except /health) will return 503 via middleware.
  }
}