# Mesa de Ayuda ExperTIC

Solicitudes de soporte (tickets) y seguimiento de tareas de auxiliares para ExperTIC, Universidad Industrial de Santander.

> Iteración 1 en construcción. Estado por fases: [docs/PLAN.md](docs/PLAN.md). El README completo (arquitectura, despliegue en Vercel, cómo agregar un tipo de ticket) llega en la Fase 8.

## Requisitos

- Node.js ≥ 20.9 (recomendado 22) y pnpm 10
- Un proyecto en Neon: ver [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md)

## Arranque local

```bash
pnpm install
cp .env.example .env.local      # completa las cadenas de Neon y el admin inicial
pnpm db:migrate
pnpm db:seed
pnpm dev                        # http://localhost:3000  ·  salud: /api/health
```

## Usuarios de prueba (solo con `pnpm db:seed`)

Contraseña de todos: `ExperTIC-2026*`

| Rol              | Correo                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Docente ExperTIC | `docente@expertic.test`                                                                     |
| Auxiliar líder   | `lider1@expertic.test`, `lider2@expertic.test`                                              |
| Auxiliar         | `aux1@expertic.test` … `aux6@expertic.test`                                                 |
| Profesor         | `profesor1@expertic.test` … `profesor5@expertic.test` (`profesor5` pendiente de aprobación) |
| Estudiante       | `estudiante1@expertic.test` … `estudiante10@expertic.test` (`estudiante10` pendiente)       |
| Administrador    | el de `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`                                            |

## Scripts

| Script                               | Qué hace                                                           |
| ------------------------------------ | ------------------------------------------------------------------ |
| `pnpm dev` / `build` / `start`       | Next.js                                                            |
| `pnpm lint` / `typecheck` / `format` | Calidad de código                                                  |
| `pnpm test`                          | Vitest: unitarias + integración con PostgreSQL en memoria (PGlite) |
| `pnpm test:e2e`                      | Playwright (desde la Fase 3)                                       |
| `pnpm db:generate`                   | Genera una migración SQL a partir del esquema                      |
| `pnpm db:migrate`                    | Aplica las migraciones (conexión directa de Neon)                  |
| `pnpm db:seed`                       | Semilla (`--reset`, `--solo-catalogo`)                             |
| `pnpm db:studio`                     | Explorador visual de la base de datos                              |

## Documentación

- [docs/PROMPT_MAESTRO.md](docs/PROMPT_MAESTRO.md): especificación
- [docs/DECISIONES.md](docs/DECISIONES.md): decisiones y cambios a la especificación
- [docs/PLAN.md](docs/PLAN.md): fases
- [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md): Neon, migraciones y semilla
