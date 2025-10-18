
import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import Viewing from "../models/Viewing";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const r = Router();

// -------------------- Validators & helpers --------------------
const objectId = z.string().refine(Types.ObjectId.isValid, "Invalid ObjectId");

const paged = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

const createSchema = z
  .object({
    type: z.enum(["movie", "tv"]),
    tmdbId: z.string().min(1).max(40).trim(),
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(1000).optional(),
    watchedAt: z.coerce.date().optional(),
    seasonNumber: z.coerce.number().int().min(0).optional(),
    episodeNumber: z.coerce.number().int().min(0).optional(),
  })
  .refine((d) => !(d.episodeNumber != null && d.seasonNumber == null), {
    message: "seasonNumber is required when episodeNumber is provided",
  });

// Optional filters for listing your own viewings
const meQuery = paged.extend({
  type: z.enum(["movie", "tv"]).optional(),
  start: z.coerce.date().optional(), // inclusive
  end: z.coerce.date().optional(),   // exclusive
});

// -------------------- Create a viewing --------------------
r.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const doc = await Viewing.create({ userId: req.user!.id, ...parsed.data });
  res.status(201).json({ id: doc.id });
});

// -------------------- List my viewings (with filters) --------------------
r.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const qp = meQuery.safeParse(req.query);
  if (!qp.success) return res.status(400).json(qp.error.format());
  const { page, limit, type, start, end } = qp.data;

  const filter: any = { userId: req.user!.id };
  if (type) filter.type = type;
  if (start || end) {
    filter.watchedAt = {};
    if (start) filter.watchedAt.$gte = start;
    if (end) filter.watchedAt.$lt = end;
  }

  const items = await Viewing.find(filter)
    .sort({ watchedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({ page, limit, items });
});

// -------------------- Delete a viewing (owner only) --------------------
r.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid viewing id" });

  const v = await Viewing.findById(idCheck.data).select("_id userId").lean();
  if (!v) return res.status(404).json({ error: "Viewing not found" });
  if (String(v.userId) !== req.user!.id) {
    return res.status(403).json({ error: "You can only delete your own viewing" });
  }

  await Viewing.findByIdAndDelete(idCheck.data);
  res.json({ ok: true });
});

export default r;
