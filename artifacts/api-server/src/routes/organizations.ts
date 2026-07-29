import { Router } from "express";
import { randomBytes } from "crypto";
import multer from "multer";
import {
  db, users, organizations, orgMembers, elections, voterTokens, bulkVoterUploads,
} from "@workspace/db";
import { eq, and, inArray, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { generateVoterToken } from "../lib/voter-tokens";
import { parseExcelBuffer } from "../lib/excel-parser";

const router = Router();

// Multer: accept both CSV and Excel files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".xlsx") || file.originalname.endsWith(".xls")) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel (.xlsx, .xls) files are supported"));
    }
  },
});

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
  const [mc] = await db.select({ count: count() }).from(orgMembers).where(eq(orgMembers.orgId, org.id));
  const [ec] = await db.select({ count: count() }).from(elections).where(eq(elections.orgId, org.id));
  const mine = memberships.find((m) => m.orgId === org.id && m.userId === userId);
  return { ...org, memberCount: Number(mc.count), electionCount: Number(ec.count), myRole: mine?.role ?? null };
}

// ─── List user's orgs ────────────────────────────────────────────────────────
router.get("/organizations", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const memberships = await db.select().from(orgMembers).where(eq(orgMembers.userId, uid));
  if (memberships.length === 0) { res.json([]); return; }
  const orgIds = memberships.map((m) => m.orgId);
  const orgs = await db.select().from(organizations).where(inArray(organizations.id, orgIds));
  const result = await Promise.all(orgs.map((o) => enrichOrg(o, uid, memberships)));
  res.json(result);
});

// ─── Create org ───────────────────────────────────────────────────────────────
router.post("/organizations", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  if (req.user!.role !== "organizer") {
    res.status(403).json({ error: "Only election organizers can create organizations" });
    return;
  }
  const { name, description, isPublic } = req.body as { name?: string; description?: string; isPublic?: boolean };
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
  const accessCode = generateAccessCode();
  const [org] = await db.insert(organizations).values({ name, slug, accessCode, description, isPublic: isPublic ?? true, ownerId: uid }).returning();
  await db.insert(orgMembers).values({ orgId: org.id, userId: uid, role: "admin", status: "active" });
  res.status(201).json({ ...org, memberCount: 1, electionCount: 0, myRole: "admin" });
});

// ─── Get single org ───────────────────────────────────────────────────────────
router.get("/organizations/:slug", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug as string));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const memberships = await db.select().from(orgMembers).where(eq(orgMembers.userId, uid));
  const enriched = await enrichOrg(org, uid, memberships);
  res.json(enriched);
});

// ─── Update org ───────────────────────────────────────────────────────────────
router.put("/organizations/:slug", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug as string));
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  const [member] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!member || member.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
  const { name, description, isPublic } = req.body as { name?: string; description?: string; isPublic?: boolean };
  const [updated] = await db.update(organizations)
    .set({ ...(name && { name }), ...(description !== undefined && { description }), ...(isPublic !== undefined && { isPublic }) })
    .where(eq(organizations.id, org.id))
    .returning();
  res.json(updated);
});

