
import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import Post from "../models/Post";
import Circle from "../models/Circle";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const r = Router();

// -------------------- Helpers --------------------
const objectId = z.string().refine(Types.ObjectId.isValid, "Invalid ObjectId");

const paged = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// -------------------- Create --------------------
const createSchema = z
  .object({
    type: z.enum(["movie", "tv"]),
    tmdbId: z.string().min(1).max(40).trim(),
    circles: z.array(objectId).min(1),
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(1000).optional(),
    watchedAt: z.coerce.date().optional(),
    seasonNumber: z.coerce.number().int().min(0).optional(),
    episodeNumber: z.coerce.number().int().min(0).optional(),
  })
  .refine(
    (d) => !(d.episodeNumber != null && d.seasonNumber == null),
    { message: "seasonNumber is required when episodeNumber is provided" }
  );

r.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());
  const { type, tmdbId, circles, rating, comment, watchedAt, seasonNumber, episodeNumber } = parsed.data;

  if (!rating && !comment) {
    return res.status(400).json({ error: "Provide a rating or a comment." });
  }

  // Must be member of ALL circles
  const count = await Circle.countDocuments({ _id: { $in: circles }, members: req.user!.id });
  if (count !== circles.length) {
    return res.status(403).json({ error: "You are not a member of one or more circles." });
  }

  const post = await Post.create({
    authorId: req.user!.id,
    type,
    tmdbId,
    circles,
    rating,
    comment,
    watchedAt,
    seasonNumber,
    episodeNumber,
  });

  res.status(201).json({ id: post.id });
});

// -------------------- List posts in a circle --------------------
r.get("/circle/:circleId", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.circleId);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid circle id" });

  // Ensure requester is a member
  const circle = await Circle.exists({ _id: idCheck.data, members: req.user!.id });
  if (!circle) return res.status(403).json({ error: "Access denied" });

  const qp = paged.safeParse(req.query);
  if (!qp.success) return res.status(400).json(qp.error.format());
  const { page, limit } = qp.data;

  const items = await Post.find({ circles: idCheck.data })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({ page, limit, items });
});

// -------------------- List my posts --------------------
r.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const qp = paged.safeParse(req.query);
  if (!qp.success) return res.status(400).json(qp.error.format());
  const { page, limit } = qp.data;

  const items = await Post.find({ authorId: req.user!.id })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({ page, limit, items });
});

// -------------------- Edit (author only) --------------------
const patchSchema = z
  .object({
    type: z.enum(["movie", "tv"]).optional(),
    tmdbId: z.string().min(1).max(40).trim().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    comment: z.string().trim().max(1000).nullable().optional(),
    watchedAt: z.coerce.date().nullable().optional(),
    circles: z.array(objectId).min(1).optional(),
    seasonNumber: z.coerce.number().int().min(0).nullable().optional(),
    episodeNumber: z.coerce.number().int().min(0).nullable().optional(),
  })
  .refine(
    (d) => !(d.episodeNumber != null && d.episodeNumber !== null && d.seasonNumber == null),
    { message: "seasonNumber is required when episodeNumber is provided" }
  );

r.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid post id" });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const post = await Post.findById(idCheck.data);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (String(post.authorId) !== req.user!.id) return res.status(403).json({ error: "Only the author can edit this post" });

  // circles reassignment (validate membership)
  if (parsed.data.circles) {
    const count = await Circle.countDocuments({ _id: { $in: parsed.data.circles }, members: req.user!.id });
    if (count !== parsed.data.circles.length) {
      return res.status(403).json({ error: "You are not a member of one or more circles." });
    }
    post.set("circles", parsed.data.circles);
  }

  // optional core fields
  if ("type" in parsed.data && parsed.data.type) post.set("type", parsed.data.type);
  if ("tmdbId" in parsed.data && parsed.data.tmdbId) post.set("tmdbId", parsed.data.tmdbId);

  // rating/comment/watchedAt — unset with set(path, undefined)
  if ("rating" in parsed.data)   post.set("rating",   parsed.data.rating   == null ? undefined : parsed.data.rating);
  if ("comment" in parsed.data)  post.set("comment",  parsed.data.comment  == null ? undefined : parsed.data.comment);
  if ("watchedAt" in parsed.data)post.set("watchedAt",parsed.data.watchedAt== null ? undefined : parsed.data.watchedAt);

  // season/episode (tv)
  if ("seasonNumber" in parsed.data) {
    if (parsed.data.seasonNumber == null) post.set("seasonNumber", undefined);
    else post.set("seasonNumber", parsed.data.seasonNumber);
  }
  if ("episodeNumber" in parsed.data) {
    if (parsed.data.episodeNumber == null) post.set("episodeNumber", undefined);
    else post.set("episodeNumber", parsed.data.episodeNumber);
  }

  // Must have some content after edits
  const hasRating = !!post.get("rating");
  const hasComment = !!post.get("comment");
  if (!hasRating && !hasComment) {
    return res.status(400).json({ error: "Post must have a rating or a comment." });
  }
  // If episode present, season must be present
  if (post.get("episodeNumber") != null && post.get("seasonNumber") == null) {
    return res.status(400).json({ error: "seasonNumber is required when episodeNumber is provided" });
  }

  await post.save();
  res.json({ ok: true });
});

// -------------------- Delete (author only) --------------------
r.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid post id" });

  const post = await Post.findById(idCheck.data).select("_id authorId").lean();
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (String(post.authorId) !== req.user!.id) return res.status(403).json({ error: "Only the author can delete this post" });

  await Post.findByIdAndDelete(idCheck.data);
  res.json({ ok: true });
});

export default r;
