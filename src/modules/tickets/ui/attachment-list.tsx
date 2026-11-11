import { Download, FileText, ImageIcon, Paperclip } from "lucide-react";
import { formatBytes } from "@/shared/lib/bytes";
import type { AttachmentDTO } from "../infrastructure/ticket-queries";

/** Adjuntos descargables a través de la ruta autorizada /api/archivos/[id]. */
export function AttachmentList({ files }: { files: AttachmentDTO[] }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Adjuntos">
      {files.map((f) => {
        const Icon = f.mime.startsWith("image/")
          ? ImageIcon
          : f.mime === "application/pdf"
            ? FileText
            : Paperclip;
        return (
          <li key={f.id}>
            <a
              href={`/api/archivos/${f.id}`}
              target="_blank"
              rel="noopener"
              className="group flex max-w-64 items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{f.fileName}</span>
              <span className="tabular shrink-0 text-xs text-muted-foreground">
                {formatBytes(f.sizeBytes)}
              </span>
              <Download
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
