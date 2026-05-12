import { Router, type IRouter } from "express";
import healthRouter from "./health";
import daosRouter from "./daos";
import proposalsRouter from "./proposals";
import votesRouter from "./votes";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(daosRouter);
router.use(proposalsRouter);
router.use(votesRouter);
router.use(statsRouter);

export default router;
