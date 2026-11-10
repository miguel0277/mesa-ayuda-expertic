# Prompt maestro — Mesa de Ayuda ExperTIC (Iteración 1)

> Pega este documento completo como primer mensaje en Claude Code (o guárdalo como `CLAUDE.md` en la raíz del repositorio vacío y escribe: "Lee CLAUDE.md y empieza por la Fase 0").

---

## 0. Tu rol y el contexto

Eres un **ingeniero full-stack senior y diseñador de producto UX/UI**. Vas a construir desde cero la primera iteración de **Mesa de Ayuda ExperTIC**, una aplicación web para ExperTIC (Universidad Industrial de Santander, Bucaramanga, Colombia).

**Problema que resuelve.** Hoy las solicitudes de profesores y estudiantes, y las tareas de los auxiliares, llegan por correo, WhatsApp o de palabra. No queda registro de quién pidió qué, quién lo atiende ni si se cumplió a tiempo. El dueño del proceso (el docente ExperTIC, jefe de la auxiliatura) necesita que **toda la información quede en un solo lugar** y poder ver de un vistazo **quién va a tiempo y quién va atrasado**.

**Usuarios y roles (6):**
1. **Administrador**: ve y gestiona absolutamente todo (rol técnico para desarrollo y soporte).
2. **Docente ExperTIC**: dueño del proceso. Asigna tareas a auxiliares, ve el panel de cumplimiento y todos los tickets.
3. **Auxiliar líder**: auxiliar con un equipo a cargo. Atiende sus tareas y ve y gestiona el avance de su equipo.
4. **Auxiliar**: ve sus tareas asignadas, las ejecuta y deja evidencia. Ve lo que hizo y lo que le falta.
5. **Profesor**: crea tickets con campos preestablecidos y adjuntos, y consulta sus solicitudes y respuestas.
6. **Estudiante**: igual que el profesor (crea y consulta tickets).

Todo el texto de la interfaz va en **español (Colombia)**: fechas `dd/MM/yyyy`, hora de 12 h con a. m./p. m. y zona horaria `America/Bogota`.

---

## 1. Cómo debes trabajar (obligatorio)

1. **Planea antes de codificar.** Empieza en modo plan. Presenta el plan de la Fase 0 y espera mi aprobación. Al cerrar cada fase haz un resumen corto de lo hecho, cómo probarlo y lo que sigue, y espera mi "continúa".
2. **Carga todas las skills de diseño instaladas.** Antes de escribir cualquier componente visual, lista las skills disponibles y **carga todas las relacionadas con diseño, UI, UX, frontend, accesibilidad, animación, shadcn, Tailwind, React/Next.js o buenas prácticas web** (por ejemplo `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`, `shadcn-ui`, `vercel-react-best-practices` o las equivalentes que existan). Dime cuáles cargaste. Si alguna no está instalada, sigue sin ella y dímelo. Sigue sus lineamientos y, si chocan con este documento, prevalece este documento.
3. **Usa documentación actual.** Si tienes acceso a documentación (MCP de docs o búsqueda web), consulta la versión vigente de Next.js, Better Auth, Drizzle, Neon, shadcn/ui y Motion antes de usar sus APIs. No inventes APIs.
4. **Commits pequeños.** Usa Git local con un commit por paso lógico y mensajes en convención *Conventional Commits* (`feat:`, `fix:`, `chore:`…). **No hagas push ni despliegues**: yo subo a GitHub y despliego en Vercel.
5. **Nada de datos falsos en producción.** Los datos de ejemplo van solo en el script de semilla (`db:seed`).
6. **Calidad antes de avanzar.** Al cerrar cada fase deben pasar `pnpm typecheck`, `pnpm lint` y `pnpm test`.
7. **Si algo es ambiguo**, toma la decisión más sensata, déjala anotada en `docs/DECISIONES.md` y sigue.

---

## 2. Stack (fijo)

