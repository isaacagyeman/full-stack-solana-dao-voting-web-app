import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, votesTable, proposalsTable, activityTable } from "@workspace/db";
import {
  CastVoteBody,
  CastVoteParams,
  GetMyVoteParams,
  GetMyVoteResponse,
  ListVotesForProposalParams,
  ListVotesForProposalResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/proposals/:id/vote", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CastVoteParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CastVoteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [proposal] = await db
    .select()
    .from(proposalsTable)
    .where(eq(proposalsTable.id, params.data.id));

  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  if (proposal.status !== "active") {
    res.status(400).json({ error: "Proposal is not active" });
    return;
  }

  const [existingVote] = await db
    .select()
    .from(votesTable)
    .where(
      and(
        eq(votesTable.proposalId, params.data.id),
        eq(votesTable.voterAddress, body.data.voterAddress)
      )
    );

  if (existingVote) {
    res.status(400).json({ error: "Already voted on this proposal" });
    return;
  }

  const [vote] = await db
    .insert(votesTable)
    .values({
      proposalId: params.data.id,
      voterAddress: body.data.voterAddress,
      voteType: body.data.voteType,
      votingPower: body.data.votingPower,
      txSignature: body.data.txSignature ?? null,
    })
    .returning();

  const voteField =
    body.data.voteType === "for"
      ? { votesFor: sql`${proposalsTable.votesFor} + ${body.data.votingPower}` }
      : body.data.voteType === "against"
        ? { votesAgainst: sql`${proposalsTable.votesAgainst} + ${body.data.votingPower}` }
        : { votesAbstain: sql`${proposalsTable.votesAbstain} + ${body.data.votingPower}` };

  await db
    .update(proposalsTable)
    .set(voteField)
    .where(eq(proposalsTable.id, params.data.id));

  await db.insert(activityTable).values({
    type: "vote_cast",
    description: `Voted ${body.data.voteType} on "${proposal.title}"`,
    walletAddress: body.data.voterAddress,
    proposalId: params.data.id,
    daoId: proposal.daoId,
  });

  res.status(201).json({
    id: vote.id,
    proposalId: vote.proposalId,
    voterAddress: vote.voterAddress,
    voteType: vote.voteType,
    votingPower: vote.votingPower,
    txSignature: vote.txSignature,
    createdAt: vote.createdAt.toISOString(),
  });
});

router.get("/proposals/:id/votes", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListVotesForProposalParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const votes = await db
    .select()
    .from(votesTable)
    .where(eq(votesTable.proposalId, params.data.id))
    .orderBy(sql`${votesTable.createdAt} desc`);

  const result = votes.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
  }));

  res.json(ListVotesForProposalResponse.parse(result));
});

router.get("/proposals/:id/my-vote/:walletAddress", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawWallet = Array.isArray(req.params.walletAddress)
    ? req.params.walletAddress[0]
    : req.params.walletAddress;

  const params = GetMyVoteParams.safeParse({
    id: parseInt(rawId, 10),
    walletAddress: rawWallet,
  });

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [vote] = await db
    .select()
    .from(votesTable)
    .where(
      and(
        eq(votesTable.proposalId, params.data.id),
        eq(votesTable.voterAddress, params.data.walletAddress)
      )
    );

  res.json(
    GetMyVoteResponse.parse({
      vote: vote
        ? {
            ...vote,
            createdAt: vote.createdAt.toISOString(),
          }
        : null,
    })
  );
});

export default router;
