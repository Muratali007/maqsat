import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Render health check + keepalive target. Also verifies the database answers. */
export async function GET() {
  try {
    await q("select 1");
    return new Response("ok", { headers: { "cache-control": "no-store" } });
  } catch {
    return new Response("db error", { status: 503 });
  }
}
