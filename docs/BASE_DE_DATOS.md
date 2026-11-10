# Base de datos: Neon (PostgreSQL)

Usamos **Neon Free**. El cómputo se suspende solo tras 5 minutos sin uso y **se reactiva automáticamente** con la siguiente consulta, en milisegundos. No hay que entrar a reactivarlo.
Los adjuntos **no** se guardan en la base de datos sino en el `StorageProvider` (disco local en desarrollo, Vercel Blob en producción).

## 1. Crear el proyecto

1. Entra a [neon.com](https://neon.com) y crea una cuenta (puedes usar GitHub o Google).
2. **New Project**:
   - Nombre: `mesa-ayuda-expertic`
   - Postgres: **17**
   - Región: la más cercana, por ejemplo **AWS US East 1 (N. Virginia)** (`aws-us-east-1`).
3. Neon crea una rama `main`. Esa será **producción**.

## 2. Crear la rama de desarrollo

1. En el menú lateral, **Branches → New branch**.
2. Nombre: `dev`, a partir de `main`.
3. Trabaja siempre sobre `dev` en tu computador. `main` queda para Vercel.

## 3. Copiar las dos cadenas de conexión

En el panel del proyecto, botón **Connect**, con la rama **`dev`** seleccionada:

| Interruptor "Connection pooling" | Cómo se ve el host                                       | Variable                |
| -------------------------------- | -------------------------------------------------------- | ----------------------- |
| **Activado**                     | `ep-xxxx-pooler.us-east-1.aws.neon.tech` (con `-pooler`) | `DATABASE_URL`          |
| **Desactivado**                  | `ep-xxxx.us-east-1.aws.neon.tech` (sin `-pooler`)        | `DATABASE_URL_UNPOOLED` |

- La **pooled** la usa la aplicación (muchas conexiones cortas, ideal para Vercel).
- La **directa** la usan las migraciones y la semilla.

> No compartas estas cadenas por chat ni las subas a GitHub: llevan la contraseña de la base de datos. `.env.local` ya está en `.gitignore`.

## 4. Configurar `.env.local`

```bash
cp .env.example .env.local   # si aún no existe
```

Pega las dos cadenas y define el administrador inicial:

```env
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require
SEED_ADMIN_EMAIL=tu-correo@ejemplo.com
SEED_ADMIN_PASSWORD=una-clave-de-al-menos-10-caracteres
```

## 5. Migrar y sembrar

```bash
pnpm db:migrate   # aplica /drizzle con la conexión directa
pnpm db:seed      # admin + catálogos + datos de demostración
```

Variantes de la semilla:

| Comando                        | Qué hace                                                                                                                               | ¿En producción? |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `pnpm db:seed`                 | Admin, 6 categorías, SLA, ajustes y datos de demostración (25 usuarios, 40 tickets, 60 tareas). Falla si ya hay datos de demostración. | ❌              |
| `pnpm db:seed --reset`         | Vacía **todas** las tablas y vuelve a sembrar la demostración.                                                                         | ❌              |
| `pnpm db:seed --solo-catalogo` | Solo admin, categorías, SLA y ajustes. Idempotente: no pisa lo que ya se haya editado.                                                 | ✅              |

Usuarios de demostración: `docente@expertic.test`, `lider1@…`, `aux1@…`, `profesor1@…`, `estudiante1@…` (ver el README). Contraseña de todos: `ExperTIC-2026*`.

## 6. Verificar

```bash
pnpm db:studio           # explorador visual de tablas (https://local.drizzle.studio)
pnpm dev                 # y abre http://localhost:3000/api/health  → { "status": "ok", ... }
```

## 7. Producción en Vercel (más adelante)

- **Opción A (recomendada):** en Vercel, _Storage → Connect Database → Neon_. La integración crea `DATABASE_URL` y `DATABASE_URL_UNPOOLED` y puede crear una rama de Neon por cada _preview_.
- **Opción B:** pega a mano las dos cadenas de la rama `main` en _Settings → Environment Variables_.
- Aplica las migraciones a `main` desde tu equipo, apuntando `.env.local` temporalmente a `main`, o desde CI: `pnpm db:migrate` y luego `pnpm db:seed --solo-catalogo`.

## Cambios de esquema (flujo de trabajo)

1. Edita `src/shared/db/schema/*.ts`.
2. `pnpm db:generate --name descripcion_corta` → crea un SQL nuevo en `/drizzle` (revísalo y súbelo a Git).
3. `pnpm db:migrate`.
4. Para SQL que Drizzle no modela (triggers, funciones): `npx drizzle-kit generate --custom --name ...`.

## Qué hay en el esquema

- **Autenticación (Better Auth):** `user` (con rol, estado, código UIS, programa, teléfono, líder y aceptación del aviso de datos), `session`, `account`, `verification`.
- **Negocio:** `teams`, `team_members` (con historial por semestre), `ticket_types` (plantillas JSONB), `sla_policies`, `tickets`, `ticket_messages`, `tasks`, `task_evidence`, `attachments`, `notifications`, `email_outbox`, `app_settings`.
- **Auditoría:** `audit_log`, **solo inserción**: un _trigger_ rechaza cualquier `UPDATE` o `DELETE`.
- **Vistas para paneles:** `v_task_compliance` (cumplimiento por auxiliar y mes) y `v_ticket_sla` (estado del SLA por ticket).
- **Secuencias:** `ticket_code_seq` (`EXP-2026-00042`) y `task_code_seq` (`TAR-2026-00007`).
- Todas las claves primarias son **UUID v7** y todas las fechas son `timestamptz`. Las tablas de negocio tienen `created_at`, `updated_at`, `created_by`, `updated_by` y `deleted_at` (_soft delete_).

## Pruebas sin Neon

`pnpm test` levanta un PostgreSQL 17 real **en memoria** (PGlite), aplica las mismas migraciones y corre la semilla. No necesita Docker, red ni credenciales.
