
import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import crypto from "crypto";
import Circle from "../models/Circle";
import User from "../models/user";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const r = Router();

// Reusable validators
const objectId = z.string().refine(Types.ObjectId.isValid, "Invalid ObjectId");

const paged = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// ---------- Create a circle (private by default) ----------
const createSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  description: z.string().max(240).trim().optional(),
  visibility: z.enum(["private", "public"]).optional().default("private"),
  members: z.array(objectId).optional(), // optional extra members besides creator
});

r.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());
  const { name, description, visibility, members = [] } = parsed.data;

  // Sanity-check provided members exist
  const uniq = Array.from(new Set([req.user!.id, ...members]));
  const count = await User.countDocuments({ _id: { $in: uniq } });
  if (count !== uniq.length) return res.status(400).json({ error: "One or more members do not exist" });

  const inviteCode = visibility === "private" ? crypto.randomBytes(8).toString("hex") : undefined;

  const circle = await Circle.create({
    name,
    description,
    visibility,
    createdBy: req.user!.id,
    members: uniq,
    inviteCode,
  });

  res.status(201).json({ id: circle.id });
});

// ---------- List my circles ----------
r.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const circles = await Circle.find({ members: req.user!.id })
    .select("_id name description visibility createdBy members createdAt updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  // You can optionally return counts instead of full members list to reduce payload
  const items = circles.map(c => ({
    _id: c._id,
    name: c.name,
    description: c.description,
    visibility: c.visibility,
    createdBy: c.createdBy,
    membersCount: Array.isArray(c.members) ? c.members.length : 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  res.json(items);
});

// ---------- Get one circle (members only for full details) ----------
r.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid id" });

  const circle = await Circle.findOne({ _id: idCheck.data, members: req.user!.id })
    .select("_id name description visibility createdBy members createdAt updatedAt")
    .lean();

  if (!circle) return res.status(404).json({ error: "Circle not found or access denied" });
  res.json(circle);
});

// ---------- Discover public circles ----------
r.get("/discover/list", requireAuth, async (req: AuthedRequest, res) => {
  const qp = paged.safeParse(req.query);
  if (!qp.success) return res.status(400).json(qp.error.format());
  const { page, limit } = qp.data;

  const q = (req.query.q as string | undefined)?.trim() ?? "";
  const filter: any = { visibility: "public" };
  if (q) filter.name = { $regex: q, $options: "i" };

  const items = await Circle.find(filter)
    .select("_id name description visibility createdAt members")
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // return count only, not member IDs
  res.json({
    page,
    limit,
    items: items.map(c => ({
      _id: c._id,
      name: c.name,
      description: c.description,
      visibility: c.visibility,
      createdAt: c.createdAt,
      membersCount: Array.isArray(c.members) ? c.members.length : 0,
      // isMember helps the client show "Join" vs "Open"
      isMember: Array.isArray(c.members) ? c.members.some((m: any) => String(m) === req.user!.id) : false,
    })),
  });
});

// ---------- Join a circle ----------
const joinSchema = z.object({
  inviteCode: z.string().trim().optional(), // required for private
});

r.post("/:id/join", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid id" });

  const circle = await Circle.findById(idCheck.data);
  if (!circle) return res.status(404).json({ error: "Circle not found" });

  // Already a member
  if (circle.members.some(m => String(m) === req.user!.id)) {
    return res.json({ ok: true, alreadyMember: true });
  }

  if (circle.visibility === "public") {
    await Circle.findByIdAndUpdate(circle._id, { $addToSet: { members: req.user!.id } });
    return res.json({ ok: true });
  }

  // private: require invite code
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  if (!circle.inviteCode || parsed.data.inviteCode !== circle.inviteCode) {
    return res.status(403).json({ error: "Invalid or missing invite code" });
  }

  await Circle.findByIdAndUpdate(circle._id, { $addToSet: { members: req.user!.id } });
  res.json({ ok: true });
});

// ---------- Leave a circle (owner cannot leave) ----------
r.post("/:id/leave", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid id" });

  const circle = await Circle.findById(idCheck.data).select("_id createdBy members").lean();
  if (!circle) return res.status(404).json({ error: "Circle not found" });

  if (String(circle.createdBy) === req.user!.id) {
    return res.status(400).json({ error: "Owner cannot leave their own circle. Delete it or transfer ownership." });
  }

  const isMember = Array.isArray(circle.members) && circle.members.some(m => String(m) === req.user!.id);
  if (!isMember) return res.status(400).json({ error: "You are not a member of this circle" });

  await Circle.findByIdAndUpdate(circle._id, { $pull: { members: req.user!.id } });
  res.json({ ok: true });
});

// ---------- Rotate invite code (owner only) ----------
r.post("/:id/rotate-invite", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid id" });

  const circle = await Circle.findById(idCheck.data).select("_id createdBy visibility").lean();
  if (!circle) return res.status(404).json({ error: "Circle not found" });
  if (String(circle.createdBy) !== req.user!.id) return res.status(403).json({ error: "Only the owner can rotate invite code" });

  if (circle.visibility !== "private") {
    // No invite code for public circles
    await Circle.findByIdAndUpdate(circle._id, { $unset: { inviteCode: "" } });
    return res.json({ ok: true, inviteCode: null });
  }

  const inviteCode = crypto.randomBytes(8).toString("hex");
  await Circle.findByIdAndUpdate(circle._id, { inviteCode });
  res.json({ ok: true, inviteCode });
});

// ---------- Update circle (owner only) ----------
const patchSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  description: z.string().max(240).trim().optional(),
  visibility: z.enum(["private", "public"]).optional(),
  addMembers: z.array(objectId).optional(),
  removeMembers: z.array(objectId).optional(),
});

r.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid id" });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const circle = await Circle.findById(idCheck.data);
  if (!circle) return res.status(404).json({ error: "Circle not found" });
  if (String(circle.createdBy) !== req.user!.id) return res.status(403).json({ error: "Only the owner can modify this circle" });

  const updates: any = {};
  const ops: any = {};

  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.visibility) updates.visibility = parsed.data.visibility;

  if (parsed.data.addMembers?.length) {
    ops.$addToSet = { ...(ops.$addToSet || {}), members: { $each: parsed.data.addMembers } };
  }

  if (parsed.data.removeMembers?.length) {
    const toRemove = parsed.data.removeMembers.filter(m => m !== String(circle.createdBy));
    if (toRemove.length) ops.$pullAll = { ...(ops.$pullAll || {}), members: toRemove };
  }

  // If switching to private and there's no invite code yet, create one
  if (parsed.data.visibility === "private" && !circle.inviteCode) {
    updates.inviteCode = crypto.randomBytes(8).toString("hex");
  }
  // If switching to public, remove invite code
  if (parsed.data.visibility === "public") {
    ops.$unset = { ...(ops.$unset || {}), inviteCode: "" };
  }

  const updated = await Circle.findByIdAndUpdate(
    circle._id,
    Object.keys(ops).length ? { ...updates, ...ops } : updates,
    { new: true, runValidators: true, select: "_id name description visibility createdBy members createdAt updatedAt" }
  ).lean();

  res.json(updated);
});

// ---------- Delete circle (owner only) ----------
r.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const idCheck = objectId.safeParse(req.params.id);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid id" });

  const circle = await Circle.findById(idCheck.data).select("_id createdBy").lean();
  if (!circle) return res.status(404).json({ error: "Circle not found" });
  if (String(circle.createdBy) !== req.user!.id) return res.status(403).json({ error: "Only the owner can delete this circle" });

  await Circle.findByIdAndDelete(circle._id);
  res.json({ ok: true });
});

export default r;
