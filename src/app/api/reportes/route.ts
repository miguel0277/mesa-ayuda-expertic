import { connection, NextResponse, type NextRequest } from "next/server";
import {
  ticketsSheet,
  tasksSheet,
  toCsv,
  toXlsx,
  type Sheet,
} from "@/modules/reports/infrastructure/exports";
import { can } from "@/shared/auth/permissions";
import { getViewer } from "@/shared/auth/viewer";
import { getSetting } from "@/shared/config/settings-service";
import { appEvent } from "@/shared/kernel/app-event";
import { getContainer } from "@/shared/kernel/container";
import { unitOfWork } from "@/shared/kernel/use-case";
import { getRequestContext } from "@/shared/lib/request-context";

/**
 * GET /api/reportes?tipo=tickets|tareas|todo&desde=AAAA-MM-DD&hasta=AAAA-MM-DD&formato=csv|xlsx
 * Requiere reports.export. Cada exportación queda en la auditoría.
 */
export async function GET(request: NextRequest) {
  await connection();
  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Inicia sesión.", { status: 401 });
  if (!can(viewer, "reports.export"))
    return new NextResponse("No tienes permiso para exportar.", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const tipo = sp.get("tipo") ?? "tickets";
  const formato = sp.get("formato") === "csv" ? "csv" : "xlsx";
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const desde = sp.get("desde") ?? "";
  const hasta = sp.get("hasta") ?? "";
  if (!day.test(desde) || !day.test(hasta) || desde > hasta)
    return new NextResponse("Rango de fechas inválido.", { status: 400 });
  if (!["tickets", "tareas", "todo"].includes(tipo))
    return new NextResponse("Tipo inválido.", { status: 400 });
  if (formato === "csv" && tipo === "todo")
    return new NextResponse("El CSV exporta un tipo a la vez.", { status: 400 });

  // Fechas locales de Bogotá (UTC-5) → instantes.
  const from = new Date(`${desde}T00:00:00-05:00`);
  const to = new Date(`${hasta}T23:59:59.999-05:00`);
  const c = getContainer();
  const now = new Date();
  const riskHours = await getSetting(c.db, "tasks.riskThresholdHours");
  const sheets: Sheet[] = [];
  if (tipo !== "tareas") sheets.push(await ticketsSheet(c.db, from, to, now));
  if (tipo !== "tickets") sheets.push(await tasksSheet(c.db, from, to, now, riskHours));

  const meta = await getRequestContext();
  await unitOfWork(c, async (_tx, emit) =>
    emit(
      appEvent(
        "report.exported",
        { actor: viewer, meta, now },
        { type: "setting", id: "reportes" },
        {
          after: {
            tipo,
            formato,
            desde,
            hasta,
            filas: sheets.reduce((n, s) => n + s.rows.length, 0),
          },
        },
      ),
    ),
  );

  const name = `mesa-ayuda-${tipo}-${desde}_a_${hasta}`;
  if (formato === "csv") {
    return new NextResponse(toCsv(sheets[0]!), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const bytes = await toXlsx(sheets);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
