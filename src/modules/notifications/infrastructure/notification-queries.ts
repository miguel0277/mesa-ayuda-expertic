import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { notifications } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function unreadCount(db: DbExecutor, userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function listNotifications(
  db: DbExecutor,
  userId: string,
  opts: { cursor?: string | null; limit?: number; unreadOnly?: boolean } = {},
) {
  const limit = Math.min(opts.limit ?? 20, 50);
  let cursorCond;
  if (opts.cursor) {
    const [iso, id] = Buffer.from(opts.cursor, "base64url").toString().split("|");
    if (iso && id)
      cursorCond = or(
        lt(notifications.createdAt, new Date(iso)),
        and(eq(notifications.createdAt, new Date(iso)), lt(notifications.id, id)),
      );
  }
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        opts.unreadOnly ? isNull(notifications.readAt) : undefined,
        cursorCond,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })) satisfies NotificationDTO[],
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString("base64url")
        : null,
  };
}

/** Marca como leídas (solo las del propio usuario). Sin ids: todas. */
export async function markRead(db: DbExecutor, userId: string, ids: string[] | null, now: Date) {
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        ids ? inArray(notifications.id, ids) : undefined,
      ),
    );
}
