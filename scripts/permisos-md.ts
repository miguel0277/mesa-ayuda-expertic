/**
 * Genera docs/PERMISOS.md a partir de la matriz de permisos (única fuente de verdad).
 * Uso: pnpm tsx scripts/permisos-md.ts
 */
import { writeFileSync } from "node:fs";
import { ACTIONS, PERMISSION_MATRIX } from "@/shared/auth/permissions";
import { ROLE_LABEL, ROLES } from "@/shared/auth/roles";

const CONDITION: Record<string, string> = {
  own: "propias",
  assigned: "asignadas",
  inLedTeam: "de su equipo",
  targetInLedTeam: "de su equipo",
  assignedOrTeam: "asignadas o de su equipo",
};

const cell = (rule: unknown) =>
  rule === true
    ? "✅"
    : rule === false
      ? "—"
      : `🔸 ${CONDITION[(rule as { name?: string }).name ?? ""] ?? "con condición"}`;

const head = `| Acción | ${ROLES.map((r) => ROLE_LABEL[r]).join(" | ")} |`;
const sep = `|---|${ROLES.map(() => ":-:").join("|")}|`;
const rows = ACTIONS.map(
  (a) => `| \`${a}\` | ${ROLES.map((r) => cell(PERMISSION_MATRIX[a][r])).join(" | ")} |`,
);

writeFileSync(
  "docs/PERMISOS.md",
  `# Matriz de permisos

> Archivo generado con \`pnpm tsx scripts/permisos-md.ts\` desde
> \`src/shared/auth/permissions.ts\`. No lo edites a mano.

✅ permitido · — no permitido · 🔸 permitido solo sobre los recursos indicados.

La matriz se aplica en tres capas: el **proxy** (403 por ruta según el rol de la sesión),
las **páginas** (\`requireRoute\`) y los **casos de uso** (\`can(actor, acción, recurso)\`), que
es la que cuenta: aunque alguien llame una acción del servidor directamente, se valida ahí.
Las pruebas de \`permissions.test.ts\` recorren toda la matriz.

${head}
${sep}
${rows.join("\n")}
`,
);
console.log(`docs/PERMISOS.md: ${ACTIONS.length} acciones × ${ROLES.length} roles`);