| Capa | Tecnología |
|---|---|
| Framework | **Next.js** (última estable, App Router, Server Components, Server Actions), **TypeScript** en modo `strict` |
| Gestor de paquetes | **pnpm** |
| Estilos y UI | **Tailwind CSS v4**, **shadcn/ui** (Radix), `lucide-react`, `class-variance-authority`, `tailwind-merge` |
| Animación | **Motion** (`motion/react`), View Transitions de Next/React cuando aplique, `tw-animate-css` |
| Tablas y gráficas | TanStack Table, Recharts (o los charts de shadcn) |
| Formularios | React Hook Form + **Zod** |
| Estado en URL | `nuqs` (filtros, paginación y pestañas compartibles por URL) |
| Notificaciones UI | `sonner` (toasts), `cmdk` (paleta de comandos ⌘K / Ctrl+K) |
| Drag & drop | `@dnd-kit` (tablero Kanban) |
| Tema | `next-themes` (claro, oscuro y sistema) |
| Base de datos | **PostgreSQL en Neon** (plan Free) con el driver serverless `@neondatabase/serverless` |
| ORM | **Drizzle ORM** + `drizzle-kit` (migraciones versionadas en `/drizzle`) |
| Autenticación | **Better Auth** con adaptador Drizzle, email + contraseña, verificación de correo, *admin plugin* (roles, bloqueo, *impersonation*) y rate limiting incorporado |
| Archivos | Interfaz `StorageProvider` con dos implementaciones: `LocalDiskStorage` (desarrollo) y `VercelBlobStorage` (producción) |
| Correo | Interfaz `EmailProvider`: `ConsoleEmail` (desarrollo, imprime el correo en consola) y `ResendEmail` (producción) |
| Logs | `pino` con logs estructurados en JSON y `requestId` |
| Pruebas | **Vitest** (dominio y servicios), **Playwright** (e2e por rol) |
| Calidad | ESLint, Prettier, Husky + lint-staged, workflow de GitHub Actions (lint, typecheck, test, build) **solo como archivo**, sin ejecutarlo |

---

## 3. Arquitectura y patrones de diseño

Aplica una **arquitectura por capas con módulos por funcionalidad** (*feature-sliced* y limpia, sin sobreingeniería). La UI nunca habla directo con la base de datos.

```
src/
  app/                      # Rutas (presentación). Solo componen y llaman acciones.
    (auth)/login, registro, verificar-correo, recuperar
    (app)/layout.tsx        # Shell autenticado: sidebar, topbar, ⌘K, notificaciones
    (app)/inicio            # Redirige al panel según el rol
    (app)/solicitudes/...   # Profesor y estudiante
    (app)/tareas/...        # Auxiliar y líder
    (app)/equipo/...        # Líder
    (app)/panel/...         # Docente ExperTIC
    (app)/admin/...         # Administrador
    api/                    # Solo lo imprescindible (subida de archivos, auth handler, cron)
  modules/
    tickets/   { domain/, application/, infrastructure/, ui/ }
    tasks/     { ... }
    users/     { ... }
    teams/     { ... }
    templates/ { ... }
    audit/     { ... }
    notifications/ { ... }
  shared/
    domain/        # Result<T,E>, errores de dominio, tipos base
    kernel/        # EventBus, Clock, IdGenerator
    auth/          # sesión, guards, matriz de permisos
    db/            # cliente Drizzle, esquema, transacciones
    ui/            # componentes base, tokens, motion presets
    lib/           # utilidades (fechas es-CO, formateadores)
```

**Patrones obligatorios (aplicados con criterio, no por decorar):**

- **Repository**: cada agregado (`Ticket`, `Task`, `User`, `Team`) tiene una interfaz de repositorio en `domain/` y una implementación Drizzle en `infrastructure/`. Los servicios dependen de la interfaz.
- **Service Layer / Use Cases**: un caso de uso por acción (`CreateTicket`, `AssignTicket`, `CompleteTask`…). Cada uno valida con Zod, verifica permisos, ejecuta en transacción, emite eventos y devuelve `Result`.
- **State Machine**: los estados de ticket y de tarea son máquinas de estados explícitas, con una tabla de transiciones permitidas por rol. Una transición inválida devuelve un error de dominio, nunca se hace en silencio.
- **Policy / RBAC**: una función central `can(actor, action, resource)` con una matriz de permisos declarativa (sección 5). La UI la usa para ocultar acciones y el servidor la usa para **bloquearlas**. Las dos validaciones son obligatorias.
- **Observer / Domain Events**: un `EventBus` en proceso. Los casos de uso publican eventos (`ticket.created`, `ticket.assigned`, `task.completed`…). Los suscriptores escriben la auditoría y las notificaciones. Así se desacopla la trazabilidad de la lógica.
- **Strategy / Adapter**: `StorageProvider`, `EmailProvider` y `Clock` son inyectables, lo que permite cambiar de proveedor sin tocar la lógica y hacer pruebas deterministas.
- **Factory**: `TicketFormFactory` construye, a partir de la plantilla JSON de un tipo de ticket, **el esquema Zod y el formulario dinámico** con los mismos datos (una sola fuente de verdad).
- **DTO / Mapper**: el dominio no se filtra a la UI. Se exponen DTOs serializables.
- **Composition Root** sencillo en `shared/kernel/container.ts` para instanciar dependencias. No uses librerías de inyección de dependencias.

