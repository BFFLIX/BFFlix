
// server/src/scripts/syncProviders.ts
import { connectToDB } from "../db";
import tmdb from "../Services/tmdb.service";
import StreamingService from "../models/StreamingService";

async function syncProviders() {
  const providers = await tmdb.getAvailableProviders();

  for (const p of providers) {
    await StreamingService.updateOne(
      { tmdbProviderId: p.provider_id },
      {
        $set: {
          tmdbProviderId: p.provider_id,
          name: p.provider_name,
          logoPath: p.logo_path,
          displayPriority: p.display_priority ?? 9999,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  console.log(`✅ Providers synced with TMDB: ${providers.length}`);
}

async function main() {
  await connectToDB(); // no args now
  await syncProviders();
  process.exit(0);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});