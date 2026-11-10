/**
 * Política de archivos subidos (sección 9): lista blanca de MIME, tamaño máximo,
 * verificación de la firma real del archivo y nombre saneado.
 * Funciones puras (probadas en file-policy.test.ts).
 */

export type FileCheck =
  { ok: true; mime: string; safeName: string } | { ok: false; reason: string };

/** Firmas ("magic bytes") de los formatos binarios permitidos. */
const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
];

/** Formatos de Office modernos: son ZIP por dentro. */
const ZIP_BASED = new Set([
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const TEXT_BASED = new Set(["text/plain", "text/csv"]);

export function sniff(bytes: Uint8Array): string | null {
  for (const s of SIGNATURES) {
    const off = s.offset ?? 0;
    if (s.bytes.every((b, i) => bytes[off + i] === b)) return s.mime;
  }
  return null;
}

/** ¿El contenido coincide con el tipo declarado? */
function contentMatches(declared: string, bytes: Uint8Array): boolean {
  const detected = sniff(bytes);
  if (ZIP_BASED.has(declared)) return detected === "application/zip";
  if (TEXT_BASED.has(declared)) {
    // Texto: sin bytes nulos en el primer bloque y sin firma binaria conocida.
    const head = bytes.subarray(0, 4096);
    return detected === null && !head.includes(0);
  }
  return detected === declared;
}

/** Nombre seguro: sin rutas, sin caracteres de control, longitud acotada, extensión conservada. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "archivo";
  const cleaned = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();
  if (!cleaned) return "archivo";
  if (cleaned.length <= 120) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot).slice(0, 10) : "";
  return cleaned.slice(0, 120 - ext.length) + ext;
}

/** ¿El MIME declarado está permitido por la lista (admite comodines tipo "image/*")? */
export function mimeAllowed(mime: string, allowed: readonly string[]): boolean {
  return allowed.some((a) => (a.endsWith("/*") ? mime.startsWith(a.slice(0, -1)) : a === mime));
}

export function checkFile(
  file: { name: string; type: string; size: number },
  bytes: Uint8Array,
  opts: { allowedMime: readonly string[]; maxBytes: number; accept?: readonly string[] },
): FileCheck {
  const mime = file.type || "application/octet-stream";
  if (file.size <= 0 || bytes.byteLength === 0)
    return { ok: false, reason: `"${file.name}" está vacío.` };
  if (file.size > opts.maxBytes)
    return {
      ok: false,
      reason: `"${file.name}" supera el máximo de ${Math.round(opts.maxBytes / 1024 / 1024)} MB.`,
    };
  if (!mimeAllowed(mime, opts.allowedMime) || (opts.accept && !mimeAllowed(mime, opts.accept)))
    return { ok: false, reason: `"${file.name}" no es un tipo de archivo permitido.` };
  if (!contentMatches(mime, bytes))
    return { ok: false, reason: `El contenido de "${file.name}" no corresponde a su tipo.` };
  return { ok: true, mime, safeName: sanitizeFileName(file.name) };
}

/** Clave de almacenamiento: no adivinable y sin el nombre original (que va en la BD). */
export function storageKey(prefix: string, id: string, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${y}/${m}/${id}`;
}
