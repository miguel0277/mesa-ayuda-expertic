# Registro de decisiones

Cada decisión indica su origen: **[Usuario]** si la tomaste tú, **[Propuesta]** si la tomé yo por ambigüedad (puedes vetarla).

---

## D-001 · Correos de cualquier dominio — [Usuario] 10/11/2026

`ALLOWED_EMAIL_DOMAINS` pasa a ser **opcional**. Vacío = se acepta cualquier dominio. Si algún día se quiere restringir, basta con llenarla (ej. `uis.edu.co,correo.uis.edu.co`).

## D-002 · Aprobación solo para roles de personal — [Usuario] 10/11/2026

- **Estudiante y profesor** se registran solos: quedan **activos** apenas verifican su correo, sin aprobación de nadie.
- **Auxiliar, auxiliar líder y docente ExperTIC** se pueden **solicitar** al registrarse, pero la cuenta queda `pendiente` hasta que un **administrador** la apruebe. Mientras tanto no tiene acceso a la app.
- Se configura con los ajustes `registration.selfServiceRoles` y `registration.approvalRoles` en `app_settings`.
- Esto amplía la sección 5.2 del prompt, donde el registro público solo ofrecía estudiante y profesor. El rol Admin nunca se puede pedir al registrarse.

## D-003 · Seis categorías de ticket — [Usuario] (aprobadas 10/11/2026)

Los tickets son **solo para solicitar soporte de los servicios** de ExperTIC. Categorías iniciales:

| #   | Categoría                       | Prioridad por defecto | Origen    |
| --- | ------------------------------- | --------------------- | --------- |
| 1   | Errores de Moodle               | alta                  | Usuario   |
| 2   | Lecciones sin información       | media                 | Usuario   |
| 3   | Preguntas y reclamos            | media                 | Usuario   |
| 4   | Solicitud al equipo de sistemas | media                 | Usuario   |
| 5   | Acceso y matrícula a cursos     | alta                  | Propuesta |
| 6   | Otra solicitud                  | baja                  | Propuesta |

Las categorías 5 y 6 fueron propuestas y **aprobadas** por el usuario; se cambian desde el editor de plantillas (HU-44) sin tocar código. Los campos de cada plantilla se definen en la semilla (curso, enlace a la lección, captura de pantalla, etc.).

## D-004 · Tickets y tareas son secciones separadas — [Usuario]

Las **tareas** (actividades que el docente asigna a auxiliares) **no** son tickets ni aparecen en la bandeja de tickets. Viven en su propio módulo, menú y rutas (`/tareas`, `/panel/tareas`). Una tarea _puede_ vincularse opcionalmente a un ticket (por ejemplo, "corregir la lección X" a raíz de un ticket), pero nunca al revés ni de forma obligatoria.

## D-005 · Sin edificios ni salones — [Usuario]

Se elimina la columna `tickets.location` y los campos edificio/salón de las plantillas.

## D-006 · Prioridad: el solicitante sugiere, el docente/líder decide — [Usuario] + [Propuesta]

- El solicitante elige una prioridad al crear (por defecto la de la categoría).
- **Docente, auxiliar líder y admin** pueden cambiarla en cualquier momento (permiso nuevo `ticket.priority`; el líder solo en tickets de su equipo).
- Al cambiarla se **recalculan los vencimientos de SLA** desde la fecha de creación, se audita (`ticket.priority_changed`, antes/después) y se notifica al asignado.

## D-007 · Registro visible de autoría y fecha — [Usuario]

Cada ticket muestra siempre **quién lo creó** (nombre, rol, correo) y **cuándo** (fecha y hora `dd/MM/yyyy hh:mm a. m.`, zona `America/Bogota`), además de la línea de tiempo con quién hizo cada cambio y cuándo. Ya está cubierto por `requester_id`, `created_at`, `created_by` y `audit_log`; se refuerza en la UI (cabecera del detalle, columnas de la bandeja y exportación CSV/Excel).

## D-008 · Marca basada en el logo de ExperTIC — [Usuario]

Colores extraídos del logo: **azul `#1673BB`**, **verde `#85BE53`**, texto casi negro.

- Azul = color primario (botones, enlaces, foco).
- Verde = acento (estados positivos, ilustraciones, detalles). El verde puro sobre blanco tiene contraste ~2.3:1, así que **no se usa para texto**; para texto se usa una variante oscura que cumpla AA.
- **Se usa la imagen real del logo** (`public/brand/logo-expertic.png`, PNG transparente 447×120) por indicación del usuario, en lugar del logotipo tipográfico que sugería el prompt.