**Reglas:** sin lógica de negocio en componentes ni en rutas. Server Components por defecto y `"use client"` solo donde haya interacción. Nada de `any`.

---

## 4. Modelo de datos (Drizzle + PostgreSQL)

Usa UUID v7 como clave primaria, `timestamptz` en todas las fechas y columnas `created_at`, `updated_at`, `created_by` y `updated_by` en las tablas de negocio. Las tablas de negocio usan *soft delete* (`deleted_at`).

- **Tablas de Better Auth** (`user`, `session`, `account`, `verification`). Extiende `user` con: `role` (enum), `status` (`pendiente | activo | inactivo | bloqueado`), `codigo_uis`, `programa`, `telefono` (opcional), `lider_id` (FK a `user`, nullable) y `avatar_url`.
- `teams`: id, nombre, `lider_id`, semestre (ej. `2026-2`), activo.
- `team_members`: `team_id`, `user_id`, desde y hasta (para conservar el historial de rotación semestral).
- `ticket_types`: id, nombre, slug, descripción, ícono, color, `fields` (JSONB, ver abajo), `default_priority`, activo y orden.
- `sla_policies`: prioridad (`baja | media | alta`), `first_response_minutes`, `resolution_minutes` y horario hábil (JSONB).
- `tickets`: id, `code` (consecutivo legible `EXP-2026-00042` generado con una secuencia), `type_id`, `requester_id`, `assignee_id`, `team_id`, `priority`, `status`, `title`, `description`, `location` (JSONB: edificio, salón), `required_at`, `values` (JSONB validado contra la plantilla), `first_response_at`, `resolved_at`, `closed_at`, `sla_first_response_due`, `sla_resolution_due`, `rating` y `rating_comment`.
- `ticket_messages`: id, `ticket_id`, `author_id`, `body`, `is_internal` (las notas internas no las ve el solicitante) y `created_at`.
- `tasks`: id, `code`, `title`, `description`, `assigned_by`, `assignee_id`, `team_id`, `ticket_id` (nullable), `priority`, `status`, `due_at`, `started_at`, `completed_at` y `requires_evidence` (por defecto `true`).
- `task_evidence`: id, `task_id`, `author_id`, `note` y `created_at`.
- `attachments`: id, `owner_type` (`ticket | message | task | evidence`), `owner_id`, `file_name`, `mime`, `size_bytes`, `storage_key`, `uploaded_by` y `created_at`.
- `audit_log` (**solo inserción**, nunca se actualiza ni se borra): id, `occurred_at`, `actor_id`, `actor_role`, `action` (ej. `ticket.status_changed`), `entity_type`, `entity_id`, `before` (JSONB), `after` (JSONB), `ip`, `user_agent` y `request_id`.
- `notifications`: id, `user_id`, `type`, `title`, `body`, `href`, `read_at` y `created_at`.
- `app_settings`: clave y valor (JSONB). Aquí van dominios de correo permitidos, tamaño máximo de adjunto, umbral de "en riesgo" y días para el autocierre.

**Formato de `ticket_types.fields`** (motor de plantillas):

```json
[
  {"key":"edificio","label":"Edificio","type":"select","options":["Ing. Sistemas","CENTIC","Camilo Torres"],"required":true},
  {"key":"salon","label":"Salón / espacio","type":"text","required":true,"maxLength":20},
  {"key":"fecha_requerida","label":"Fecha y hora requerida","type":"datetime","required":true,"minFromNowMinutes":30},
  {"key":"equipo","label":"Equipo solicitado","type":"multiselect","options":["Portátil","Videobeam","Cámara","Micrófono"]},
  {"key":"soporte","label":"Adjunto","type":"file","accept":["application/pdf","image/*"],"maxFiles":3}
]
```

Tipos de campo soportados: `text`, `textarea`, `number`, `select`, `multiselect`, `date`, `datetime`, `checkbox`, `file`.

**Índices:** `tickets(status, priority)`, `tickets(requester_id)`, `tickets(assignee_id, status)`, `tasks(assignee_id, status, due_at)`, `tasks(team_id)`, `audit_log(entity_type, entity_id, occurred_at desc)` y `notifications(user_id, read_at)`.

