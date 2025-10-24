
import "dotenv/config";
import { connectToDB } from "../db";
import tmdb from "../Services/tmdb.service";
import StreamingService from "../models/StreamingService";

async function syncProviders() {
  const providers = await tmdb.getAvailableProviders();

  for (const p of providers) {
    await StreamingService.updateOne(
      { tmdbProviderId: p.provider_id },
      {
        tmdbProviderId: p.provider_id,
        name: p.provider_name,
        logoPath: p.logo_path,
        displayPriority: p.display_priority,
      },
      { upsert: true }
    );
  }

  console.log("✅ Providers synced with TMDB");
}

async function main() {
  await connectToDB(process.env.MONGODB_URI!);
  await syncProviders();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
