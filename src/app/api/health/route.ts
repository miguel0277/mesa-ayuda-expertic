import { connection, NextResponse } from "next/server";
import { checkDatabase } from "@/shared/db/health";
import { getDb } from "@/shared/db/client";
import { getRequestContext } from "@/shared/lib/request-context";
import { withRequest } from "@/shared/lib/logger";
import { APP_VERSION } from "@/shared/lib/version";

/** GET /api/health — estado de la app y de la conexión a la BD (`select 1`). */
export async function GET() {
  await connection();
  const { requestId } = await getRequestContext();
  const db = await checkDatabase(getDb());

  if (!db.ok) withRequest(requestId).error({ db }, "healthcheck: base de datos no disponible");

  return NextResponse.json(
    {
      status: db.ok ? "ok" : "degradado",
      version: APP_VERSION,
      time: new Date().toISOString(),
      database: db,
      requestId,
    },
    { status: db.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