**Vistas SQL** para los paneles: `v_task_compliance` (semáforo y % de cumplimiento por auxiliar y por periodo) y `v_ticket_sla` (estado del SLA por ticket).

---

## 5. Roles, permisos y reglas de negocio

### 5.1 Matriz de permisos (implementar en `shared/auth/permissions.ts`)

| Permiso | Admin | Docente | Líder | Auxiliar | Profesor | Estudiante |
|---|---|---|---|---|---|---|
| `ticket.create` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `ticket.read.own` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `ticket.read.assigned` | ✔ | ✔ | ✔ | ✔ | – | – |
| `ticket.read.team` | ✔ | ✔ | ✔ | – | – | – |
| `ticket.read.all` | ✔ | ✔ | – | – | – | – |
| `ticket.assign` | ✔ | ✔ | equipo | – | – | – |
| `ticket.reply` / `ticket.status` | ✔ | ✔ | ✔ | si asignado | solo `resolver`/`reabrir` propio | ídem |
| `ticket.internal_note` | ✔ | ✔ | ✔ | ✔ | – | – |
| `task.create` / `task.assign` | ✔ | ✔ | equipo | – | – | – |
| `task.update.own` / `task.complete` | ✔ | – | ✔ | ✔ | – | – |
| `dashboard.global` | ✔ | ✔ | – | – | – | – |
| `dashboard.team` | ✔ | ✔ | ✔ | – | – | – |
| `templates.manage` / `sla.manage` | ✔ | ✔ | – | – | – | – |
| `users.manage` | ✔ | auxiliares y equipos | – | – | – | – |
| `roles.grant.admin` | ✔ | – | – | – | – | – |
| `audit.read` | ✔ | ✔ | equipo | – | – | – |
| `admin.impersonate` | ✔ | – | – | – | – | – |
| `settings.manage` | ✔ | – | – | – | – | – |

### 5.2 Registro y roles
- El registro público solo permite elegir **Estudiante** o **Profesor**, y solo con correos de los dominios permitidos (`ALLOWED_EMAIL_DOMAINS`, por defecto `uis.edu.co,correo.uis.edu.co`). La verificación de correo es obligatoria.
- Los profesores quedan en estado `pendiente` hasta que un docente o administrador los apruebe. Los estudiantes quedan activos tras verificar el correo.
- Los roles Auxiliar, Líder y Docente los otorga el docente o el administrador. El rol Admin solo lo otorga otro admin. El primer admin se crea con `pnpm db:seed` usando `SEED_ADMIN_EMAIL`.
- Al cerrar el semestre, el docente puede **desactivar en bloque** a los auxiliares. Se conserva todo su historial.

### 5.3 Máquina de estados del ticket
`abierto → asignado → en_progreso → respondido → cerrado`, más `respondido → en_progreso` (si el solicitante responde) y `cerrado → reabierto → asignado` (si se reabre dentro de los 7 días). El autocierre ocurre a los N días en `respondido` sin actividad (`app_settings`). Cada transición registra auditoría y notifica.

### 5.4 Máquina de estados de la tarea
`pendiente → en_progreso → completada`, más `cancelada` (solo quien la asignó). Completar exige **al menos una evidencia** (nota y/o archivo) si `requires_evidence`.

### 5.5 Semáforo de cumplimiento (función pura con pruebas unitarias)
- **A tiempo**: completada antes de `due_at`, o abierta con más de `riskThresholdHours` (por defecto 24) para vencer.
- **En riesgo**: abierta y vence en ≤ `riskThresholdHours`.
- **Atrasada**: abierta con `due_at` vencido, o completada después de `due_at` (cumplida tarde).
- **% cumplimiento** = completadas a tiempo ÷ tareas con `due_at` ya cumplido en el periodo.
- **Estado del auxiliar** = el peor estado entre sus tareas abiertas.

### 5.6 SLA
Calcula `sla_first_response_due` y `sla_resolution_due` al crear el ticket según la prioridad y el horario hábil (lunes a viernes, 7:00–18:00, festivos de Colombia configurables). Muestra contadores regresivos y alertas.

---

## 6. Historias de usuario (alcance de esta iteración)

Cada historia tiene criterios de aceptación verificables. Implementa todas.

