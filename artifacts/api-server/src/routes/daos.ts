import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, daosTable, proposalsTable, votesTable } from "@workspace/db";
import {
  CreateDaoBody,
  GetDaoParams,
  GetDaoResponse,
  ListDaosResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/daos", async (_req, res): Promise<void> => {
  const daos = await db.select().from(daosTable).orderBy(daosTable.createdAt);

  const proposalCounts = await db
    .select({ daoId: proposalsTable.daoId, count: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .groupBy(proposalsTable.daoId);

  const countMap: Record<number, number> = {};
  for (const row of proposalCounts) {
    countMap[row.daoId] = row.count;
  }

  const result = daos.map((dao) => ({
    ...dao,
    governanceToken: dao.governanceToken,
    treasuryAddress: dao.treasuryAddress,
    creatorAddress: dao.creatorAddress,
    totalProposals: countMap[dao.id] ?? 0,
    createdAt: dao.createdAt.toISOString(),
  }));

  res.json(ListDaosResponse.parse(result));
});

router.post("/daos", async (req, res): Promise<void> => {
  const parsed = CreateDaoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dao] = await db.insert(daosTable).values(parsed.data).returning();

  res.status(201).json(
    GetDaoResponse.parse({
      ...dao,
      totalProposals: 0,
      createdAt: dao.createdAt.toISOString(),
    })
  );
});

router.get("/daos/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDaoParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dao] = await db
    .select()
    .from(daosTable)
    .where(eq(daosTable.id, params.data.id));

  if (!dao) {
    res.status(404).json({ error: "DAO not found" });
    return;
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .where(eq(proposalsTable.daoId, params.data.id));

  res.json(
    GetDaoResponse.parse({
      ...dao,
      totalProposals: countRow?.count ?? 0,
      createdAt: dao.createdAt.toISOString(),
    })
  );
});

export default router;
