/**
 * Comparación visual "antes / después" de una entrada de auditoría (HU-51).
 * Muestra solo las claves que cambiaron, con valores legibles.
 */
function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime()))
        return new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota",
          dateStyle: "short",
          timeStyle: "short",
        }).format(d);
    }
    return v;
  }
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

export function diffEntries(before: unknown, after: unknown) {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({
      key: k,
      before: k in b ? show(b[k]) : null,
      after: k in a ? show(a[k]) : null,
    }));
}

export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const rows = diffEntries(before, after);
  if (!rows.length)
    return <p className="text-xs text-muted-foreground">Sin cambios de datos registrados.</p>;
  return (
    <table className="w-full table-fixed text-xs">
      <caption className="sr-only">Cambios</caption>
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="w-1/4 pb-1 font-medium">Campo</th>
          <th className="pb-1 font-medium">Antes</th>
          <th className="pb-1 font-medium">Después</th>
        </tr>
      </thead>
      <tbody className="align-top">
        {rows.map((r) => (
          <tr key={r.key} className="border-t">
            <td className="py-1.5 pr-2 font-mono break-words text-muted-foreground">{r.key}</td>
            <td className="py-1.5 pr-2 break-words">
              {r.before === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <del className="rounded bg-late-soft px-1 text-late no-underline">{r.before}</del>
              )}
            </td>
            <td className="py-1.5 break-words">
              {r.after === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <ins className="rounded bg-ok-soft px-1 text-ok no-underline">{r.after}</ins>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
