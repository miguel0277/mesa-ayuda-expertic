import { and, eq, isNull } from "drizzle-orm";
import { NextResponse, connection, type NextRequest } from "next/server";
import { canReadTask, canReadTicket, can } from "@/shared/auth/permissions";
import { getViewer } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { attachments, taskEvidence, tasks, ticketMessages, tickets } from "@/shared/db/schema";
import { getStorage } from "@/shared/storage";

/**
 * Descarga autorizada de adjuntos (sección 9): nunca hay URLs públicas.
 * Verifica que quien pide el archivo pueda ver el ticket o la tarea dueña.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/archivos/[id]">) {
  await connection();
  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Inicia sesión para ver este archivo.", { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const db = getDb();
  const [file] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
    .limit(1);
  if (!file) return new NextResponse("No encontrado", { status: 404 });

  let allowed = false;
  if (file.ownerType === "ticket" || file.ownerType === "message") {
    let ticketId = file.ownerId;
    let internal = false;
    if (file.ownerType === "message") {
      const [m] = await db
        .select({ ticketId: ticketMessages.ticketId, internal: ticketMessages.isInternal })
        .from(ticketMessages)
        .where(eq(ticketMessages.id, file.ownerId))
        .limit(1);
      ticketId = m?.ticketId ?? "";
      internal = !!m?.internal;
    }
    const [t] = await db
      .select({
        requesterId: tickets.requesterId,
        assigneeId: tickets.assigneeId,
        teamId: tickets.teamId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    allowed =
      !!t && canReadTicket(viewer, t) && (!internal || can(viewer, "ticket.internal_note", t));
  } else {
    let taskId = file.ownerId;
    if (file.ownerType === "evidence") {
      const [e] = await db
        .select({ taskId: taskEvidence.taskId })
        .from(taskEvidence)
        .where(eq(taskEvidence.id, file.ownerId))
        .limit(1);
      taskId = e?.taskId ?? "";
    }
    const [t] = await db
      .select({
        assigneeId: tasks.assigneeId,
        teamId: tasks.teamId,
        assignedById: tasks.assignedBy,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    allowed = !!t && (canReadTask(viewer, t) || t.assignedById === viewer.id);
  }
  // 404 (no 403) para no revelar que el archivo existe.
  if (!allowed) return new NextResponse("No encontrado", { status: 404 });

  const stored = await getStorage().get(file.storageKey);
  if (!stored) return new NextResponse("El archivo ya no está disponible.", { status: 410 });

  const inline =
    /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/.test(file.mime) &&
    request.nextUrl.searchParams.get("descargar") !== "1";
  return new NextResponse(stored.stream, {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
