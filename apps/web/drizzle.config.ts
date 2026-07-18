import "dotenv/config";
import { type Config } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default {
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  schemaFilter: ["public", "auth", "core", "content", "simulator", "audit"],
} satisfies Config;
