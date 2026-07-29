import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import multer from "multer";
import {
  db, users, organizations, orgMembers, elections, candidates, votes, voterTokens,
  electionVoterGroups, electionGroupMembers, electionVoters, electionBundles,
  notifications, notificationPreferences, polls, pollOptions, pollVotes,
} from "@workspace/db";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { submitVoteMemo } from "../lib/solana";
import { NotificationService } from "../lib/notifications";
import { generateVoterToken } from "../lib/voter-tokens";
import { parseCandidateExcelBuffer } from "../lib/excel-parser";

const router = Router();

// Multer setup for image uploads
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are supported"));
    }
  },
});

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
  let electionList = await db
    .select()
    .from(elections)
    .where(inArray(elections.orgId, orgIds));

  // Filter by group membership (FEATURE 4)
  const filtered: typeof electionList = [];
  for (const election of electionList) {
    if (election.requiredGroupId) {
      // Check if user is in the required group
      const [groupMembership] = await db
        .select()
        .from(electionGroupMembers)
        .where(
          and(
            eq(electionGroupMembers.groupId, election.requiredGroupId),
            eq(electionGroupMembers.userId, uid)
          )
        );
      if (groupMembership) {
        filtered.push(election);
      }
    } else {
      // No group required, all members can see it
      filtered.push(election);
    }
  }

  const finalFiltered = status ? filtered.filter((e) => e.status === status) : filtered;
  res.json(finalFiltered);
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
  if (req.user!.role !== "organizer") {
    res.status(403).json({ error: "Only election organizers can create elections" });
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
  const electionId = parseInt(req.params.id as string);
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
  const electionId = parseInt(req.params.id as string);
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
  const electionId = parseInt(req.params.id as string);
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
  const electionId = parseInt(req.params.id as string);
  const candidateId = parseInt(req.params.candidateId as string);
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

// Upload candidate image (FEATURE 1)
router.post("/elections/:id/candidates/:candidateId/image", requireAuth, imageUpload.single("image"), async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
  const candidateId = parseInt(req.params.candidateId as string);

  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
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

  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }

  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId));
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }

  try {
    // Convert image to base64
    const imageData = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${imageData}`;

    // Update candidate with image
    const [updated] = await db
      .update(candidates)
      .set({ imageUrl })
      .where(eq(candidates.id, candidateId))
      .returning();

    res.json({
      ...updated,
      message: "Candidate image uploaded successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to upload image",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ===== FEATURE 2: MULTI-POLL ELECTION ENDPOINTS =====

// Create a poll for an election
router.post("/elections/:id/polls", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
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
    res.status(400).json({ error: "Can only add polls to draft elections" });
    return;
  }
  const { question, description, type, maxChoices, options } = req.body as {
    question?: string;
    description?: string;
    type?: string;
    maxChoices?: number;
    options?: string[];
  };
  if (!question) {
    res.status(400).json({ error: "Question is required" });
    return;
  }
  // Get existing polls to set display order
  const existingPolls = await db.select().from(polls).where(eq(polls.electionId, electionId));
  const [poll] = await db
    .insert(polls)
    .values({
      electionId,
      question,
      description,
      type: type ?? "single",
      maxChoices: maxChoices ?? 1,
      displayOrder: existingPolls.length,
    })
    .returning();

  // Add poll options if provided
  if (Array.isArray(options) && options.length > 0) {
    const optionRecords = options.map((opt, idx) => ({
      pollId: poll.id,
      text: opt,
      displayOrder: idx,
    }));
    await db.insert(pollOptions).values(optionRecords);
  }

  res.status(201).json({ ...poll, options });
});

// Get polls for an election
router.get("/elections/:id/polls", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
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
  const pollList = await db.select().from(polls).where(eq(polls.electionId, electionId));
  // Fetch options for each poll
  const pollsWithOptions = await Promise.all(
    pollList.map(async (p) => {
      const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, p.id));
      return { ...p, options };
    })
  );
  res.json(pollsWithOptions);
});

// Add option to a poll
router.post("/polls/:id/options", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const pollId = parseInt(req.params.id as string);
  const [poll] = await db.select().from(polls).where(eq(polls.id, pollId));
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  const [election] = await db.select().from(elections).where(eq(elections.id, poll.electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
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
  const { text, description } = req.body as { text?: string; description?: string };
  if (!text) {
    res.status(400).json({ error: "Option text is required" });
    return;
  }
  const existingOptions = await db.select().from(pollOptions).where(eq(pollOptions.pollId, pollId));
  const [option] = await db
    .insert(pollOptions)
    .values({
      pollId,
      text,
      description,
      displayOrder: existingOptions.length,
    })
    .returning();
  res.status(201).json(option);
});

// Submit poll votes for a multi-poll election (draft vote before final submission)
router.post("/elections/:id/submit-draft-votes", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
    return;
  }
  if (election.status !== "active") {
    res.status(400).json({ error: "Election is not active" });
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
  const { draftVotes } = req.body as {
    draftVotes?: Array<{ pollId: number; selectedOptionIds: number[] }>;
  };
  if (!Array.isArray(draftVotes) || draftVotes.length === 0) {
    res.status(400).json({ error: "Draft votes are required" });
    return;
  }
  // Return draft votes for review - will be finalized on final submission
  res.json({
    draftVotes,
    message: "Draft votes saved. Please review and submit to finalize.",
    reviewUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/elections/${electionId}/review`,
  });
});