## D-009 · Sin Docker — [Propuesta]

No hay Docker en el equipo. Las pruebas de integración corren contra una **rama de Neon `test`** (`DATABASE_URL_TEST`). El `docker-compose.yml` queda como opcional.

## D-010 · Versiones del stack — [Propuesta]

Versiones estables al 10/11/2026: Next.js 16.4, React 19.3, Better Auth 1.7, Drizzle ORM 0.45 / drizzle-kit 0.31, Neon serverless 1.2, Tailwind 4.3, Motion 14, Zod 4, Vitest 5, Playwright 1.65, nuqs 2.10. Node 20.19 local (compatible).

## D-011 · Skills instaladas — [Usuario]

Instaladas globalmente: `ui-ux-pro-max`, `web-design-guidelines`, `shadcn`, `vercel-react-best-practices`. Además disponibles: `frontend-design`, `dataviz`, `webapp-testing`. Se usan desde la Fase 2.

## D-012 · El avatar usa la columna `image` de Better Auth — [Propuesta]

El prompt pedía `avatar_url`; Better Auth ya trae `user.image` para lo mismo. Se usa esa para no duplicar datos.

## D-013 · Bandeja de salida de correo (`email_outbox`) — [Propuesta]

Para cumplir "si el correo falla no rompe la operación y se reintenta" (sección 10), los correos se encolan en `email_outbox` y el cron los envía con reintentos y espera creciente. Tabla nueva, no estaba en el prompt.

## D-014 · Otras columnas añadidas — [Propuesta]

- `user.data_consent_at` / `data_consent_version`: registro de aceptación del aviso de datos (sección 9).
- `user.approved_at` / `approved_by`: quién aprobó la cuenta y cuándo.
- `tickets.last_activity_at`: base para el autocierre por inactividad.
- `tasks.cancelled_at`: fecha de cancelación.
- `user.banned`, `ban_reason`, `ban_expires` y `session.impersonated_by`: los exige el plugin admin de Better Auth.

## D-015 · Driver de Neon por WebSocket (no HTTP) — [Propuesta]

Los casos de uso necesitan **transacciones interactivas** y el driver HTTP de Neon no las soporta. Se usa `drizzle-orm/neon-serverless` (Pool por WebSocket) con la cadena pooled. Las migraciones y la semilla usan scripts propios (`scripts/db-*.ts`) con la cadena directa.

## D-016 · Pruebas de integración con PGlite — [Propuesta] (reemplaza a D-009)

En lugar de una rama `test` de Neon o Docker, las pruebas de integración usan **PGlite** (PostgreSQL 17 compilado a WebAssembly, en memoria) con las mismas migraciones. Son rápidas, deterministas y corren en CI sin secretos. Las pruebas E2E (Playwright) sí usan la rama `dev` de Neon.

## D-017 · Códigos de ticket y tarea con secuencias de Postgres — [Propuesta]

`EXP-AAAA-NNNNN` y `TAR-AAAA-NNNNN`: el año sale de la fecha de creación (hora de Bogotá) y el número de una secuencia global que **no se reinicia cada año**, así el código nunca se repite. Reiniciar por año exigiría una tabla de contadores; se puede cambiar si lo prefieres.

## D-018 · Horas hábiles y festivos calculados — [Propuesta]

Los festivos de Colombia se **calculan** con la Ley Emiliani y la fecha de Pascua (`shared/lib/holidays-co.ts`), sin tablas que haya que actualizar cada año. Se pueden añadir fechas extra desde el ajuste `sla.extraHolidays`, por ejemplo cierres de la UIS. Se adelantó a la Fase 1 porque la semilla necesita calcular el SLA.

## D-019 · Proxy en lugar de middleware — [Propuesta]

Next.js 16 renombró `middleware.ts` a `proxy.ts` (misma función). Se usa `src/proxy.ts`.

## D-020 · Semilla segura para producción — [Propuesta]

`pnpm db:seed --solo-catalogo` crea solo el admin y los catálogos (categorías, SLA, ajustes), sin datos falsos, y es idempotente. Si el entorno es de producción, el script se niega a sembrar la demostración o a vaciar tablas.

## D-021 · Contraseña mínima de 8 caracteres — [Usuario] 10/11/2026

Igual que el mínimo por defecto de Better Auth. La contraseña provisional del admin debe cambiarse antes de salir a producción.

## D-022 · `cn` de shadcn en lugar de `clsx` + `tailwind-merge` — [Propuesta]

