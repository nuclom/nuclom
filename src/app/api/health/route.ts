import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function GET() {
  const checks = { database: false };

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch {
    // Database check failed
  }

  const healthy = Object.values(checks).every(Boolean);

  return Response.json({ status: healthy ? "healthy" : "unhealthy", checks }, { status: healthy ? 200 : 503 });
}
