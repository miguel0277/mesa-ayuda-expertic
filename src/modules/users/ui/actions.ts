"use server";

import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { DASHBOARD_TAG } from "@/modules/reports/infrastructure/dashboard";
import { getEnv } from "@/env";
import { auth } from "@/shared/auth/auth";
import { can } from "@/shared/auth/permissions";
import { ROLES } from "@/shared/auth/roles";
import { user } from "@/shared/db/schema";
import { DomainError, forbidden, validationError } from "@/shared/domain/errors";
import { err, ok, type Result } from "@/shared/domain/result";
import { appEvent } from "@/shared/kernel/app-event";
import { unitOfWork } from "@/shared/kernel/use-case";
import { defineAction } from "@/shared/lib/action";
import { checkFile, storageKey } from "@/shared/storage/file-policy";
import { readFormFiles } from "@/shared/storage/uploads";
import { eq } from "drizzle-orm";
import {
  addTeamMember,
  approveUser,
  bulkDeactivate,
  createTeam,
  createTeamInput,
  memberInput,
  rejectUser,
  removeTeamMember,
  setMyAvatar,
  setRoleInput,
  setStatusInput,
  setTeamActive,
  setUserRole,
  setUserStatus,
  updateMyProfile,
  updateProfileInput,
} from "../application/user-commands";
import { promotableUsers } from "../infrastructure/user-queries";

const refresh = () => {
  updateTag(DASHBOARD_TAG);
  revalidatePath("/admin/usuarios");
  revalidatePath("/panel/auxiliares");
  revalidatePath("/admin/equipos");
};

const idInput = z.object({ userId: z.uuid() });

export const approveUserAction = defineAction(idInput, async (i, { c, uc }) => {
  const r = await approveUser(c, uc, i, getEnv().NEXT_PUBLIC_APP_URL);
  if (r.ok) refresh();
  return r;
});

export const rejectUserAction = defineAction(idInput, async (i, { c, uc }) => {
  const r = await rejectUser(c, uc, i);
  if (r.ok) refresh();
  return r;
});

export const setRoleAction = defineAction(setRoleInput, async (i, { c, uc }) => {
  const r = await setUserRole(c, uc, i);
  if (r.ok) refresh();
  return r;
});

export const setStatusAction = defineAction(setStatusInput, async (i, { c, uc }) => {
  const r = await setUserStatus(c, uc, i);
  if (r.ok) refresh();
  return r;
});

export const bulkDeactivateAction = defineAction(
  z.object({ userIds: z.array(z.uuid()).min(1).max(200) }),
  async (i, { c, uc }) => {
    const r = await bulkDeactivate(c, uc, i);
    if (r.ok) refresh();
    return r;
  },
);

export const createTeamAction = defineAction(createTeamInput, async (i, { c, uc }) => {
  const r = await createTeam(c, uc, i);
  if (r.ok) refresh();
  return r;
});

export const addMemberAction = defineAction(memberInput, async (i, { c, uc }) => {
  const r = await addTeamMember(c, uc, i);
  if (r.ok) refresh();
  return r;
});

export const removeMemberAction = defineAction(memberInput, async (i, { c, uc }) => {
  const r = await removeTeamMember(c, uc, i);
  if (r.ok) refresh();
  return r;
});

export const setTeamActiveAction = defineAction(
  z.object({ teamId: z.uuid(), active: z.boolean() }),
  async (i, { c, uc }) => {
    const r = await setTeamActive(c, uc, i);
    if (r.ok) refresh();
    return r;
  },
);

export const searchPromotableAction = defineAction(
  z.object({ q: z.string().max(80) }),
  async ({ q }, { c, viewer }) => {
    if (!can(viewer, "users.manage")) return err(forbidden());
    return ok(await promotableUsers(c.db, q));
  },
);

/** Admin: crear una cuenta (HU-50). Queda activa y recibe un enlace para elegir su contraseña. */
export const createUserAction = defineAction(
  z.object({
    name: z.string().trim().min(3, "Escribe el nombre completo.").max(120),
    email: z.email("Escribe un correo válido."),
    role: z.enum(ROLES),
    codigoUis: z.string().trim().max(20).optional(),
    programa: z.string().trim().max(120).optional(),
  }),
  async (i, { c, uc, viewer }) => {
    if (!can(viewer, "roles.grant.admin"))
      return err(forbidden("Solo el administrador crea cuentas."));
    const email = i.email.toLowerCase();
    const [exists] = await c.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (exists)
      return err(
        validationError("Ya existe una cuenta con ese correo.", {
          email: ["Ese correo ya está registrado."],
        }),
      );
    const tempPassword = `${crypto.randomUUID()}Aa1!`;
    const h = await headers();
    const created = await auth.api.createUser({
      headers: h,
      body: { email, password: tempPassword, name: i.name, role: i.role as "admin" },
    });
    await unitOfWork(c, async (tx, emit) => {
      await tx
        .update(user)
        .set({
          role: i.role,
          status: "activo",
          emailVerified: true,
          codigoUis: i.codigoUis || null,
          programa: i.programa || null,
          approvedAt: uc.now,
          approvedBy: viewer.id,
        })
        .where(eq(user.id, created.user.id));
      emit(
        appEvent(
          "user.created",
          uc,
          { type: "user", id: created.user.id },
          { after: { email, role: i.role } },
        ),
      );
    });
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/restablecer" } });
    refresh();
    return ok({ id: created.user.id });
  },
);

/** Admin: restablecer acceso (envía enlace para elegir contraseña nueva). */
export const resetAccessAction = defineAction(idInput, async ({ userId }, { c, uc, viewer }) => {
  if (!can(viewer, "roles.grant.admin")) return err(forbidden());
  const [u] = await c.db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!u) return err(new DomainError("NOT_FOUND", "No encontramos esa cuenta."));
  await auth.api.requestPasswordReset({ body: { email: u.email, redirectTo: "/restablecer" } });
  await unitOfWork(c, async (_tx, emit) =>
    emit(
      appEvent("user.access_reset", uc, { type: "user", id: userId }, { after: { sent: true } }),
    ),
  );
  return ok(true);
});

// ─────────────────────────────── Perfil propio ───────────────────────────────

export const updateProfileAction = defineAction(updateProfileInput, async (i, { c, uc }) => {
  const r = await updateMyProfile(c, uc, i);
  if (r.ok) revalidatePath("/perfil");
  return r;
});

/** Foto de perfil: imagen ≤ 2 MB, se guarda en el StorageProvider y se sirve por /api/avatar/[id]. */
export const uploadAvatarAction = defineAction(
  z.instanceof(FormData),
  async (form, { c, uc, viewer }): Promise<Result<{ image: string | null }, DomainError>> => {
    const [file] = await readFormFiles(form, "foto");
    if (!file) {
      const r = await setMyAvatar(c, uc, { image: null });
      if (r.ok) revalidatePath("/perfil");
      return r.ok ? ok({ image: null }) : r;
    }
    const check = checkFile(file, file.bytes, {
      allowedMime: ["image/png", "image/jpeg", "image/webp"],
      maxBytes: 2 * 1024 * 1024,
    });
    if (!check.ok) return err(validationError(check.reason));
    const key = storageKey("avatars", `${viewer.id}-${uc.now.getTime()}`, uc.now);
    await c.storage.put(key, file.bytes, check.mime);
    const image = `/api/avatar/${viewer.id}?k=${encodeURIComponent(key)}`;
    const r = await setMyAvatar(c, uc, { image });
    if (r.ok) revalidatePath("/perfil");
    return r.ok ? ok({ image }) : r;
  },
);
