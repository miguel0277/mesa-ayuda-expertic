# Matriz de permisos

> Archivo generado con `pnpm tsx scripts/permisos-md.ts` desde
> `src/shared/auth/permissions.ts`. No lo edites a mano.

✅ permitido · — no permitido · 🔸 permitido solo sobre los recursos indicados.

La matriz se aplica en tres capas: el **proxy** (403 por ruta según el rol de la sesión),
las **páginas** (`requireRoute`) y los **casos de uso** (`can(actor, acción, recurso)`), que
es la que cuenta: aunque alguien llame una acción del servidor directamente, se valida ahí.
Las pruebas de `permissions.test.ts` recorren toda la matriz.

| Acción                 | Administrador | Docente ExperTIC |       Auxiliar líder        |     Auxiliar     |  Profesor  | Estudiante |
| ---------------------- | :-----------: | :--------------: | :-------------------------: | :--------------: | :--------: | :--------: |
| `ticket.create`        |      ✅       |        ✅        |             ✅              |        ✅        |     ✅     |     ✅     |
| `ticket.read.own`      |  🔸 propias   |    🔸 propias    |         🔸 propias          |    🔸 propias    | 🔸 propias | 🔸 propias |
| `ticket.read.assigned` |      ✅       |        ✅        |        🔸 asignadas         |   🔸 asignadas   |     —      |     —      |
| `ticket.read.team`     |      ✅       |        ✅        |       🔸 de su equipo       |        —         |     —      |     —      |
| `ticket.read.all`      |      ✅       |        ✅        |              —              |        —         |     —      |     —      |
| `ticket.assign`        |      ✅       |        ✅        |       🔸 de su equipo       |        —         |     —      |     —      |
| `ticket.reply`         |      ✅       |        ✅        |      🔸 con condición       | 🔸 con condición | 🔸 propias | 🔸 propias |
| `ticket.status`        |      ✅       |        ✅        |      🔸 con condición       | 🔸 con condición | 🔸 propias | 🔸 propias |
| `ticket.priority`      |      ✅       |        ✅        |       🔸 de su equipo       |        —         |     —      |     —      |
| `ticket.internal_note` |      ✅       |        ✅        | 🔸 asignadas o de su equipo |   🔸 asignadas   |     —      |     —      |
| `ticket.rate`          |  🔸 propias   |    🔸 propias    |         🔸 propias          |    🔸 propias    | 🔸 propias | 🔸 propias |
| `task.create`          |      ✅       |        ✅        |       🔸 de su equipo       |        —         |     —      |     —      |
| `task.assign`          |      ✅       |        ✅        |       🔸 de su equipo       |        —         |     —      |     —      |
| `task.read.own`        |      ✅       |        ✅        |        🔸 asignadas         |   🔸 asignadas   |     —      |     —      |
| `task.read.team`       |      ✅       |        ✅        |       🔸 de su equipo       |        —         |     —      |     —      |
| `task.read.all`        |      ✅       |        ✅        |              —              |        —         |     —      |     —      |
| `task.update.own`      |      ✅       |        —         |        🔸 asignadas         |   🔸 asignadas   |     —      |     —      |
| `task.complete`        |      ✅       |        —         |        🔸 asignadas         |   🔸 asignadas   |     —      |     —      |
| `task.cancel`          |      ✅       | 🔸 con condición |      🔸 con condición       |        —         |     —      |     —      |
| `dashboard.global`     |      ✅       |        ✅        |              —              |        —         |     —      |     —      |
| `dashboard.team`       |      ✅       |        ✅        |             ✅              |        —         |     —      |     —      |
| `templates.manage`     |      ✅       |        ✅        |              —              |        —         |     —      |     —      |
| `sla.manage`           |      ✅       |        ✅        |              —              |        —         |     —      |     —      |
| `users.read`           |      ✅       |        ✅        |              —              |        —         |     —      |     —      |
| `users.manage`         |      ✅       | 🔸 con condición |              —              |        —         |     —      |     —      |
| `users.approve`        |      ✅       |        —         |              —              |        —         |     —      |     —      |
| `roles.grant.admin`    |      ✅       |        —         |              —              |        —         |     —      |     —      |
| `audit.read`           |      ✅       |        ✅        |       🔸 de su equipo       |        —         |     —      |     —      |
| `admin.impersonate`    |      ✅       |        —         |              —              |        —         |     —      |     —      |
| `settings.manage`      |      ✅       |        —         |              —              |        —         |     —      |     —      |
| `reports.export`       |      ✅       |        ✅        |              —              |        —         |     —      |     —      |
| `system.health`        |      ✅       |        —         |              —              |        —         |     —      |     —      |
