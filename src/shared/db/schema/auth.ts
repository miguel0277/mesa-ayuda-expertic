import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
// Rutas relativas a propósito: drizzle-kit carga este archivo fuera de Next.
import { newId } from "../../kernel/id";
import { roleEnum, userStatusEnum } from "./enums";

/**
 * Tablas de Better Auth. Las claves del objeto (camelCase) son los nombres de campo que
 * Better Auth espera; las columnas se nombran en snake_case.
 * Better Auth genera los id con UUID v7 (advanced.database.generateId, Fase 3).
 */

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const user = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    /** Foto de perfil (hace las veces de avatar_url, ver D-012). */
    image: text("image"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    // ── Campos propios ExperTIC ──
    role: roleEnum("role").notNull().default("estudiante"),
    /**
     * Rol que la persona pidió al registrarse (D-002). Es solo informativo: el rol efectivo
     * (`role`) lo fija el servidor y nunca lo puede cambiar el propio usuario.
     */
    requestedRole: roleEnum("requested_role"),
    status: userStatusEnum("status").notNull().default("pendiente"),
    codigoUis: text("codigo_uis"),
    programa: text("programa"),
    telefono: text("telefono"),
    liderId: uuid("lider_id").references((): AnyPgColumn => user.id, { onDelete: "set null" }),
    /** Aceptación del aviso de tratamiento de datos (Ley 1581 de 2012). */
    dataConsentAt: ts("data_consent_at"),
    dataConsentVersion: text("data_consent_version"),
    approvedAt: ts("approved_at"),
    approvedBy: uuid("approved_by").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),

    // ── Plugin admin de Better Auth ──
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: ts("ban_expires"),
  },
  (t) => [
    index("user_role_status_idx").on(t.role, t.status),
    index("user_lider_idx").on(t.liderId),
  ],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Plugin admin: id del admin que está "viendo como" este usuario. */
    impersonatedBy: uuid("impersonated_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Rate limiting de Better Auth en la BD (servidor sin estado: sirve con varias instancias). */
export const rateLimit = pgTable("rate_limit", {
  id: uuid("id").primaryKey().$defaultFn(newId),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
