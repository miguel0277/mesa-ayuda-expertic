import { getSettings } from "@/shared/config/settings-service";
import type { DbExecutor } from "@/shared/db/types";
import type { AttachmentOwner } from "@/shared/db/schema/enums";
import { validationError, type DomainError } from "@/shared/domain/errors";
import { err, ok, type Result } from "@/shared/domain/result";
import type { IdGenerator } from "@/shared/kernel/id";
import { checkFile, storageKey } from "./file-policy";
import type { StorageProvider } from "./provider";

/** Archivo recibido del navegador, ya leído en memoria. */
export type IncomingFile = { name: string; type: string; size: number; bytes: Uint8Array };

export type AttachmentRow = {
  id: string;
  ownerType: AttachmentOwner;
  ownerId: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  storageKey: string;
  uploadedBy: string;
  createdAt: Date;
};

/** Lee los `File` de un FormData (Server Action) a memoria. */
export async function readFormFiles(form: FormData, field: string): Promise<IncomingFile[]> {
  const files = form
    .getAll(field)
    .filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  return Promise.all(
    files
      .filter((f) => f.size > 0)
      .map(async (f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        bytes: new Uint8Array(await f.arrayBuffer()),
      })),
  );
}

/**
 * Valida TODOS los archivos antes de guardar el primero (si uno falla, no queda nada huérfano),
 * los guarda en el StorageProvider y devuelve las filas para `attachments`.
 */
export async function storeUploads(
  deps: { db: DbExecutor; storage: StorageProvider; ids: IdGenerator },
  files: IncomingFile[],
  opts: {
    ownerType: AttachmentOwner;
    ownerId: string;
    uploadedBy: string;
    now: Date;
    accept?: readonly string[];
    maxFiles?: number;
    label?: string;
  },
): Promise<Result<AttachmentRow[], DomainError>> {
  if (!files.length) return ok([]);
  if (opts.maxFiles !== undefined && files.length > opts.maxFiles) {
    return err(validationError(`${opts.label ?? "Adjuntos"}: máximo ${opts.maxFiles} archivo(s).`));
  }
  const s = await getSettings(deps.db, ["attachments.allowedMime", "attachments.maxSizeMB"]);
  const checked = [];
  for (const f of files) {
    const r = checkFile(f, f.bytes, {
      allowedMime: s["attachments.allowedMime"],
      maxBytes: s["attachments.maxSizeMB"] * 1024 * 1024,
      accept: opts.accept,
    });
    if (!r.ok) return err(validationError(r.reason));
    checked.push({ file: f, mime: r.mime, safeName: r.safeName });
  }
  const rows: AttachmentRow[] = [];
  for (const { file, mime, safeName } of checked) {
    const id = deps.ids.next();
    const key = storageKey(opts.ownerType, id, opts.now);
    await deps.storage.put(key, file.bytes, mime);
    rows.push({
      id,
      ownerType: opts.ownerType,
      ownerId: opts.ownerId,
      fileName: safeName,
      mime,
      sizeBytes: file.size,
      storageKey: key,
      uploadedBy: opts.uploadedBy,
      createdAt: opts.now,
    });
  }
  return ok(rows);
}
