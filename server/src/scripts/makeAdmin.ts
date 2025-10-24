
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/user";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx ts-node scripts/makeAdmin.ts user@example.com");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in environment.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  try {
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { isAdmin: true } },
      { new: true }
    ).lean();

    if (!user) {
      console.error("User not found:", email);
      process.exit(1);
    }

    console.log("✅ Promoted to admin:", user.email, "isAdmin:", user.isAdmin);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
