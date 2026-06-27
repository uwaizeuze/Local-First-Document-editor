import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgres://8e7b4f09f883a2aafcc2111327498a1bd8837bd43b3df9723acf1cd658dcfb02:sk_WHQYneyI7myA3gkEfe7Dy@db.prisma.io:5432/postgres?sslmode=require",
  },
});
