import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { eq } from "drizzle-orm";
import { getEnv } from "@/env";
import { DrizzleAuditRepository } from "@/modules/audit/infrastructure/drizzle-audit-repository";
import { getSettings } from "@/shared/config/settings-service";
import { getDb } from "@/shared/db/client";
import { account, rateLimit, session, user, verification } from "@/shared/db/schema";
import { sendAuthEmail } from "@/shared/email";
import { emails } from "@/shared/email/templates";
import { newId } from "@/shared/kernel/id";
import { logger } from "@/shared/lib/logger";
import { REQUEST_ID_HEADER } from "@/shared/lib/request-id";
import { isRole, type Role } from "./roles";

/**
 * Better Auth: email + contraseña con verificación obligatoria, plugin admin (roles, bloqueo,
 * "ver como"), rate limiting en BD y auditoría de cada evento de autenticación.
 */

const env = getEnv();
const db = getDb();

// Control de acceso del plugin admin: solo "admin" administra usuarios desde Better Auth.
// La autorización de negocio vive en permissions.ts (can()).
const ac = createAccessControl(defaultStatements);
const regular = ac.newRole(userAc.statements);
const roles = {
  admin: ac.newRole(adminAc.statements),
  docente: regular,
  lider: regular,
  auxiliar: regular,
  profesor: regular,
  estudiante: regular,
};

const SELF_SERVICE: readonly Role[] = ["estudiante", "profesor"];

const STATUS_MESSAGES: Record<string, string> = {
  pendiente:
    "Tu cuenta está pendiente de aprobación por el administrador. Te avisaremos por correo cuando puedas entrar.",
  inactivo: "Tu cuenta está inactiva. Escríbele al docente ExperTIC si necesitas volver a entrar.",
  bloqueado: "Tu cuenta está bloqueada. Escríbele al administrador si crees que es un error.",
};

function requestMeta(headers: Headers | undefined | null) {
  const forwarded = headers?.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || headers?.get("x-real-ip") || null,
    userAgent: headers?.get("user-agent") ?? null,
    requestId: headers?.get(REQUEST_ID_HEADER) ?? null,
  };
}

const AUDITED_PATHS: Record<string, string> = {
  "/sign-in/email": "auth.login",
  "/sign-up/email": "auth.registered",
  "/sign-out": "auth.logout",
  "/verify-email": "auth.email_verified",
  "/request-password-reset": "auth.password_reset_requested",
  "/reset-password": "auth.password_reset",
  "/change-password": "auth.password_changed",
  "/update-user": "auth.profile_updated",
  "/admin/impersonate-user": "auth.impersonation_started",
  "/admin/stop-impersonating": "auth.impersonation_stopped",
  "/admin/set-role": "auth.role_changed",
  "/admin/ban-user": "auth.user_banned",
  "/admin/unban-user": "auth.user_unbanned",
};