**Autenticación**
- HU-01: Como visitante quiero **registrarme** con mi correo institucional, nombre, código UIS y rol (estudiante/profesor) para usar la plataforma. *Acepta:* rechaza dominios no permitidos con un mensaje claro; envía el correo de verificación (en dev se ve en consola); valida la fortaleza de la contraseña en vivo; acepta el aviso de tratamiento de datos (Ley 1581 de 2012) de forma obligatoria.
- HU-02: Como usuario quiero **iniciar sesión**, **cerrar sesión** y **recuperar la contraseña**. *Acepta:* rate limiting; mensajes que no revelan si el correo existe; redirección al panel del rol.
- HU-03: Como usuario quiero ver y editar **mi perfil** (nombre, foto, teléfono) y cambiar mi contraseña.

**Profesor / Estudiante**
- HU-10: Crear un ticket eligiendo el tipo (tarjetas con ícono). El formulario se arma desde la plantilla, con adjuntos (drag & drop y vista previa) y prioridad. *Acepta:* validación en cliente y servidor con el mismo esquema; muestra el código del ticket y una animación de confirmación.
- HU-11: Ver **mis solicitudes** con filtros por estado, búsqueda y orden; ver el detalle con línea de tiempo de estados, hilo de mensajes, adjuntos y el SLA.
- HU-12: Responder en el hilo, **marcar como resuelto** o **reabrir**, y **calificar** la atención al cerrar.

**Auxiliar**
- HU-20: Ver **mis tareas** en **Kanban** (Pendiente / En progreso / Completada) con arrastrar y soltar, y en vista **lista**, con chips del semáforo.
- HU-21: Cambiar el estado de una tarea y **completarla subiendo evidencia** (nota y archivos).
- HU-22: Ver **mi progreso**: % de cumplimiento, completadas vs. pendientes en el periodo y racha de tareas a tiempo.
- HU-23: Ver los **tickets asignados**, responder (también con notas internas) y cambiar su estado.

**Auxiliar líder** (todo lo del auxiliar, más:)
- HU-30: Panel **Mi equipo**: tarjeta por auxiliar con avance, vencidas, próxima tarea y semáforo, y un feed de actividad reciente.
- HU-31: **Delegar y reasignar** tareas y tickets dentro de su equipo.

**Docente ExperTIC**
- HU-40: **Panel de control** con KPIs (tareas activas, a tiempo, atrasadas, tickets abiertos, sin asignar, % SLA cumplido), tabla de cumplimiento por auxiliar con semáforo, tickets por tipo y por semana, y tickets recientes. Todo filtrable por periodo y equipo.
- HU-41: **Bandeja de tickets** global con filtros guardables en la URL, asignación rápida y acciones en lote.
- HU-42: **Crear y asignar tareas** (a una persona o a un equipo, con fecha límite, prioridad, ticket vinculado y si requiere evidencia).
- HU-43: Gestionar **auxiliares y equipos** (aprobar profesores, otorgar roles, armar equipos por semestre y desactivar en bloque).
- HU-44: **Editor de plantillas** de tipos de ticket (constructor visual de campos con vista previa en vivo) y configuración de SLA.
- HU-45: **Exportar** tickets y tareas a CSV o Excel por rango de fechas.

**Administrador** (todo lo anterior, más:)
- HU-50: **Consola admin** con navegación a todo: usuarios (crear, editar, bloquear, cambiar rol, restablecer acceso), equipos, tickets, tareas, plantillas, SLA, ajustes y notificaciones.
- HU-51: **Visor de auditoría** con línea de tiempo filtrable por entidad, actor, acción y fecha, y diff visual `before/after`.
- HU-52: **"Ver como"** (*impersonation* de Better Auth) para revisar la vista de cualquier rol. Muestra un banner persistente mientras está activo y deja registro en la auditoría.
- HU-53: **Salud del sistema**: conteos por tabla, últimos errores registrados, versión desplegada y estado de la conexión a la BD.

**Transversales**
- HU-60: **Centro de notificaciones** en la app (campana con contador y marcar como leídas) más correo en eventos clave.
- HU-61: **Paleta de comandos ⌘K** para navegar, buscar tickets por código y ejecutar acciones según el rol.
- HU-62: **Búsqueda global** de tickets y tareas (código, título y solicitante).

**Fuera de alcance en esta iteración:** chat en tiempo real, app móvil nativa, IA, integración con sistemas académicos de la UIS, inventario de equipos e integración con Power BI.

---

## 7. Mapa de rutas

