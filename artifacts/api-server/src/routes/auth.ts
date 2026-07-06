import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "fallback-dev-secret";

function makeToken(userId: number, email: string, name: string, role: string) {
  return jwt.sign({ userId, email, name, role }, JWT_SECRET, { expiresIn: "7d" });
}

router.post("/auth/signup", async (req, res) => {
  const { email, password, name, role } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
  };
  if (!email || !password || !name || !role) {
    res.status(400).json({ error: "Email, password, name, and role are required" });
    return;
  }
  if (role !== "organizer" && role !== "voter") {
    res.status(400).json({ error: "Role must be either 'organizer' or 'voter'" });
    return;
  }
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name, role, emailVerified: true, verificationLevel: 1 })
    .returning();
  const token = makeToken(user.id, user.email, user.name, user.role);
  const { passwordHash: _ph, ...safeUser } = user;
  res.status(201).json({ token, user: safeUser });
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = makeToken(user.id, user.email, user.name, user.role);
  const { passwordHash: _ph, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { passwordHash: _ph, ...safeUser } = user;
  res.json(safeUser);
});

export default router;