// ─── Join org ─────────────────────────────────────────────────────────────────
// New behaviour: if memberToken supplied → link userId to an existing invited orgMember.
// If no memberToken → self-join as voter (legacy flow still works for open orgs).
router.post("/organizations/join", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { accessCode, memberToken } = req.body as { accessCode?: string; memberToken?: string };
  if (!accessCode) { res.status(400).json({ error: "Voting reference (access code) is required" }); return; }

  const [org] = await db.select().from(organizations).where(eq(organizations.accessCode, accessCode.trim().toUpperCase()));
  if (!org) { res.status(404).json({ error: "Invalid voting reference" }); return; }

  // Token-based join: link an invited member to a real user account
  if (memberToken) {
    const [tokenRecord] = await db.select().from(voterTokens)
      .where(and(eq(voterTokens.orgId, org.id), eq(voterTokens.token, memberToken.trim())));

    if (!tokenRecord) { res.status(401).json({ error: "Invalid voter token" }); return; }
    if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
      res.status(401).json({ error: "Voter token has expired" }); return;
    }
    if (tokenRecord.orgMemberId == null) {
      res.status(400).json({ error: "This token is not linked to a member record" }); return;
    }

    // Link userId to orgMember
    const [memberRecord] = await db.select().from(orgMembers).where(eq(orgMembers.id, tokenRecord.orgMemberId));
    if (!memberRecord) { res.status(404).json({ error: "Member record not found" }); return; }

    if (memberRecord.userId && memberRecord.userId !== uid) {
      res.status(409).json({ error: "This token has already been claimed by another account" }); return;
    }

    await db.update(orgMembers).set({ userId: uid, status: "active" }).where(eq(orgMembers.id, memberRecord.id));
    await db.update(voterTokens).set({ userId: uid }).where(eq(voterTokens.id, tokenRecord.id));

    const [mc] = await db.select({ count: count() }).from(orgMembers).where(eq(orgMembers.orgId, org.id));
    const [ec] = await db.select({ count: count() }).from(elections).where(eq(elections.orgId, org.id));
    res.json({ ...org, myRole: memberRecord.role, memberCount: Number(mc.count), electionCount: Number(ec.count), linkedMember: true });
    return;
  }

  // Legacy self-join (no token)
  const [existing] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (existing) {
    const [token] = await db.select().from(voterTokens).where(and(eq(voterTokens.orgId, org.id), eq(voterTokens.userId, uid)));
    res.status(200).json({ ...org, myRole: existing.role, memberCount: 0, electionCount: 0, voterToken: token?.token });
    return;
  }

  const [member] = await db.insert(orgMembers).values({ orgId: org.id, userId: uid, role: "voter", status: "active" }).returning();
  const voterToken = generateVoterToken();
  await db.insert(voterTokens).values({ orgId: org.id, userId: uid, token: voterToken });
  const [mc] = await db.select({ count: count() }).from(orgMembers).where(eq(orgMembers.orgId, org.id));
  const [ec] = await db.select({ count: count() }).from(elections).where(eq(elections.orgId, org.id));
  res.status(201).json({ ...org, myRole: member.role, memberCount: Number(mc.count), electionCount: Number(ec.count), voterToken });
});

// ─── List members ─────────────────────────────────────────────────────────────
router.get("/organizations/:slug/members", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug as string));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [myMembership] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership) { res.status(403).json({ error: "Access denied" }); return; }

  const memberList = await db.select().from(orgMembers).where(eq(orgMembers.orgId, org.id));

  // Enrich with user data where available
  const userIds = memberList.map((m) => m.userId).filter((id): id is number => id != null);
  const userMap = new Map<number, typeof users.$inferSelect>();
  if (userIds.length > 0) {
    const userList = await db.select().from(users).where(inArray(users.id, userIds));
    for (const u of userList) userMap.set(u.id, u);
  }

  const enriched = memberList.map((m) => {
    const u = m.userId ? userMap.get(m.userId) : null;
    return {
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      fullName: m.fullName ?? u?.name ?? "—",
      email: m.email ?? u?.email ?? "—",
      phone: m.phone ?? u?.phone ?? "—",
      department: m.department ?? null,
      position: m.position ?? null,
      hasAccount: !!m.userId,
    };
  });

  res.json(enriched);
});

// ─── Add single member by email ───────────────────────────────────────────────
router.post("/organizations/:slug/members", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug as string));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [myMembership] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership || !["admin", "officer"].includes(myMembership.role)) {
    res.status(403).json({ error: "Admin or officer access required" }); return;
  }

  const { email, role } = req.body as { email?: string; role?: string };
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  const [targetUser] = await db.select().from(users).where(eq(users.email, email));
  if (!targetUser) { res.status(404).json({ error: "No account found with that email" }); return; }

  const [existing] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, targetUser.id)));
  if (existing) { res.status(409).json({ error: "User is already a member" }); return; }

  const [newMember] = await db.insert(orgMembers).values({
    orgId: org.id, userId: targetUser.id, role: role ?? "voter", status: "active"
  }).returning();

  res.status(201).json({ ...newMember, email: targetUser.email, name: targetUser.name });
});

