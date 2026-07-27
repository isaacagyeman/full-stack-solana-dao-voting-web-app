import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/seed";
import { initSolana } from "./lib/solana";
import dotenv from "dotenv";
import path from "path";

dotenv.config({path: path.resolve(__dirname, "../.env")});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  seedIfEmpty().catch((e) => logger.error({ err: e }, "Seed failed"));
  initSolana().catch((e) => logger.error({ err: e }, "Solana init failed"));
});