| Ruta | Rol |
|---|---|
| `/login`, `/registro`, `/verificar-correo`, `/recuperar` | Público |
| `/inicio` | Redirige según el rol |
| `/solicitudes`, `/solicitudes/nueva`, `/solicitudes/[code]` | Profesor, Estudiante (y cualquiera para las propias) |
| `/tareas`, `/tareas/[code]`, `/tickets-asignados` | Auxiliar, Líder |
| `/equipo` | Líder |
| `/panel`, `/panel/tickets`, `/panel/tareas`, `/panel/auxiliares`, `/panel/plantillas`, `/panel/reportes` | Docente |
| `/admin`, `/admin/usuarios`, `/admin/equipos`, `/admin/auditoria`, `/admin/ajustes`, `/admin/sistema` | Admin |
| `/perfil`, `/notificaciones` | Todos |

Protege las rutas con **middleware** (sesión) y además con **guards en el servidor** en cada página y acción (permiso). Responde `403` con una página ilustrada y amable.

---

## 8. Diseño, UX y animación (nivel producto profesional)

**Objetivo:** que se sienta como un producto SaaS moderno (en la línea de Linear, Vercel o Height), no como una plantilla genérica. Antes de codificar la UI, propón en `docs/DISENO.md` una **dirección visual** con nombre, paleta, tipografía, radios, sombras y *motion principles*, y espera mi aprobación junto con el plan de la Fase 2.

**Sistema de diseño:**
- Tokens en un solo archivo (`globals.css` con variables de Tailwind v4 / `@theme`). Los colores de marca quedan como variables para que yo ponga después los oficiales de ExperTIC/UIS. **No uses logos oficiales.** Usa un logotipo provisional tipográfico.
- Tipografía: una sans moderna para la interfaz (Inter, Geist o similar vía `next/font`) y, opcionalmente, una display para los títulos. Usa números tabulares en tablas y KPIs.
- Semáforo accesible: verde, ámbar y rojo **acompañados siempre de un ícono y un texto**, nunca solo color. Contraste mínimo AA (4.5:1).
- Modo claro, oscuro y sistema.
- Densidad cómoda en escritorio y layouts *mobile-first*: el sidebar se vuelve *drawer* y las tablas pasan a tarjetas en el móvil.

**Componentes y patrones UX:**
- Shell con sidebar colapsable (agrupado por rol), topbar con búsqueda, ⌘K, notificaciones y menú de usuario, y migas de pan.
- Estados completos en cada vista: **cargando (skeletons con la forma real)**, **vacío (ilustración + texto + acción principal)**, **error (reintentar)** y **sin permiso**.
- Formularios con validación en vivo, mensajes humanos, autoguardado de borradores de tickets en `localStorage` (con try/catch) y confirmación antes de acciones destructivas.
- Actualizaciones optimistas (`useOptimistic`) en el Kanban, el cambio de estado y la lectura de notificaciones, con *rollback* y toast si falla.
- Tablas con orden, filtros, columnas visibles, paginación por cursor y selección para acciones en lote.
- Detalle de ticket en dos columnas: hilo a la izquierda y panel de metadatos, SLA y línea de tiempo a la derecha.
- Accesibilidad: navegación completa por teclado, foco visible, `aria-*` correctos, `<button>` y `<a>` reales, y etiquetas en todos los inputs. Respeta `prefers-reduced-motion`.

**Animaciones (Motion), con intención y sin exagerar:**
- Transiciones de página suaves (fade + desplazamiento de 8 px, 200–250 ms, *ease-out*); usa View Transitions donde Next lo soporte.
- Entrada escalonada (*stagger*) de tarjetas de KPI y filas de listas.
- **Contadores animados** en los KPIs y barras de progreso que crecen al entrar en pantalla.
- Kanban con `layout` animations al mover tarjetas y *spring* al soltar.
- Microinteracciones: hover y press en botones (escala 0.98), *shimmer* en skeletons, checkmark animado al completar tarea o enviar ticket, y pulso suave en el badge de notificaciones nuevas.
- Login y registro con una composición visual cuidada (gradiente sutil con ruido, o patrón geométrico animado muy lento) y los pasos del registro con transición entre ellos.
- Centraliza los presets en `shared/ui/motion.ts` (duraciones, *easings*, variantes). Todas las animaciones se desactivan con `prefers-reduced-motion`.

**Contenido:** todos los textos de la UI en español claro, en segunda persona ("Tus solicitudes"), sin jerga técnica. Las fechas relativas ("hace 2 h") muestran la fecha absoluta en un tooltip.

---

## 9. Trazabilidad, observabilidad y seguridad

