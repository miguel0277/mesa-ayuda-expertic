# Mesa de Ayuda ExperTIC

- Especificación maestra: `docs/PROMPT_MAESTRO.md` (léela completa antes de trabajar).
- Decisiones que modifican la especificación: `docs/DECISIONES.md` (prevalecen sobre el prompt maestro).
- Plan y fase actual: `docs/PLAN.md`.
- Trabajo por fases: al cerrar cada una, resumen + esperar "continúa" del usuario. Commits pequeños (Conventional Commits), sin push ni despliegue.
- UI en español (Colombia), fechas `dd/MM/yyyy`, 12 h a. m./p. m., `America/Bogota`.
- Next.js 16 tiene cambios incompatibles con versiones previas: consulta `node_modules/next/dist/docs/` antes de usar una API (ver @AGENTS.md). En Next 16 `middleware.ts` se llama `proxy.ts`.
- Calidad antes de cerrar una fase: `pnpm typecheck && pnpm lint && pnpm test` (y `pnpm build` con `SKIP_ENV_VALIDATION=1`).
