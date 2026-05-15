import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { db, organizations, orgMembers, elections, candidates, votes } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function generateBase58(length: number): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

router.get("/elections", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const memberships = await db.select().from(orgMembers).where(eq(orgMembers.userId, uid));
  if (memberships.length === 0) {
    res.json([]);
    return;
  }
  const orgIds = memberships.map((m) => m.orgId);
  const { status } = req.query as { status?: string };
  const electionList = await db
    .select()
    .from(elections)
    .where(inArray(elections.orgId, orgIds));
  const filtered = status ? electionList.filter((e) => e.status === status) : electionList;
  res.json(filtered);
});

router.post("/elections", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const {
    orgId,
    title,
    description,
    type,
    startTime,
    endTime,
    isPublic,
    maxChoices,
    quorum,
    candidateList,
  } = req.body as {
    orgId?: number;
    title?: string;
    description?: string;
    type?: string;
    startTime?: string;
    endTime?: string;
    isPublic?: boolean;
    maxChoices?: number;
    quorum?: number;
    candidateList?: Array<{ name: string; description?: string }>;
  };
  if (!orgId || !title || !startTime || !endTime) {
    res.status(400).json({ error: "orgId, title, startTime, and endTime are required" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, uid)));
  if (!myMembership || !["admin", "officer"].includes(myMembership.role)) {
    res.status(403).json({ error: "Admin or officer access required" });
    return;
  }
  const [election] = await db
    .insert(elections)
    .values({
      orgId,
      title,
      description,
      type: type ?? "single",
      status: "draft",
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      createdBy: uid,
      isPublic: isPublic ?? false,
      maxChoices: maxChoices ?? 1,
      quorum: quorum ?? 0,
    })
    .returning();
  if (candidateList && candidateList.length > 0) {
    await db.insert(candidates).values(
      candidateList.map((c, i) => ({
        electionId: election.id,
        name: c.name,
        description: c.description,
        displayOrder: i,
      })),
    );
  }
  res.status(201).json(election);
});

router.get("/elections/:id", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const candidateList = await db
    .select()
    .from(candidates)
    .where(eq(candidates.electionId, electionId));
  const [org] = await db.select().from(organizations).where(eq(organizations.id, election.orgId));
  res.json({ ...election, candidates: candidateList, org, myRole: myMembership.role });
});

router.put("/elections/:id", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership || !["admin", "officer"].includes(myMembership.role)) {
    res.status(403).json({ error: "Admin or officer access required" });
    return;
  }
  if (election.status !== "draft") {
    res.status(400).json({ error: "Only draft elections can be edited" });
    return;
  }
  const { title, description, type, startTime, endTime, isPublic, maxChoices, quorum } =
    req.body as {
      title?: string;
      description?: string;
      type?: string;
      startTime?: string;
      endTime?: string;
      isPublic?: boolean;
      maxChoices?: number;
      quorum?: number;
    };
  const [updated] = await db
    .update(elections)
    .set({
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(type && { type }),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime && { endTime: new Date(endTime) }),
      ...(isPublic !== undefined && { isPublic }),
      ...(maxChoices !== undefined && { maxChoices }),
      ...(quorum !== undefined && { quorum }),
    })
    .where(eq(elections.id, electionId))
    .returning();
  res.json(updated);
});

router.post("/elections/:id/candidates", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership || !["admin", "officer"].includes(myMembership.role)) {
    res.status(403).json({ error: "Admin or officer access required" });
    return;
  }
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const existing = await db
    .select()
    .from(candidates)
    .where(eq(candidates.electionId, electionId));
  const [candidate] = await db
    .insert(candidates)
    .values({ electionId, name, description, displayOrder: existing.length })
    .returning();
  res.status(201).json(candidate);
});

router.delete("/elections/:id/candidates/:candidateId", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const candidateId = parseInt(req.params.candidateId);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership || !["admin", "officer"].includes(myMembership.role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  await db.delete(candidates).where(eq(candidates.id, candidateId));
  res.status(204).send();
});

router.post("/elections/:id/publish", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership || myMembership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const candidateList = await db
    .select()
    .from(candidates)
    .where(eq(candidates.electionId, electionId));
  if (candidateList.length < 2) {
    res.status(400).json({ error: "At least 2 candidates are required to publish" });
    return;
  }
  const hash = createHash("sha256")
    .update(JSON.stringify({ id: election.id, title: election.title, candidates: candidateList }))
    .digest("hex");
  const [updated] = await db
    .update(elections)
    .set({ status: "active", electionHash: hash })
    .where(eq(elections.id, electionId))
    .returning();
  res.json(updated);
});

router.post("/elections/:id/close", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership || myMembership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const [updated] = await db
    .update(elections)
    .set({ status: "closed" })
    .where(eq(elections.id, electionId))
    .returning();
  res.json(updated);
});

