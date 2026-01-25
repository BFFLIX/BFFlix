
// server/src/routes/feed.ts
import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import Post from "../models/Post";
import Circle from "../models/Circles/Circle";
import User from "../models/user";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { makeCursor, parseCursor } from "../lib/cursor";
import { getPlayableServicesForTitle } from "../Services/providers";
import tmdb from "../Services/tmdb.service";
import Like from "../models/Like";
import Comment from "../models/Comment";

const r = Router();

const feedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().optional(),
  sort: z.enum(["latest", "smart"]).optional().default("smart"),
});

r.get(
  "/",
  requireAuth,
  validateQuery(feedQuery),
  asyncHandler(async (req: AuthedRequest, res) => {
    type FeedQuery = z.infer<typeof feedQuery>;
    const { limit, cursor, sort } = (res.locals.query || {}) as FeedQuery;

    // Defensive defaults so strange values never break the feed
    const safeLimit = Number.isFinite(limit) ? limit : 20;
    const safeSort =
      sort === "latest" || sort === "smart"
        ? sort
        : "smart";

    const parsed = parseCursor(cursor);

    try {
      // Pull a slightly larger window when using smart sort so we can rank better,
      // then trim to the requested `limit`.
      const softCap =
        safeSort === "smart"
          ? Math.min(safeLimit * 3, 150)
          : safeLimit + 1;

      // 1) user services once
      const me = await User.findById(req.user!.id)
        .select("services")
        .lean();
      const myServices = new Set<string>(
        Array.isArray(me?.services) ? me!.services : []
      );

      // 2) my circles
      const myCircleIds = await Circle.find({ members: req.user!.id })
        .select("_id")
        .lean()
        .then((docs) => docs.map((d) => d._id as Types.ObjectId));

      if (myCircleIds.length === 0) {
        return res.json({ items: [], nextCursor: null });
      }

      // 3) aggregate with cross-post dedupe
      const pipeline: any[] = [
        { $match: { circles: { $in: myCircleIds } } },
        { $sort: { createdAt: -1, _id: -1 } },
        {
          $group: {
            _id: "$canonicalId",
            first: { $first: "$$ROOT" },
            circlesSets: { $addToSet: "$circles" },
          },
        },
        {
          $project: {
            mergedCircles: {
              $reduce: {
                input: "$circlesSets",
                initialValue: [],
                in: { $setUnion: ["$$value", "$$this"] },
              },
            },
            item: "$first",
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: ["$item", { circles: "$mergedCircles" }],
            },
          },
        },
      ];

      if (parsed) {
        pipeline.push({
          $match: {
            $or: [
              { createdAt: { $lt: parsed.ts } },
              { createdAt: parsed.ts, _id: { $lt: parsed.oid } },
            ],
          },
        });
      }

      pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
      pipeline.push({ $limit: softCap });

      const rows = await Post.aggregate(pipeline).exec();

      // Build author → mutual circle count
      const authorIds: string[] = Array.from(
        new Set(rows.map((r: any) => String(r.authorId)).filter(Boolean))
      );
      const mutualMap = new Map<string, number>();
      const authorProfileMap = new Map<
        string,
        { name: string; username: string; avatarUrl?: string }
      >();

      if (authorIds.length) {
        await Promise.all(
          authorIds.map(async (aid) => {
            const cnt = await Circle.countDocuments({
              _id: { $in: myCircleIds },
              members: new Types.ObjectId(aid),
            });
            mutualMap.set(aid, cnt);
          })
        );

        const authors = await User.find({ _id: { $in: authorIds } })
          .select("_id name username avatarUrl")
          .lean();
        authors.forEach((u: any) => {
          const safeName =
            typeof u.name === "string" && u.name.trim().length
              ? u.name.trim()
              : "Someone";
          const safeUsername =
            typeof u.username === "string" && u.username.trim().length
              ? u.username.trim()
              : "someone";
          const avatar =
            typeof u.avatarUrl === "string" ? u.avatarUrl.trim() : "";
          authorProfileMap.set(String(u._id), {
            name: safeName,
            username: safeUsername,
            avatarUrl: avatar || undefined,
          });
        });
      }

      // Compute recent circle activity for smart ranking (last 14 days)
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const activityDocs = await Post.aggregate([
        { $match: { circles: { $in: myCircleIds }, createdAt: { $gte: since } } },
        { $unwind: "$circles" },
        { $match: { circles: { $in: myCircleIds } } },
        { $group: { _id: "$circles", count: { $sum: 1 } } },
      ]);
      const circleActivity = new Map<string, number>(
        activityDocs.map((d: any) => [String(d._id), d.count as number])
      );
      const maxActivity = Math.max(
        1,
        ...activityDocs.map((d: any) => d.count as number)
      );

      // --- Engagement signals (likes & comments) over the last 14 days ---
      const postIds: Types.ObjectId[] = rows.map((r: any) => r._id);

      // Build friend set = users that share any circle with me
      const friendIds = await Circle.aggregate([
        { $match: { _id: { $in: myCircleIds } } },
        { $project: { members: 1 } },
        { $unwind: "$members" },
        { $group: { _id: "$members" } },
      ]).then((d) => new Set(d.map((x: any) => String(x._id))));

      // Like counts
      const likeCounts = new Map<string, number>();
      const friendLikeCounts = new Map<string, number>();
      if (postIds.length) {
        const likesAgg = await Like.aggregate([
          { $match: { postId: { $in: postIds }, createdAt: { $gte: since } } },
          { $group: { _id: "$postId", count: { $sum: 1 } } },
        ]);
        likesAgg.forEach((x: any) =>
          likeCounts.set(String(x._id), x.count)
        );

        const friendLikesAgg = await Like.aggregate([
          { $match: { postId: { $in: postIds }, createdAt: { $gte: since } } },
          {
            $group: {
              _id: { postId: "$postId", userId: "$userId" },
              one: { $sum: 1 },
            },
          },
        ]);
        friendLikesAgg.forEach((x: any) => {
          const pid = String(x._id.postId);
          const uid = String(x._id.userId);
          if (friendIds.has(uid)) {
            friendLikeCounts.set(
              pid,
              (friendLikeCounts.get(pid) || 0) + 1
            );
          }
        });
      }

      // Posts liked by the current user (for likedByMe flag)
      const likedByMe = new Set<string>();
      if (postIds.length) {
        const mine = await Like.find({
          postId: { $in: postIds },
          userId: req.user!.id,
        })
          .select("postId")
          .lean();
        mine.forEach((doc: any) => likedByMe.add(String(doc.postId)));
      }

      // Comment counts
      const commentCounts = new Map<string, number>();
      const friendCommentCounts = new Map<string, number>();
      if (postIds.length) {
        const comAgg = await Comment.aggregate([
          { $match: { postId: { $in: postIds }, createdAt: { $gte: since } } },
          { $group: { _id: "$postId", count: { $sum: 1 } } },
        ]);
        comAgg.forEach((x: any) =>
          commentCounts.set(String(x._id), x.count)
        );

        const friendComAgg = await Comment.aggregate([
          { $match: { postId: { $in: postIds }, createdAt: { $gte: since } } },
          {
            $group: {
              _id: { postId: "$postId", userId: "$userId" },
              one: { $sum: 1 },
            },
          },
        ]);
        friendComAgg.forEach((x: any) => {
          const pid = String(x._id.postId);
          const uid = String(x._id.userId);
          if (friendIds.has(uid)) {
            friendCommentCounts.set(
              pid,
              (friendCommentCounts.get(pid) || 0) + 1
            );
          }
        });
      }

      // 4) annotate with playableOnMyServices (memoized per request)
      const memoProviders = new Map<string, string[]>();
      const memoDetails = new Map<
        string,
        { title: string; year?: number; poster?: string }
      >();

      async function annotate(row: any) {
        const key = `${row.type}:${row.tmdbId}`;

        // Providers
        let providers = memoProviders.get(key);
        if (!providers) {
          try {
            providers = await getPlayableServicesForTitle(
              row.type,
              row.tmdbId,
              "US"
            );
          } catch (e) {
            console.error("Provider lookup failed for", key, e);
            providers = [];
          }
          memoProviders.set(key, providers);
        }
        const playable = providers.filter((p) => myServices.has(p));

        // Title + poster
        let meta = memoDetails.get(key);
        if (!meta) {
          try {
            if (row.type === "movie") {
              const d = await tmdb.getMovieDetails(row.tmdbId);
              meta = {
                title: d?.title || d?.original_title || "Untitled",
                year: d?.release_date
                  ? Number(String(d.release_date).slice(0, 4))
                  : undefined,
                poster: tmdb.getPosterURL(d?.poster_path || null) || undefined,
              } as { title: string; year?: number; poster?: string };
            } else {
              const d = await tmdb.getTVDetails(row.tmdbId);
              meta = {
                title: d?.name || d?.original_name || "Untitled",
                year: d?.first_air_date
                  ? Number(String(d.first_air_date).slice(0, 4))
                  : undefined,
                poster: tmdb.getPosterURL(d?.poster_path || null) || undefined,
              } as { title: string; year?: number; poster?: string };
            }
          } catch (err) {
            console.warn("TMDB title lookup failed for", key, err);
            meta = { title: "Untitled" };
          }
          memoDetails.set(key, meta);
        }

        return {
          ...row,
          id: String(row._id),
          _id: undefined,
          playableOnMyServices: playable,
          availableOn: providers,
          title: meta?.title || "Untitled",
          year: meta?.year,
          imageUrl: meta?.poster,
        };
      }

      // Recency decay: τ ≈ 72 hours (about a 3-day half-life feel)
      const tauHours = 72;
      const now = Date.now();

      function scoreRow(
        row: any,
        playableCount: number,
        mutualCircles: number
      ): number {
        const ageH = Math.max(
          0,
          (now - new Date(row.createdAt).getTime()) / (1000 * 60 * 60)
        );
        const recency = Math.exp(-ageH / tauHours);

        const act = Array.isArray(row.circles)
          ? row.circles.reduce(
              (sum: number, c: any) =>
                sum + (circleActivity.get(String(c)) || 0),
              0
            )
          : 0;
        const activityWeight = act / maxActivity;

        const engagement =
          (row.rating ? 0.3 : 0) +
          (row.comment
            ? (Math.min(String(row.comment).length, 300) / 300) * 0.2
            : 0);

        const playableBoost = Math.min(playableCount, 3) * 0.15;

        const mutualClamped = Math.min(Math.max(mutualCircles || 0, 0), 3);
        const personalBoost = (mutualClamped / 3) * 0.35;

        const pid = String((row as any).id || (row as any)._id);
        const likes = likeCounts.get(pid) || 0;
        const comments = commentCounts.get(pid) || 0;
        const friendLikes = friendLikeCounts.get(pid) || 0;
        const friendComments = friendCommentCounts.get(pid) || 0;

        const engagementGlobal = Math.log1p(likes + comments) * 0.15;
        const engagementFriends =
          Math.log1p(friendLikes + friendComments) * 0.35;

        return (
          recency *
          (1.0 +
            activityWeight * 0.9 +
            engagement +
            playableBoost +
            personalBoost +
            engagementGlobal +
            engagementFriends)
        );
      }

      const annotated = await Promise.all(rows.map(annotate));

      // Lookup circle names
      const circleIdSet = new Set<string>();
      annotated.forEach((r: any) => {
        if (Array.isArray(r.circles)) {
          r.circles.forEach((cid: any) => circleIdSet.add(String(cid)));
        }
      });

      const circleNameMap = new Map<string, string>();
      if (circleIdSet.size) {
        const circlesDocs = await Circle.find({
          _id: { $in: Array.from(circleIdSet) },
        })
          .select("_id name")
          .lean();
        circlesDocs.forEach((c: any) =>
          circleNameMap.set(String(c._id), c.name || "Circle")
        );
      }

      let ranked = annotated;
      if (safeSort === "smart") {
        ranked = annotated
          .map((row) => {
            const playableCount = Array.isArray(row.playableOnMyServices)
              ? row.playableOnMyServices.length
              : 0;
            const mutual = mutualMap.get(String(row.authorId)) || 0;
            const s = scoreRow(row, playableCount, mutual);
            return { row, _score: s };
          })
          .sort((a, b) => b._score - a._score)
          .map((x) => ({
            ...x.row,
            _score: Number(x._score.toFixed(4)),
          }));
      }

      // Trim to limit and derive nextCursor using the chronological position
      const slice = ranked.slice(0, safeLimit);
      let nextCursor: string | null = null;
      if (ranked.length > safeLimit && slice.length > 0) {
        const tail = slice[slice.length - 1];
        nextCursor = makeCursor({
          createdAt: tail.createdAt,
          _id: (tail as any).id || (tail as any)._id,
        });
      }

      const items = slice.map((row: any) => {
        const circleNames = Array.isArray(row.circles)
          ? row.circles
              .map((cid: any) => circleNameMap.get(String(cid)))
              .filter(Boolean)
          : [];

        const key = String((row as any).id || (row as any)._id);

        const authorKey =
          row && row.authorId != null ? String(row.authorId) : "";
        const authorProfile = authorKey
          ? authorProfileMap.get(authorKey)
          : undefined;
        const fallbackName =
          (typeof row?.authorName === "string" && row.authorName.trim()) ||
          "Someone";

        return {
          ...row,
          authorId: authorKey || undefined,
          authorName: authorProfile?.username || fallbackName,
          authorAvatarUrl: authorProfile?.avatarUrl,
          circleNames,
          body:
            typeof row.comment === "string" && row.comment.trim().length
              ? row.comment
              : "",
          likeCount: likeCounts.get(key) || 0,
          commentCount: commentCounts.get(key) || 0,
          likedByMe: likedByMe.has(key),
        };
      });

      return res.json({ items, nextCursor });
    } catch (err) {
      console.error("Feed error for user", req.user?.id, err);
      // Soft-fail so the homepage still renders instead of 500
      return res.status(200).json({
        items: [],
        nextCursor: null,
        error: "internal_error",
      });
    }
  })
);

export default r;
