# Plan de trabajo — Mesa de Ayuda ExperTIC (Iteración 1)

Especificación completa: [PROMPT_MAESTRO.md](PROMPT_MAESTRO.md). Ajustes a la especificación: [DECISIONES.md](DECISIONES.md).
Cada fase cierra con `pnpm typecheck && pnpm lint && pnpm test` en verde, un resumen y tu "continúa".

## Fase 1 · Cimientos ✅ (10/11/2026)

1. `create-next-app` (Next 16, TS strict, App Router, `src/`, Tailwind v4, ESLint) con pnpm.
2. Prettier, Husky + lint-staged, `.editorconfig`, workflow `.github/workflows/ci.yml` (solo archivo).
3. `src/env.ts` con Zod (falla al arrancar con mensaje claro) y `.env.example` documentado.
4. Estructura de carpetas `modules/*/{domain,application,infrastructure,ui}` y `shared/*`.
5. `shared/domain`: `Result<T,E>`, errores de dominio. `shared/kernel`: `Clock`, `IdGenerator` (UUID v7), `EventBus`, `container.ts`.
6. Drizzle + Neon: cliente pooled (app) y config unpooled (migraciones). Esquema completo de la sección 4 con los ajustes D-003/D-005/D-006: enums, tablas, índices, secuencia para `EXP-AAAA-NNNNN`, vistas `v_task_compliance` y `v_ticket_sla`.
7. Migración inicial, `db:seed` realista (usuarios por rol, 6 categorías con plantillas, SLA, ~40 tickets, ~60 tareas con los 3 colores del semáforo).
8. `/api/health` (`select 1`), logger `pino` con `requestId`, `docs/BASE_DE_DATOS.md`.
   **Cierre:** `db:migrate` y `db:seed` funcionan contra tu rama `dev` de Neon.

## Fase 2 · Diseño ✅ (10/11/2026)

Cargo `frontend-design`, `ui-ux-pro-max`, `shadcn`, `web-design-guidelines`, `vercel-react-best-practices`, `dataviz`.
`docs/DISENO.md` (dirección visual con azul `#1673BB` / verde `#85BE53`), tokens en `globals.css`, tema claro/oscuro/sistema, `shared/ui/motion.ts`, shell (sidebar por rol, topbar, ⌘K, campana vacía, migas), estados vacío/carga/error/403. **Cierre:** tu aprobación visual (con capturas).

## Fase 3 · Autenticación y roles

Better Auth (email+contraseña, verificación, admin plugin, rate limit), registro por pasos con aviso Ley 1581, login, recuperación, perfil, middleware + `requestId`, `can()` con matriz completa (+ `ticket.priority`), guards, redirección por rol, aprobación de cuentas pendientes, auditoría de auth. **Cierre:** E2E de auth.

## Fase 4 · Tickets

Plantillas y `TicketFormFactory` (Zod + formulario desde el mismo JSON), crear ticket con adjuntos (`StorageProvider`), mis solicitudes, detalle (hilo, notas internas, autor y fecha visibles, línea de tiempo, SLA con contador), máquina de estados, cambio de prioridad con recálculo de SLA, calificación, notificaciones y correo. **Cierre:** E2E profesor/estudiante.

## Fase 5 · Tareas y equipos (módulo separado de tickets)

Kanban (`@dnd-kit`, optimista) y lista, evidencia obligatoria, semáforo (función pura), mi progreso y racha, tickets asignados, panel del líder y delegación. **Cierre:** E2E auxiliar/líder.

## Fase 6 · Docente

Panel KPIs con vistas SQL y caché, bandeja global con filtros en URL y acciones en lote, crear/asignar tareas, gestión de auxiliares/equipos/semestres y desactivación en bloque, editor visual de plantillas, SLA y festivos, exportación CSV/Excel. **Cierre:** E2E docente.

## Fase 7 · Admin

Consola, usuarios (crear, bloquear, rol, restablecer), auditoría con diff, "Ver como" con banner, salud del sistema, ajustes, cron `/api/cron/sla` + `vercel.json`. **Cierre:** E2E admin.

## Fase 8 · Pulido

Accesibilidad y responsive (375 px), animaciones finas, Lighthouse ≥ 90, README con Mermaid y guía GitHub + Vercel, `docs/PERMISOS.md`. **Cierre:** checklist de terminado.

## Lo que necesito de ti y cuándo

| Cuándo        | Qué                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Fin de Fase 1 | Cadenas de Neon (`dev`): pooled y directa, pegadas por ti en `.env.local`. Opcional: una rama `test` para integración. |
| Fin de Fase 1 | `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` (cualquier dominio).                                                        |
| Fase 2        | Aprobar la dirección visual.                                                                                           |
| Fase 3        | Texto oficial del aviso de tratamiento de datos, si existe (si no, uso uno provisional).                               |
| Despliegue    | Resend y Vercel Blob (no hacen falta para desarrollar).                                                                |
