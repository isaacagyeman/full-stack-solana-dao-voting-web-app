import { Router } from "express";
import { randomBytes } from "crypto";
import { db, users, organizations, orgMembers, elections } from "@workspace/db";
import { eq, and, inArray, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function generateAccessCode(length = 8): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

async function enrichOrg(
  org: typeof organizations.$inferSelect,
  userId: number,
  memberships: Array<typeof orgMembers.$inferSelect>,
) {
  const [mc] = await db
    .select({ count: count() })
    .from(orgMembers)
    .where(eq(orgMembers.orgId, org.id));
  const [ec] = await db
    .select({ count: count() })
    .from(elections)
    .where(eq(elections.orgId, org.id));
  const mine = memberships.find((m) => m.orgId === org.id && m.userId === userId);
  return {
    ...org,
    memberCount: Number(mc.count),
    electionCount: Number(ec.count),
    myRole: mine?.role ?? null,
  };
}

router.get("/organizations", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const memberships = await db.select().from(orgMembers).where(eq(orgMembers.userId, uid));
  if (memberships.length === 0) {
    res.json([]);
    return;
  }
  const orgIds = memberships.map((m) => m.orgId);
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.id, orgIds));
  const result = await Promise.all(orgs.map((o) => enrichOrg(o, uid, memberships)));
  res.json(result);
});

router.post("/organizations", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  if (req.user!.role !== "organizer") {
    res.status(403).json({ error: "Only election organizers can create organizations" });
    return;
  }
  const { name, description, isPublic } = req.body as {
    name?: string;
    description?: string;
    isPublic?: boolean;
  };
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36);
  const accessCode = generateAccessCode();
  const [org] = await db
    .insert(organizations)
    .values({ name, slug, accessCode, description, isPublic: isPublic ?? true, ownerId: uid })
    .returning();
  await db.insert(orgMembers).values({ orgId: org.id, userId: uid, role: "admin" });
  res.status(201).json({ ...org, memberCount: 1, electionCount: 0, myRole: "admin" });
});

router.get("/organizations/:slug", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, req.params.slug as string));
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const memberships = await db.select().from(orgMembers).where(eq(orgMembers.userId, uid));
  const enriched = await enrichOrg(org, uid, memberships);
  res.json(enriched);
});

router.put("/organizations/:slug", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, req.params.slug as string));
  if (!org) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [member] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const { name, description, isPublic } = req.body as {
    name?: string;
    description?: string;
    isPublic?: boolean;
  };
  const [updated] = await db
    .update(organizations)
    .set({ ...(name && { name }), ...(description !== undefined && { description }), ...(isPublic !== undefined && { isPublic }) })
    .where(eq(organizations.id, org.id))
    .returning();
  res.json(updated);
});

router.post("/organizations/join", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { accessCode } = req.body as { accessCode?: string };
  if (!accessCode) {
    res.status(400).json({ error: "Voting reference (access code) is required" });
    return;
  }
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.accessCode, accessCode.trim().toUpperCase()));
  if (!org) {
    res.status(404).json({ error: "Invalid voting reference" });
    return;
  }
  const [existing] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (existing) {
    res.status(200).json({ ...org, myRole: existing.role, memberCount: 0, electionCount: 0 });
    return;
  }
  const [member] = await db
    .insert(orgMembers)
    .values({ orgId: org.id, userId: uid, role: "voter" })
    .returning();
  const [mc] = await db
    .select({ count: count() })
    .from(orgMembers)
    .where(eq(orgMembers.orgId, org.id));
  const [ec] = await db
    .select({ count: count() })
    .from(elections)
    .where(eq(elections.orgId, org.id));
  res.status(201).json({
    ...org,
    myRole: member.role,
    memberCount: Number(mc.count),
    electionCount: Number(ec.count),
  });
});

router.get("/organizations/:slug/members", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, req.params.slug as string));
  if (!org) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const members = await db
    .select({
      id: orgMembers.id,
      orgId: orgMembers.orgId,
      userId: orgMembers.userId,
      role: orgMembers.role,
      joinedAt: orgMembers.joinedAt,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(orgMembers)
    .leftJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, org.id));
  res.json(members);
});

router.post("/organizations/:slug/members", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, req.params.slug as string));
  if (!org) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership || !["admin", "officer"].includes(myMembership.role)) {
    res.status(403).json({ error: "Admin or officer access required" });
    return;
  }
  const { email, role } = req.body as { email?: string; role?: string };
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const [targetUser] = await db.select().from(users).where(eq(users.email, email));
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, targetUser.id)));
  if (existing) {
    res.status(409).json({ error: "User is already a member" });
    return;
  }
  const [member] = await db
    .insert(orgMembers)
    .values({ orgId: org.id, userId: targetUser.id, role: role ?? "voter" })
    .returning();
  res.status(201).json({
    ...member,
    name: targetUser.name,
    email: targetUser.email,
    avatarUrl: targetUser.avatarUrl,
  });
});

router.put("/organizations/:slug/members/:userId/role", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const targetUserId = parseInt(req.params.userId as string);
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, req.params.slug as string));
  if (!org) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership || myMembership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const { role } = req.body as { role?: string };
  if (!role) {
    res.status(400).json({ error: "Role is required" });
    return;
  }
  const [updated] = await db
    .update(orgMembers)
    .set({ role })
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, targetUserId)))
    .returning();
  res.json(updated);
});

router.delete("/organizations/:slug/members/:userId", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const targetUserId = parseInt(req.params.userId as string);
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, req.params.slug as string));
  if (!org) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership || (myMembership.role !== "admin" && uid !== targetUserId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, targetUserId)));
  res.status(204).send();
});

router.get("/organizations/:slug/elections", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, req.params.slug as string));
  if (!org) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const { status } = req.query as { status?: string };
  const query = db.select().from(elections).where(eq(elections.orgId, org.id));
  const electionList = await query;
  const filtered = status ? electionList.filter((e) => e.status === status) : electionList;
  res.json(filtered);
});

router.get("/organizations/:slug/analytics", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, req.params.slug as string));
  if (!org) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const [memberCount] = await db
    .select({ count: count() })
    .from(orgMembers)
    .where(eq(orgMembers.orgId, org.id));
  const [electionCount] = await db
    .select({ count: count() })
    .from(elections)
    .where(eq(elections.orgId, org.id));
  const activeElections = await db
    .select()
    .from(elections)
    .where(and(eq(elections.orgId, org.id), eq(elections.status, "active")));
  res.json({
    memberCount: Number(memberCount.count),
    electionCount: Number(electionCount.count),
    activeElectionCount: activeElections.length,
    myRole: myMembership.role,
  });
});

export default router;