- **Auditoría total:** cada caso de uso que cambia estado publica un evento y el suscriptor `AuditSubscriber` inserta en `audit_log` el actor, el rol, la acción, el `before`/`after`, la IP, el *user agent* y el `requestId`. Incluye inicios de sesión, intentos fallidos, cambios de rol e *impersonation*.
- **Línea de tiempo** visible en el detalle de cada ticket y tarea, construida desde la auditoría.
- **`requestId`** generado en el middleware y propagado a logs, auditoría y respuestas de error.
- **Logs estructurados** con `pino` (nivel por entorno). Nunca registres contraseñas, tokens ni contenido de adjuntos.
- **Seguridad:** validación Zod en todo input de servidor; protección CSRF (Server Actions y Better Auth); cabeceras de seguridad (CSP, `X-Frame-Options`, `Referrer-Policy`) en `next.config`; adjuntos con lista blanca de MIME, tamaño máximo, nombre saneado y descarga solo con autorización (*route handler* que verifica permisos); rate limiting en auth y en la creación de tickets.
- **Privacidad:** aviso de tratamiento de datos y registro de su aceptación (fecha y versión del texto).

---

## 10. Elasticidad y rendimiento

- Servidor **sin estado** (*stateless*): nada en memoria que impida escalar horizontalmente en Vercel. El `EventBus` es síncrono dentro de la transacción y, si un efecto secundario lento (correo) falla, no rompe la operación principal: queda registrado y se reintenta.
- Driver serverless de Neon con *pooling* (usa la cadena **pooled** para la app y la **directa** para migraciones).
- **Paginación por cursor** en todas las listas. Nunca traigas tablas completas.
- Caché de lecturas de paneles con `unstable_cache`/`"use cache"` y `revalidateTag` al mutar.
- *Streaming* con `Suspense` para que los paneles muestren partes mientras cargan.
- Consultas de paneles resueltas con las vistas SQL y los índices de la sección 4.
- Imágenes con `next/image` y división de código para el editor de plantillas y el Kanban.
- Endpoint `GET /api/cron/sla` (protegido con `CRON_SECRET`) que recalcula SLA, envía recordatorios de tareas por vencer y autocierra tickets. Déjalo listo para Vercel Cron (`vercel.json`).

---

## 11. Calidad y pruebas

- **Unitarias (Vitest):** máquinas de estados, semáforo, cálculo de SLA, `can()` (prueba cada fila de la matriz), `TicketFormFactory`.
- **Integración:** casos de uso contra una BD de prueba (rama de Neon o Postgres en Docker con `docker-compose.yml` opcional).
- **E2E (Playwright):** un flujo por rol: registro e inicio de sesión → crear ticket con adjunto → el docente asigna → el auxiliar responde y completa la tarea con evidencia → el solicitante ve la respuesta y cierra → el panel refleja el cambio. También pruebas negativas (un estudiante intenta abrir `/panel` y recibe 403).
- Scripts en `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`.
- **Semilla realista** (`db:seed`): 1 admin, 1 docente, 2 líderes con 3 auxiliares cada uno, 5 profesores, 10 estudiantes, los 6 tipos de ticket con sus plantillas, políticas SLA, unos 40 tickets en distintos estados y unas 60 tareas con fechas que produzcan los tres colores del semáforo. Las contraseñas de prueba van en el README.

---

## 12. Base de datos: Neon (gratis y sin pausas que haya que reactivar a mano)

Usamos **Neon Free** porque su cómputo se suspende solo tras 5 minutos sin uso y **se reactiva automáticamente** con la siguiente consulta (en milisegundos). No hay que entrar a reactivarlo, a diferencia del plan gratuito de Supabase. Los límites del plan Free (horas de cómputo y almacenamiento por proyecto) son suficientes para el piloto. Los adjuntos **no** se guardan en la BD sino en el `StorageProvider`.

Genera en `docs/BASE_DE_DATOS.md` estos pasos para mí y deja el código listo para que funcionen:

1. Crear una cuenta en neon.com → **New Project** → nombre `mesa-ayuda-expertic`, Postgres 17, región más cercana (por ejemplo `aws-us-east-1`).
2. En **Connect**, copiar dos cadenas: la **pooled** (host con `-pooler`) → `DATABASE_URL`, y la **directa** → `DATABASE_URL_UNPOOLED`.
3. Crear una rama `dev` en Neon para desarrollo y dejar `main` para producción.
4. Copiar `.env.example` a `.env.local` y completar las variables (sección 13).
5. Ejecutar `pnpm db:migrate` (usa la conexión directa) y luego `pnpm db:seed`.
6. Verificar con `pnpm db:studio`.
7. En Vercel, más adelante, usar la integración nativa de Neon o pegar las mismas variables en *Environment Variables*.

