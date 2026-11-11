"use server";

import { z } from "zod";
import { ok } from "@/shared/domain/result";
import { defineAction } from "@/shared/lib/action";
import { listNotifications, markRead, unreadCount } from "../infrastructure/notification-queries";

/** Últimas notificaciones para la campana. */
export const latestNotificationsAction = defineAction(z.object({}), async (_i, { c, viewer }) => {
  const [list, unread] = await Promise.all([
    listNotifications(c.db, viewer.id, { limit: 8 }),
    unreadCount(c.db, viewer.id),
  ]);
  return ok({ items: list.items, unread });
});

export const markReadAction = defineAction(
  z.object({ ids: z.array(z.uuid()).max(100).nullable() }),
  async ({ ids }, { c, viewer }) => {
    await markRead(c.db, viewer.id, ids, c.clock.now());
    return ok({ unread: await unreadCount(c.db, viewer.id) });
  },
);
