import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default {
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations need session-mode connection (DIRECT_URL); falls back to DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
} satisfies Config;
