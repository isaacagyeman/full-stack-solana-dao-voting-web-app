import { defineConfig } from "drizzle-kit";
import path from "path";
import dotenv from "dotenv";

dotenv.config({path: path.resolve(__dirname, "../../.env")});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: ["./src/schema/index.ts"],//path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
