import { Router, type IRouter } from "express";
import { eq, sql, countDistinct } from "drizzle-orm";
import { db, daosTable, proposalsTable, votesTable, activityTable } from "@workspace/db";
import {
  GetDaoStatsParams,
  GetDaoStatsResponse,
  GetRecentActivityResponse,
  GetStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [daoCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(daosTable);

  const [proposalCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposalsTable);

  const [activeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .where(eq(proposalsTable.status, "active"));

  const [voteCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(votesTable);

  const [voterCount] = await db
    .select({ count: sql<number>`count(distinct ${votesTable.voterAddress})::int` })
    .from(votesTable);

  res.json(
    GetStatsResponse.parse({
      totalDaos: daoCount?.count ?? 0,
      totalProposals: proposalCount?.count ?? 0,
      totalVotes: voteCount?.count ?? 0,
      activeProposals: activeCount?.count ?? 0,
      totalVoters: voterCount?.count ?? 0,
    })
  );
});

router.get("/daos/:id/stats", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDaoStatsParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const daoId = params.data.id;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .where(eq(proposalsTable.daoId, daoId));

  const [activeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .where(
      sql`${proposalsTable.daoId} = ${daoId} and ${proposalsTable.status} = 'active'`
    );

  const [succeededRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .where(
      sql`${proposalsTable.daoId} = ${daoId} and ${proposalsTable.status} = 'succeeded'`
    );

  const [defeatedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .where(
      sql`${proposalsTable.daoId} = ${daoId} and ${proposalsTable.status} = 'defeated'`
    );

  const [voteRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(votesTable)
    .innerJoin(proposalsTable, eq(votesTable.proposalId, proposalsTable.id))
    .where(eq(proposalsTable.daoId, daoId));

  const [voterRow] = await db
    .select({ count: sql<number>`count(distinct ${votesTable.voterAddress})::int` })
    .from(votesTable)
    .innerJoin(proposalsTable, eq(votesTable.proposalId, proposalsTable.id))
    .where(eq(proposalsTable.daoId, daoId));

  const total = totalRow?.count ?? 0;
  const votes = voteRow?.count ?? 0;
  const voters = voterRow?.count ?? 0;

  res.json(
    GetDaoStatsResponse.parse({
      totalProposals: total,
      activeProposals: activeRow?.count ?? 0,
      succeededProposals: succeededRow?.count ?? 0,
      defeatedProposals: defeatedRow?.count ?? 0,
      totalVotes: votes,
      uniqueVoters: voters,
      participationRate: total > 0 ? voters / total : 0,
    })
  );
});

router.get("/activity", async (_req, res): Promise<void> => {
  const activities = await db
    .select()
    .from(activityTable)
    .orderBy(sql`${activityTable.createdAt} desc`)
    .limit(50);

  const result = activities.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }));

  res.json(GetRecentActivityResponse.parse(result));
});

export default router;