// ─── Update member role ───────────────────────────────────────────────────────
router.patch("/organizations/:slug/members/:memberId", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug as string));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [myMembership] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership || myMembership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" }); return;
  }

  const memberId = parseInt(req.params.memberId as string);
  const { role } = req.body as { role?: string };
  if (!role) { res.status(400).json({ error: "Role is required" }); return; }

  const [updated] = await db.update(orgMembers).set({ role }).where(and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, org.id))).returning();
  if (!updated) { res.status(404).json({ error: "Member not found" }); return; }
  res.json(updated);
});

// ─── Remove member ────────────────────────────────────────────────────────────
router.delete("/organizations/:slug/members/:memberId", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug as string));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [myMembership] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership || myMembership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" }); return;
  }

  const memberId = parseInt(req.params.memberId as string);
  await db.delete(orgMembers).where(and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, org.id)));
  res.status(204).send();
});

// ─── Preview Excel import (parse without saving) ──────────────────────────────
router.post("/organizations/:slug/members/import-preview", requireAuth, upload.single("file"), async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug as string));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [myMembership] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership || !["admin", "officer"].includes(myMembership.role)) {
    res.status(403).json({ error: "Admin or officer access required" }); return;
  }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const { records, errors } = parseExcelBuffer(req.file.buffer);
  res.json({ records, errors, count: records.length });
});

// ─── Confirm Excel import (save members) ──────────────────────────────────────
router.post("/organizations/:slug/members/import-confirm", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug as string));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
  const [myMembership] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, uid)));
  if (!myMembership || !["admin", "officer"].includes(myMembership.role)) {
    res.status(403).json({ error: "Admin or officer access required" }); return;
  }

  const { members } = req.body as { members?: Array<{ fullName: string; email: string; phone: string; department?: string; position?: string }> };
  if (!Array.isArray(members) || members.length === 0) {
    res.status(400).json({ error: "No members provided" }); return;
  }

  const [uploadRecord] = await db.insert(bulkVoterUploads).values({
    orgId: org.id, uploadedBy: uid, filename: "excel-import.xlsx",
    totalRows: members.length, status: "processing",
  }).returning();

  let successCount = 0;
  const failureLog: Array<{ row: number; email: string; error: string }> = [];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    try {
      // Check if an invited member with this email already exists
      const existing = await db.select().from(orgMembers)
        .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.email, m.email)));
      if (existing.length > 0) continue;

      // Also check if a full account holder with this email is already a member
      const [existingUser] = await db.select().from(users).where(eq(users.email, m.email));
      if (existingUser) {
        const [existingMember] = await db.select().from(orgMembers)
          .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, existingUser.id)));
        if (existingMember) continue;
      }

      await db.insert(orgMembers).values({
        orgId: org.id,
        userId: existingUser?.id ?? null,
        role: "voter",
        status: existingUser ? "active" : "invited",
        fullName: m.fullName,
        email: m.email,
        phone: m.phone,
        department: m.department ?? null,
        position: m.position ?? null,
        invitedAt: new Date(),
      });

      successCount++;
    } catch (err) {
      failureLog.push({ row: i + 1, email: m.email, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  await db.update(bulkVoterUploads).set({
    successfulRows: successCount, failedRows: failureLog.length,
    status: "completed", completedAt: new Date(),
    errorLog: failureLog.length > 0 ? JSON.stringify(failureLog) : null,
  }).where(eq(bulkVoterUploads.id, uploadRecord.id));

  res.status(201).json({
    uploadId: uploadRecord.id,
    totalRows: members.length,
    successfulRows: successCount,
    failedRows: failureLog.length,
    failureLog,
    message: `Successfully added ${successCount} members to the organization`,
  });
});

// ─── Legacy CSV bulk-upload (kept for backward compatibility) ─────────────────
router.post("/organizations/:slug/members/bulk-upload", requireAuth, upload.single("file"), async (req, res) => {
  res.status(410).json({ error: "This endpoint is deprecated. Use /import-preview + /import-confirm instead." });
});

export default router;