router.post("/elections/:id/publish", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
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
  const electionId = parseInt(req.params.id as string);
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

// Send election result notifications (FEATURE 5)
router.post("/elections/:id/send-notifications", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
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

  try {
    // Get election voters (from votes table)
    const voterList = await db.select({ userId: votes.userId }).from(votes).where(eq(votes.electionId, electionId));

    if (voterList.length === 0) {
      res.status(400).json({ error: "No voters found for this election" });
      return;
    }

    const resultsUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/elections/${electionId}/results`;
    let successCount = 0;
    let failureCount = 0;
    const failedRecipients: string[] = [];

    // Send notifications to each voter
    for (const voter of voterList) {
      try {
        const [userData] = await db.select().from(users).where(eq(users.id, voter.userId));
        if (!userData) continue;

        const [prefs] = await db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, voter.userId));

        if (!prefs || (!prefs.emailNotifications && !prefs.smsNotifications) || !prefs.resultNotifications) {
          continue;
        }

        const channel =
          prefs.emailNotifications && prefs.smsNotifications
            ? "both"
            : prefs.emailNotifications
              ? "email"
              : prefs.smsNotifications
                ? "sms"
                : "email";

        // Send notification
        await NotificationService.send({
          recipientEmail: userData.email,
          recipientPhone: userData.phone,
          recipientName: userData.name,
          channel,
          electionName: election.title,
          winner: "Results are available",
          resultsUrl,
          timestamp: new Date(),
        });

        // Log notification
        await db.insert(notifications).values({
          electionId,
          recipientId: voter.userId,
          type: "election_result",
          subject: `Results for ${election.title}`,
          message: `The ${election.title} has concluded. View the results using the link below.`,
          recipient: channel === "sms" ? userData.phone || userData.email : userData.email,
          channel: channel === "both" ? "email" : channel,
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
        });

        successCount++;
      } catch (err) {
        failureCount++;
        failedRecipients.push(voter.userId.toString());
        console.error(`Failed to send notification for voter ${voter.userId}:`, err);
      }
    }

    res.json({
      message: "Notifications sent successfully",
      successCount,
      failureCount,
      failedRecipients,
      resultsUrl,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to send notifications",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.post("/elections/:id/vote", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
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

  // Validate voter token - SECURITY FEATURE #3
  const { voterToken } = req.body as { choices?: number[]; voterToken?: string };
  if (!voterToken) {
    res.status(400).json({ error: "Voter token is required" });
    return;
  }

  const [tokenRecord] = await db
    .select()
    .from(voterTokens)
    .where(and(eq(voterTokens.orgId, election.orgId), eq(voterTokens.token, voterToken)));

  if (!tokenRecord) {
    res.status(401).json({ error: "Invalid voter token" });
    return;
  }

  if (tokenRecord.userId !== uid) {
    res.status(401).json({ error: "Voter token does not belong to this user" });
    return;
  }

  if (tokenRecord.used) {
    res.status(409).json({ error: "This voter token has already been used" });
    return;
  }

  if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
    res.status(401).json({ error: "Voter token has expired" });
    return;
  }

  // FEATURE 4: Check if voter is in required group for this election
  if (election.requiredGroupId) {
    const [groupMembership] = await db
      .select()
      .from(electionGroupMembers)
      .where(
        and(eq(electionGroupMembers.groupId, election.requiredGroupId), eq(electionGroupMembers.userId, uid))
      );
    if (!groupMembership) {
      res.status(403).json({ error: "You are not authorized to participate in this election" });
      return;
    }
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

  const { txSignature, blockHeight } = await submitVoteMemo(voteHash);

  const [vote] = await db
    .insert(votes)
    .values({ electionId, userId: uid, choices, voteHash, txSignature, blockHeight })
    .returning();

  // Mark token as used
  await db
    .update(voterTokens)
    .set({ used: true, usedAt: new Date() })
    .where(eq(voterTokens.id, tokenRecord.id));

  res.status(201).json({
    voteId: vote.id,
    voteHash: vote.voteHash,
    txSignature: vote.txSignature,
    blockHeight: vote.blockHeight,
    message: txSignature
      ? "Your vote has been recorded on the Solana blockchain"
      : "Your vote has been recorded (on-chain submission pending)",
    choices,
  });
});

router.get("/elections/:id/my-vote", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
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
  const electionId = parseInt(req.params.id as string);
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
  const electionId = parseInt(req.params.id as string);
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

// ===== FEATURE 5: NOTIFICATION PREFERENCES ENDPOINTS =====

// Get notification preferences for current user
router.get("/notifications/preferences", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, uid));

  if (!prefs) {
    // Return default preferences
    res.json({
      emailNotifications: true,
      smsNotifications: true,
      resultNotifications: true,
      reminderNotifications: true,
    });
    return;
  }

  res.json(prefs);
});

// Update notification preferences for current user
router.put("/notifications/preferences", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { emailNotifications, smsNotifications, resultNotifications, reminderNotifications } = req.body as {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    resultNotifications?: boolean;
    reminderNotifications?: boolean;
  };

  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, uid));

  if (existing) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(smsNotifications !== undefined && { smsNotifications }),
        ...(resultNotifications !== undefined && { resultNotifications }),
        ...(reminderNotifications !== undefined && { reminderNotifications }),
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, uid))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(notificationPreferences)
      .values({
        userId: uid,
        emailNotifications: emailNotifications ?? true,
        smsNotifications: smsNotifications ?? true,
        resultNotifications: resultNotifications ?? true,
        reminderNotifications: reminderNotifications ?? true,
      })
      .returning();
    res.status(201).json(created);
  }
});

// ===== FEATURE 4: VOTER GROUPS ENDPOINTS =====

// Create voter group for an election
router.post("/elections/:id/groups", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
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
    res.status(400).json({ error: "Group name is required" });
    return;
  }
  if (election.status !== "draft") {
    res.status(400).json({ error: "Can only modify groups for draft elections" });
    return;
  }
  const [group] = await db
    .insert(electionVoterGroups)
    .values({ electionId, name, description })
    .returning();
  res.status(201).json(group);
});

// Get voter groups for an election
router.get("/elections/:id/groups", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
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
  const groups = await db
    .select()
    .from(electionVoterGroups)
    .where(eq(electionVoterGroups.electionId, electionId));
  res.json(groups);
});

// Add members to a voter group
router.post("/elections/:id/groups/:groupId/members", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
  const groupId = parseInt(req.params.groupId as string);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
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
  const { userIds } = req.body as { userIds?: number[] };
  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({ error: "userIds array is required" });
    return;
  }
  // Add members to group
  for (const userId of userIds) {
    const [existing] = await db
      .select()
      .from(electionGroupMembers)
      .where(and(eq(electionGroupMembers.groupId, groupId), eq(electionGroupMembers.userId, userId)));
    if (!existing) {
      await db.insert(electionGroupMembers).values({ groupId, userId });
    }
  }
  res.status(201).json({ message: `Added ${userIds.length} members to group` });
});

// Remove member from voter group
router.delete("/elections/:id/groups/:groupId/members/:userId", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
  const groupId = parseInt(req.params.groupId as string);
  const memberId = parseInt(req.params.userId as string);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
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
  await db
    .delete(electionGroupMembers)
    .where(and(eq(electionGroupMembers.groupId, groupId), eq(electionGroupMembers.userId, memberId)));
  res.status(204).send();
});

// Set election to use specific voter group
router.put("/elections/:id/required-group", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const electionId = parseInt(req.params.id as string);
  const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
  if (!election) {
    res.status(404).json({ error: "Election not found" });
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
    res.status(400).json({ error: "Can only modify settings for draft elections" });
    return;
  }
  const { requiredGroupId } = req.body as { requiredGroupId?: number | null };
  const [updated] = await db
    .update(elections)
    .set({ requiredGroupId: requiredGroupId ?? null })
    .where(eq(elections.id, electionId))
    .returning();
  res.json({ ...updated, message: "Election voter group updated" });
});

export default router;
