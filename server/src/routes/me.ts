
import { Router } from "express";
import { z } from "zod";
import User, { SERVICES, Service } from "../models/user";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const r = Router();

r.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.user!.id).select("-passwordHash").lean();
  res.json(user);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  services: z.array(z.enum(SERVICES as unknown as [Service, ...Service[]])).optional(),
});

r.patch("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const updated = await User.findByIdAndUpdate(
    req.user!.id,
    parsed.data,
    { new: true, runValidators: true, select: "-passwordHash" }
  ).lean();

  res.json(updated);
});

export default r;