export const auth = betterAuth({
  appName: "Mesa de Ayuda ExperTIC",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL, env.BETTER_AUTH_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, rateLimit },
  }),
  advanced: {
    database: { generateId: () => newId() },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user: u, url }) => {
      sendAuthEmail(emails.resetPassword(u.email, u.name, url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Tras confirmar se va al login (no se inicia sesión sola): así las cuentas de personal
    // pendientes de aprobación reciben el mensaje claro al intentar entrar.
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user: u, url }) => {
      sendAuthEmail(emails.verifyEmail(u.email, u.name, url));
    },
  },

  user: {
    additionalFields: {
      status: { type: "string", input: false, defaultValue: "pendiente" },
      requestedRole: { type: "string", required: false, input: true },
      codigoUis: { type: "string", required: false, input: true },
      programa: { type: "string", required: false, input: true },
      telefono: { type: "string", required: false, input: true },
      dataConsentVersion: { type: "string", required: false, input: true },
      dataConsentAt: { type: "date", required: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": { window: 60, max: env.E2E_RELAXED_RATE_LIMIT ? 500 : 5 },
      "/sign-up/email": { window: 600, max: env.E2E_RELAXED_RATE_LIMIT ? 100 : 5 },
      "/request-password-reset": { window: 600, max: 3 },
      "/send-verification-email": { window: 600, max: 3 },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Registro público: el rol lo fija el servidor a partir del rol solicitado (D-002).
        before: async (data, ctx) => {
          if (ctx?.path !== "/sign-up/email") return; // admin o semilla: respetar lo indicado
          const requested = (data as Record<string, unknown>).requestedRole;
          if (!isRole(requested) || requested === "admin") {
            throw new APIError("BAD_REQUEST", { message: "Elige un rol válido para registrarte." });
          }
          if (!(data as Record<string, unknown>).dataConsentVersion) {
            throw new APIError("BAD_REQUEST", {
              message: "Para registrarte debes aceptar el aviso de tratamiento de datos.",
            });
          }
          const s = await getSettings(db, [
            "auth.allowedEmailDomains",
            "registration.approvalRoles",
          ]);
          const domains = env.ALLOWED_EMAIL_DOMAINS.length
            ? env.ALLOWED_EMAIL_DOMAINS
            : s["auth.allowedEmailDomains"];
          const domain = data.email.split("@")[1]?.toLowerCase() ?? "";
          if (domains.length && !domains.includes(domain)) {
            throw new APIError("BAD_REQUEST", {
              message: `Solo se aceptan correos de: ${domains.join(", ")}.`,
            });
          }
          const needsApproval =
            !SELF_SERVICE.includes(requested) &&
            (s["registration.approvalRoles"] as readonly string[]).includes(requested);
          return {
            data: {
              ...data,
              role: requested,
              status: needsApproval ? "pendiente" : "activo",
              dataConsentAt: new Date(),
            },
          };
        },
      },
    },
    session: {
      create: {
        // Solo las cuentas activas pueden iniciar sesión.
        before: async (s) => {
          const [u] = await db
            .select({ status: user.status })
            .from(user)
            .where(eq(user.id, s.userId))
            .limit(1);
          if (!u || u.status !== "activo") {
            throw new APIError("FORBIDDEN", {
              message: STATUS_MESSAGES[u?.status ?? "inactivo"] ?? STATUS_MESSAGES.inactivo,
            });
          }
        },
      },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const action = AUDITED_PATHS[ctx.path];
      if (!action) return;
      try {
        const returned = ctx.context.returned;
        const failed = returned instanceof APIError;
        const meta = requestMeta(ctx.request?.headers ?? ctx.headers);
        const sessionUser = ctx.context.newSession?.user ?? ctx.context.session?.user;
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const email = typeof body.email === "string" ? body.email.toLowerCase() : undefined;
        // Restablecer contraseña no revela si el correo existe: no se audita el correo.
        const entityId = String(
          sessionUser?.id ??
            (action === "auth.password_reset_requested"
              ? "anonimo"
              : (email ?? body.userId ?? "anonimo")),
        );
        await new DrizzleAuditRepository(db).append({
          actorId: sessionUser?.id ?? null,
          actorRole: (sessionUser as { role?: string } | undefined)?.role ?? null,
          action: failed ? `${action}_failed` : action,
          entityType: "user",
          entityId,
          before: null,
          after: failed
            ? { reason: (returned as APIError).body?.message ?? (returned as APIError).message }
            : action === "auth.role_changed"
              ? { userId: body.userId, role: body.role }
              : null,
          ...meta,
        });
      } catch (err) {
        logger.error({ err, path: ctx.path }, "no se pudo auditar el evento de autenticación");
      }
    }),
  },

  plugins: [
    admin({
      ac,
      roles,
      adminRoles: ["admin"],
      defaultRole: "estudiante",
      impersonationSessionDuration: 60 * 60,
      bannedUserMessage: STATUS_MESSAGES.bloqueado,
    }),
    // Debe ir de último: permite que las Server Actions fijen cookies.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
