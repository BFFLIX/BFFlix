
import mongoose from "mongoose";

export async function connectToDB(uri: string) {
  if (!uri) throw new Error("MONGODB_URI is missing");
  // Avoid multiple connects in dev hot-reload
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri);
  return mongoose.connection;
}
