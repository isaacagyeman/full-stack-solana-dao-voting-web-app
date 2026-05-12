import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, proposalsTable, daosTable } from "@workspace/db";
import {
  CreateProposalBody,
  GetProposalParams,
  GetProposalResponse,
  ListProposalsQueryParams,
  ListProposalsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/proposals", async (req, res): Promise<void> => {
  const query = ListProposalsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { daoId, status } = query.data;

  const conditions = [];
  if (daoId != null) conditions.push(eq(proposalsTable.daoId, daoId));
  if (status != null) conditions.push(eq(proposalsTable.status, status));

  const proposals = await db
    .select({
      id: proposalsTable.id,
      daoId: proposalsTable.daoId,
      title: proposalsTable.title,
      description: proposalsTable.description,
      creatorAddress: proposalsTable.creatorAddress,
      status: proposalsTable.status,
      votesFor: proposalsTable.votesFor,
      votesAgainst: proposalsTable.votesAgainst,
      votesAbstain: proposalsTable.votesAbstain,
      quorumRequired: proposalsTable.quorumRequired,
      txSignature: proposalsTable.txSignature,
      startTime: proposalsTable.startTime,
      endTime: proposalsTable.endTime,
      createdAt: proposalsTable.createdAt,
      daoName: daosTable.name,
    })
    .from(proposalsTable)
    .leftJoin(daosTable, eq(proposalsTable.daoId, daosTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${proposalsTable.createdAt} desc`);

  const result = proposals.map((p) => ({
    ...p,
    startTime: p.startTime.toISOString(),
    endTime: p.endTime.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  res.json(ListProposalsResponse.parse(result));
});

router.post("/proposals", async (req, res): Promise<void> => {
  const parsed = CreateProposalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [proposal] = await db
    .insert(proposalsTable)
    .values({
      ...parsed.data,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
    })
    .returning();

  const [dao] = await db
    .select({ name: daosTable.name })
    .from(daosTable)
    .where(eq(daosTable.id, proposal.daoId));

  res.status(201).json(
    GetProposalResponse.parse({
      ...proposal,
      daoName: dao?.name ?? null,
      startTime: proposal.startTime.toISOString(),
      endTime: proposal.endTime.toISOString(),
      createdAt: proposal.createdAt.toISOString(),
    })
  );
});

router.get("/proposals/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProposalParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [proposal] = await db
    .select({
      id: proposalsTable.id,
      daoId: proposalsTable.daoId,
      title: proposalsTable.title,
      description: proposalsTable.description,
      creatorAddress: proposalsTable.creatorAddress,
      status: proposalsTable.status,
      votesFor: proposalsTable.votesFor,
      votesAgainst: proposalsTable.votesAgainst,
      votesAbstain: proposalsTable.votesAbstain,
      quorumRequired: proposalsTable.quorumRequired,
      txSignature: proposalsTable.txSignature,
      startTime: proposalsTable.startTime,
      endTime: proposalsTable.endTime,
      createdAt: proposalsTable.createdAt,
      daoName: daosTable.name,
    })
    .from(proposalsTable)
    .leftJoin(daosTable, eq(proposalsTable.daoId, daosTable.id))
    .where(eq(proposalsTable.id, params.data.id));

  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  res.json(
    GetProposalResponse.parse({
      ...proposal,
      startTime: proposal.startTime.toISOString(),
      endTime: proposal.endTime.toISOString(),
      createdAt: proposal.createdAt.toISOString(),
    })
  );
});

export default router;
