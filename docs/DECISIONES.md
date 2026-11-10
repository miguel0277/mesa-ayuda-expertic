# Registro de decisiones

Cada decisión indica su origen: **[Usuario]** si la tomaste tú, **[Propuesta]** si la tomé yo por ambigüedad (puedes vetarla).

---

## D-001 · Correos de cualquier dominio — [Usuario] 10/11/2026
`ALLOWED_EMAIL_DOMAINS` pasa a ser **opcional**. Vacío = se acepta cualquier dominio. Si algún día se quiere restringir, basta con llenarla (ej. `uis.edu.co,correo.uis.edu.co`).

## D-002 · Todo registro público queda pendiente de aprobación — [Propuesta]
Como ya no hay filtro por dominio y la plataforma es para personas específicas, **estudiantes y profesores** quedan en estado `pendiente` tras verificar su correo hasta que un docente o admin los apruebe. (El prompt original solo lo exigía a profesores.) Se controla con el ajuste `registration.requireApproval` en `app_settings` (por defecto `true`, ambos roles).

## D-003 · Seis categorías de ticket — [Usuario] + [Propuesta]
Los tickets son **solo para solicitar soporte de los servicios** de ExperTIC. Categorías iniciales:

| # | Categoría | Prioridad por defecto | Origen |
|---|---|---|---|
| 1 | Errores de Moodle | alta | Usuario |
| 2 | Lecciones sin información | media | Usuario |
| 3 | Preguntas y reclamos | media | Usuario |
| 4 | Solicitud al equipo de sistemas | media | Usuario |
| 5 | Acceso y matrícula a cursos | alta | Propuesta |
| 6 | Otra solicitud | baja | Propuesta |

Las categorías 5 y 6 son propuesta mía para completar las 6; se cambian desde el editor de plantillas (HU-44) sin tocar código. Los campos de cada plantilla se definen en la semilla (curso, enlace a la lección, captura de pantalla, etc.).

## D-004 · Tickets y tareas son secciones separadas — [Usuario]
Las **tareas** (actividades que el docente asigna a auxiliares) **no** son tickets ni aparecen en la bandeja de tickets. Viven en su propio módulo, menú y rutas (`/tareas`, `/panel/tareas`). Una tarea *puede* vincularse opcionalmente a un ticket (por ejemplo, "corregir la lección X" a raíz de un ticket), pero nunca al revés ni de forma obligatoria.

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
- El logo oficial no se incrusta; se usa logotipo tipográfico "ExperTIC" con los dos colores (según el prompt). Si prefieres usar la imagen real del logo, dímelo y la añado en `public/`.

## D-009 · Sin Docker — [Propuesta]
No hay Docker en el equipo. Las pruebas de integración corren contra una **rama de Neon `test`** (`DATABASE_URL_TEST`). El `docker-compose.yml` queda como opcional.

## D-010 · Versiones del stack — [Propuesta]
Versiones estables al 10/11/2026: Next.js 16.4, React 19.3, Better Auth 1.7, Drizzle ORM 0.45 / drizzle-kit 0.31, Neon serverless 1.2, Tailwind 4.3, Motion 14, Zod 4, Vitest 5, Playwright 1.65, nuqs 2.10. Node 20.19 local (compatible).

## D-011 · Skills instaladas — [Usuario]
Instaladas globalmente: `ui-ux-pro-max`, `web-design-guidelines`, `shadcn`, `vercel-react-best-practices`. Además disponibles: `frontend-design`, `dataviz`, `webapp-testing`. Se usan desde la Fase 2.