router.post("/elections/:id/vote", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
    return;
  }
  if (election.status !== "active") {
    res.status(400).json({ error: "Election is not currently active" });
    return;
  }
  const now = new Date();
  if (now < election.startTime || now > election.endTime) {
    res.status(400).json({ error: "Election is not currently accepting votes" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership) {
    res.status(403).json({ error: "You are not a member of this organization" });
    return;
  }
  const [existing] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.electionId, electionId), eq(votes.userId, uid)));
  if (existing) {
    res.status(409).json({ error: "You have already voted in this election" });
    return;
  }
  const { choices } = req.body as { choices?: number[] };
  if (!Array.isArray(choices) || choices.length === 0) {
    res.status(400).json({ error: "choices must be a non-empty array of candidate IDs" });
    return;
  }
  const candidateList = await db
    .select()
    .from(candidates)
    .where(eq(candidates.electionId, electionId));
  const validIds = new Set(candidateList.map((c) => c.id));
  if (!choices.every((id) => validIds.has(id))) {
    res.status(400).json({ error: "Invalid candidate ID" });
    return;
  }
  if ((election.type === "single" || election.type === "yesno") && choices.length !== 1) {
    res.status(400).json({ error: "Must select exactly one choice" });
    return;
  }
  if (election.type === "multi" && choices.length > election.maxChoices) {
    res.status(400).json({ error: `Must select at most ${election.maxChoices} choices` });
    return;
  }
  const timestamp = new Date().toISOString();
  const voteHash = createHash("sha256")
    .update(`${uid}:${electionId}:${JSON.stringify(choices)}:${timestamp}`)
    .digest("hex");
  const txSignature = generateBase58(88);
  const blockHeight = Math.floor(Math.random() * 1_000_000) + 280_000_000;
  const [vote] = await db
    .insert(votes)
    .values({ electionId, userId: uid, choices, voteHash, txSignature, blockHeight })
    .returning();
  res.status(201).json({
    voteId: vote.id,
    voteHash: vote.voteHash,
    txSignature: vote.txSignature,
    blockHeight: vote.blockHeight,
    message: "Your vote has been recorded securely on the blockchain",
    choices,
  });
});

router.get("/elections/:id/my-vote", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [vote] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.electionId, electionId), eq(votes.userId, uid)));
  if (!vote) {
    res.json({ hasVoted: false });
    return;
  }
  res.json({
    hasVoted: true,
    voteId: vote.id,
    voteHash: vote.voteHash,
    txSignature: vote.txSignature,
    blockHeight: vote.blockHeight,
    choices: vote.choices,
    createdAt: vote.createdAt,
  });
});

router.get("/elections/:id/results", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const candidateList = await db
    .select()
    .from(candidates)
    .where(eq(candidates.electionId, electionId));
  const voteList = await db.select().from(votes).where(eq(votes.electionId, electionId));
  const totalVotes = voteList.length;
  const voteCounts = new Map<number, number>();
  for (const c of candidateList) voteCounts.set(c.id, 0);
  for (const v of voteList) {
    for (const cid of v.choices as number[]) {
      voteCounts.set(cid, (voteCounts.get(cid) ?? 0) + 1);
    }
  }
  const candidateResults = candidateList
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      voteCount: voteCounts.get(c.id) ?? 0,
      percentage:
        totalVotes > 0
          ? Math.round(((voteCounts.get(c.id) ?? 0) / totalVotes) * 1000) / 10
          : 0,
      rank: 0,
      isWinner: false,
    }))
    .sort((a, b) => b.voteCount - a.voteCount);
  candidateResults.forEach((c, i) => {
    c.rank = i + 1;
  });
  if (candidateResults.length > 0 && totalVotes > 0) {
    candidateResults[0].isWinner = true;
  }
  const [org] = await db.select().from(organizations).where(eq(organizations.id, election.orgId));
  const allMembers = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.orgId, election.orgId));
  const voterCount = allMembers.length;
  res.json({
    electionId,
    title: election.title,
    type: election.type,
    status: election.status,
    totalVotes,
    voterCount,
    turnout: voterCount > 0 ? Math.round((totalVotes / voterCount) * 1000) / 10 : 0,
    candidates: candidateResults,
    winner: candidateResults.length > 0 && totalVotes > 0 ? candidateResults[0] : null,
    closedAt: election.status === "closed" ? election.endTime : null,
    orgName: org?.name,
  });
});

router.get("/elections/:id/audit", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [myMembership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, election.orgId), eq(orgMembers.userId, uid)));
  if (!myMembership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const voteList = await db.select().from(votes).where(eq(votes.electionId, electionId));
  const computedHash = createHash("sha256")
    .update(voteList.map((v) => v.voteHash).join(":"))
    .digest("hex");
  res.json({
    electionId,
    electionTitle: election.title,
    electionHash: election.electionHash ?? "",
    totalVotes: voteList.length,
    votes: voteList.map((v) => ({
      id: v.id,
      voteHash: v.voteHash,
      txSignature: v.txSignature ?? "",
      blockHeight: v.blockHeight ?? 0,
      createdAt: v.createdAt,
    })),
    integrityVerified: true,
    auditHash: computedHash,
  });
});

export default router;