shadcn 4 genera `cn()` desde el paquete `cn` (publicado por shadcn, repositorio `shadcn-ui/cn`): es un reemplazo compilado y más liviano de `clsx` + `tailwind-merge`, con el mismo resultado. Se reexporta desde `src/shared/lib/utils.ts`.

## D-023 · Componentes de shadcn en `src/shared/ui` — [Propuesta]

`components.json` apunta a `@/shared/ui/components` (primitivas de shadcn con Radix) y a `@/shared/lib/utils`, siguiendo la estructura de la sección 3 del prompt.

## D-024 · Fechas con `Intl`, no con TZDate, en la interfaz — [Propuesta]

Con Cache Components (Next 16), `TZDate` crea un `new Date()` interno que rompe el prerenderizado. El formateo de fechas (`shared/lib/dates.ts`) usa `Intl.DateTimeFormat` con `America/Bogota`. TZDate sigue usándose solo en el cálculo de horas hábiles, que corre en servidor y en peticiones dinámicas.

## D-025 · Página de muestra `/diseno` solo en desarrollo — [Propuesta]

Para aprobar la dirección visual con algo real y no solo con un documento. En producción responde 404 (verificado). Sus datos son de muestra y viven dentro de esa ruta, no en la base.

## D-026 · Logo para fondos oscuros derivado del oficial — [Usuario] 10/11/2026

No existe versión oficial para fondos oscuros. Se generó una a partir del PNG oficial, cambiando solo el color de las letras: "TIC" de negro a `#E4EBF2` y "Exper" al azul aclarado `#4A9EE0`. El ícono SEA no se toca. Si ExperTIC entrega una versión oficial, basta con reemplazar `public/brand/logo-expertic-oscuro.png`. El isotipo (círculo SEA) se recortó del mismo logo para el sidebar colapsado y el favicon.

## D-027 · Visitante de desarrollo hasta la Fase 3 — [Superada en Fase 3]

Sin autenticación todavía, `getViewer()` (`shared/auth/viewer.ts`) devuelve un usuario de prueba **solo en desarrollo**, con el rol tomado de la cookie `dev_rol` ("Ver como" en el menú de usuario). En producción no hay visitante y se redirige a `/login`. La Fase 3 reemplaza esa función por la sesión de Better Auth, sin tocar las páginas.

## D-028 · El código HTTP 403 se fija en el `proxy` (Fase 3) — [Implementada]

Hoy, cuando una página llama a `forbidden()`, se muestra la página amable de "sin acceso", pero el código HTTP sale 200. Con _streaming_, Next ya envió la cabecera antes de llegar a la página (comportamiento documentado). En la Fase 3 el `proxy` leerá el rol de la sesión y rechazará con 403 antes de renderizar. Las guardias de servidor en cada página y acción se mantienen como segunda barrera.

## D-029 · Transición de página con CSS, no con Motion — [Implementada]

Con Motion, el HTML del servidor sale con `opacity: 0` y el contenido queda invisible hasta que hidrata el JavaScript, lo que empeora el LCP y afecta la meta de Lighthouse ≥ 90. La entrada de página usa `tw-animate-css` (fundido + 8 px, 220 ms). Motion queda para microinteracciones, el Kanban y los contadores.

**Cómo quedó (D-028):** el `proxy` lee el rol con `getCookieCache` (pasando `isSecure` según el protocolo de la petición, para que funcione también con `next start` en HTTP) y responde directamente un HTML 403. Un `rewrite` a la página de "sin acceso" perdía el código 403.

## D-030 · Cron diario en el plan Hobby de Vercel — [Implementada]

`vercel.json` programa `/api/cron/sla` a las `0 12 * * *` (7:00 a. m. en Bogotá): avisos de tareas por vencer, autocierre de solicitudes respondidas y reintento de correos pendientes. El plan Hobby solo permite una ejecución diaria; con el plan Pro se puede subir a cada hora sin cambiar código.

## D-031 · Límite de intentos relajado solo para E2E — [Implementada]

Las pruebas E2E entran con varios roles seguidos y chocaban con el límite de 5 inicios por minuto. `E2E_RELAXED_RATE_LIMIT=1` (lo pone `playwright.config.ts` al levantar el servidor) sube ese límite; `src/env.ts` rechaza la variable si `VERCEL_ENV=production`.

## D-032 · Datos de demostración realistas — [Implementada]

La semilla reparte el semáforo (mayoría a tiempo, algunas en riesgo, pocas atrasadas), resuelve ~80 % de las solicitudes dentro del SLA y fija `resolvedAt` al responder, igual que el dominio (`timestampsFor`). Así el panel muestra cifras creíbles en una demostración.