Configura `drizzle.config.ts` para usar `DATABASE_URL_UNPOOLED` y el cliente de la app para usar `DATABASE_URL`. Añade un *healthcheck* (`/api/health`) que haga `select 1`.

---

## 13. Variables de entorno (`.env.example` documentado)

```
DATABASE_URL=                 # Neon pooled
DATABASE_URL_UNPOOLED=        # Neon directa (migraciones)
BETTER_AUTH_SECRET=           # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
ALLOWED_EMAIL_DOMAINS=uis.edu.co,correo.uis.edu.co
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
STORAGE_DRIVER=local          # local | vercel-blob
BLOB_READ_WRITE_TOKEN=        # solo producción
EMAIL_DRIVER=console          # console | resend
RESEND_API_KEY=
EMAIL_FROM="Mesa de Ayuda ExperTIC <no-responder@tu-dominio>"
CRON_SECRET=
LOG_LEVEL=info
```

Valida las variables al arrancar con Zod (`src/env.ts`). Si falta una, la app falla con un mensaje claro.

---

## 14. Fases de trabajo

| Fase | Entregable | Cierre |
|---|---|---|
| **0. Plan** | Plan detallado, skills cargadas, dudas resueltas en `docs/DECISIONES.md` | Mi aprobación |
| **1. Cimientos** | Proyecto Next + TS + Tailwind + shadcn, ESLint/Prettier/Husky, `env.ts`, estructura de carpetas, Drizzle + Neon, esquema completo, migraciones, semilla, `/api/health` | `db:migrate` y `db:seed` funcionan |
| **2. Diseño** | `docs/DISENO.md`, tokens, tema claro/oscuro, presets de motion, shell (sidebar, topbar, ⌘K, notificaciones vacías), estados vacío/carga/error/403 | Mi aprobación visual |
| **3. Autenticación y roles** | Better Auth, registro por pasos, verificación, login, recuperación, perfil, middleware, `can()` + guards, redirección por rol, auditoría de auth | E2E de auth en verde |
| **4. Tickets** | Tipos y plantillas, `TicketFormFactory`, crear, mis solicitudes, detalle con hilo, línea de tiempo y SLA, adjuntos, máquina de estados, notificaciones | E2E profesor/estudiante en verde |
| **5. Tareas y equipos** | Kanban y lista, evidencia, progreso del auxiliar, panel del líder, delegación | E2E auxiliar/líder en verde |
| **6. Docente** | Panel con KPIs y semáforo, bandeja global, asignación, gestión de auxiliares y equipos, editor de plantillas, SLA, exportación | E2E docente en verde |
| **7. Admin** | Consola, usuarios, auditoría con diff, "ver como", salud del sistema, ajustes | E2E admin en verde |
| **8. Pulido** | Revisión de accesibilidad y responsive, animaciones finas, rendimiento (Lighthouse ≥ 90 en las páginas principales), README completo | Checklist de terminado |

---

## 15. Definición de terminado

- [ ] Los 6 roles inician sesión y ven **solo** lo que la matriz permite (verificado en UI **y** en servidor con pruebas).
- [ ] Todas las historias HU-01 a HU-62 cumplen sus criterios de aceptación.
- [ ] Cada cambio relevante deja rastro en `audit_log` y se ve en la línea de tiempo.
- [ ] El semáforo y el % de cumplimiento coinciden con las reglas de la sección 5.5 (pruebas unitarias).
- [ ] Funciona bien en móvil (375 px), tablet y escritorio, en modo claro y oscuro.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pasan sin errores.
- [ ] `README.md` incluye: descripción, stack, arquitectura (diagrama Mermaid), cómo correr en local, usuarios de prueba, scripts, estructura de carpetas, cómo agregar un tipo de ticket, y **pasos para subir a GitHub y desplegar en Vercel** (crear repo, `git remote add`, importar en Vercel, variables de entorno, integración Neon, Vercel Blob, Vercel Cron y dominio).
- [ ] `docs/` contiene `DECISIONES.md`, `DISENO.md`, `BASE_DE_DATOS.md` y `PERMISOS.md` (la matriz).

Empieza ahora con la **Fase 0**: lista y carga las skills de diseño disponibles, revisa este documento y preséntame el plan.
