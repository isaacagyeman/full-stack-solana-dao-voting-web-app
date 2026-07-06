import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { db, users, organizations, orgMembers, elections, candidates, votes } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedIfEmpty() {
  const [existing] = await db.select().from(users).where(eq(users.email, "admin@demo.com"));
  if (existing) return;

  logger.info("Seeding demo data...");

  const adminHash = await bcrypt.hash("demo1234", 12);
  const voterHash = await bcrypt.hash("demo1234", 12);

  const [admin] = await db
    .insert(users)
    .values({ email: "admin@demo.com", passwordHash: adminHash, name: "Alex Johnson", emailVerified: true, verificationLevel: 2 })
    .returning();
  const [voter] = await db
    .insert(users)
    .values({ email: "voter@demo.com", passwordHash: voterHash, name: "Sam Williams", emailVerified: true, verificationLevel: 1 })
    .returning();

  const [org] = await db
    .insert(organizations)
    .values({
      name: "Springfield School District",
      slug: "springfield-school",
      accessCode: "SPRING01",
      description: "Official governance portal for Springfield School District elections and referendums.",
      isPublic: true,
      ownerId: admin.id,
    })
    .returning();

  await db.insert(orgMembers).values([
    { orgId: org.id, userId: admin.id, role: "admin" },
    { orgId: org.id, userId: voter.id, role: "voter" },
  ]);

  const now = new Date();
  const startActive = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const endActive = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [electionActive] = await db
    .insert(elections)
    .values({
      orgId: org.id,
      title: "Student Council President 2024–25",
      description: "Vote for your Student Council President for the upcoming academic year. This position leads student government and represents all students in district-wide decisions.",
      type: "single",
      status: "active",
      startTime: startActive,
      endTime: endActive,
      createdBy: admin.id,
      isPublic: false,
      maxChoices: 1,
      quorum: 0,
    })
    .returning();

  const activeCandidates = await db
    .insert(candidates)
    .values([
      { electionId: electionActive.id, name: "Emma Thompson", description: "Junior class representative, 3.9 GPA, founder of the school recycling initiative.", displayOrder: 0 },
      { electionId: electionActive.id, name: "Jake Rodriguez", description: "Varsity soccer captain, passionate about improving school lunch options and mental health resources.", displayOrder: 1 },
      { electionId: electionActive.id, name: "Priya Patel", description: "Debate team president, advocates for expanded STEM programs and after-school tutoring.", displayOrder: 2 },
    ])
    .returning();

  const activeHash = createHash("sha256")
    .update(JSON.stringify({ id: electionActive.id, title: electionActive.title, candidates: activeCandidates }))
    .digest("hex");
  await db.update(elections).set({ electionHash: activeHash }).where(eq(elections.id, electionActive.id));

  const startClosed = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const endClosed = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [electionClosed] = await db
    .insert(elections)
    .values({
      orgId: org.id,
      title: "2024–25 Technology Budget Referendum",
      description: "Vote on the proposed technology budget allocation for the upcoming school year. Funds will be used for classroom devices, software licenses, and infrastructure upgrades.",
      type: "single",
      status: "closed",
      startTime: startClosed,
      endTime: endClosed,
      createdBy: admin.id,
      isPublic: false,
      maxChoices: 1,
      quorum: 0,
    })
    .returning();

  const closedCandidates = await db
    .insert(candidates)
    .values([
      { electionId: electionClosed.id, name: "Approve Proposed Budget ($2.4M)", description: "Full allocation for new devices, software, and network upgrades across all campuses.", displayOrder: 0 },
      { electionId: electionClosed.id, name: "Approve Reduced Budget ($1.8M)", description: "Prioritize essential software renewals and partial device refresh for grades 9–10.", displayOrder: 1 },
      { electionId: electionClosed.id, name: "Maintain Current Budget ($2.0M)", description: "Keep existing budget with minor adjustments, deferring major upgrades to next cycle.", displayOrder: 2 },
    ])
    .returning();

  const closedHash = createHash("sha256")
    .update(JSON.stringify({ id: electionClosed.id, title: electionClosed.title, candidates: closedCandidates }))
    .digest("hex");
  await db.update(elections).set({ electionHash: closedHash }).where(eq(elections.id, electionClosed.id));

  const genHash = (uid: number, eid: number, choices: number[]) =>
    createHash("sha256").update(`${uid}:${eid}:${JSON.stringify(choices)}:seed`).digest("hex");
  const genSig = () => {
    const alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    return Array.from({ length: 88 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join("");
  };

  await db.insert(votes).values([
    {
      electionId: electionClosed.id,
      userId: admin.id,
      choices: [closedCandidates[0].id],
      voteHash: genHash(admin.id, electionClosed.id, [closedCandidates[0].id]),
      txSignature: genSig(),
      blockHeight: 280_432_100,
    },
    {
      electionId: electionClosed.id,
      userId: voter.id,
      choices: [closedCandidates[0].id],
      voteHash: genHash(voter.id, electionClosed.id, [closedCandidates[0].id]),
      txSignature: genSig(),
      blockHeight: 280_432_215,
    },
  ]);

  logger.info("Demo seed complete");
}
