
// server/src/routes/agent.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import Viewing from "../models/Viewing";
import RecommendationCache from "../models/RecommendationCache";
import UserStreamingService from "../models/UserStreamingService";
import { askLLMJson } from "../lib/llm";

const r = Router();

const bodySchema = z.object({
  query: z.string().min(1, "Query is required"),
});

// POST /agent/recommendations
r.post("/recommendations", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.format());

    const { query } = parsed.data;
    const userId = req.user!.id;

    // 1) Check cache
    const cached = await RecommendationCache.findOne({ userId, query }).lean();
    if (cached && cached.expiresAt > new Date()) {
      return res.json({
        query,
        cached: true,
        results: cached.results,
        message: "Served from cache",
      });
    }

    // 2) Get recent viewings
    const recentViewings = await Viewing.find({ userId })
      .sort({ watchedAt: -1, _id: -1 })
      .limit(10)
      .lean();

    // 3) Get user's subscribed platforms
    const userServices = await UserStreamingService.find({ userId })
      .populate("streamingServiceId", "name")
      .lean();

    const platformNames = userServices
      .map((u: any) => u.streamingServiceId?.name)
      .filter(Boolean);

    // 4) Fallback path if no history
    if (recentViewings.length === 0) {
      const fallbackPrompt = `
The user has no recent viewing history.
Ask one short follow-up question (1–2 sentences). Offer two options:
1) "Want the current most popular movies people are watching across all platforms?"
2) "Prefer a top list by a specific genre you like (for example comedy, sci fi, drama)?"
If applicable, mention their platforms: ${platformNames.join(", ") || "none set"}.
Return JSON object:
{ "type": "conversation", "message": "string" }
`.trim();

      const fallback = await askLLMJson(fallbackPrompt);

      return res.json({
        query,
        results: [
          typeof fallback === "string"
            ? { type: "conversation", message: fallback }
            : fallback || {
                type: "conversation",
                message: "Want trending now or a top list by genre?",
              },
        ],
      });
    }

    // 5) Build a compact user profile from viewings
    const userProfile = recentViewings
      .map((v) => {
        const parts: string[] = [];
        parts.push(`${v.type === "tv" ? "TV Show" : "Movie"} id ${v.tmdbId}`);
        if (v.seasonNumber != null && v.episodeNumber != null) {
          parts.push(`S${v.seasonNumber}E${v.episodeNumber}`);
        }
        if (v.rating != null) parts.push(`rated ${v.rating}/5`);
        if (v.comment) parts.push(`comment "${String(v.comment).replace(/"/g, "'")}"`);
        return parts.join(", ");
      })
      .join("; ");

    // 6) Compose LLM prompt with platforms + profile
    const llmPrompt = `
You are the AI movie assistant for BFFlix.

User platforms (prefer titles likely available here): ${platformNames.join(", ") || "none set"}.

Recent viewing history (most recent first):
${userProfile}

User query: "${query}"

Generate 3 to 5 high quality personalized recommendations. Infer tone, genre, and runtime preferences from their ratings and comments. Return ONLY a JSON array with items like:
[
  { "title": "string", "type": "movie" | "tv", "reason": "string", "matchScore": number }
]
`.trim();

    const results = await askLLMJson(llmPrompt);

    // 7) Save to cache for 6 hours
    await RecommendationCache.findOneAndUpdate(
      { userId, query },
      {
        userId,
        query,
        results,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
      { upsert: true }
    );

    res.json({
      query,
      cached: false,
      basedOn: recentViewings.length,
      platforms: platformNames,
      results,
    });
  } catch (err) {
    console.error("Agent Error:", err);
    res.status(500).json({ error: "agent_failed" });
  }
});

export default r;