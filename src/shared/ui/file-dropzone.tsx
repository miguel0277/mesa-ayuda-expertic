"use client";

import { FileText, ImageIcon, Paperclip, Upload, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mimeAllowed } from "@/shared/storage/file-policy";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/button";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function Preview({ file }: { file: File }) {
  const url = useMemo(
    () => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no optimizable
    return <img src={url} alt="" className="size-10 rounded-md object-cover" />;
  }
  const Icon =
    file.type === "application/pdf"
      ? FileText
      : file.type.startsWith("image/")
        ? ImageIcon
        : Paperclip;
  return (
    <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

/**
 * Zona para arrastrar y soltar archivos, con vista previa y validación en el navegador
 * (el servidor vuelve a validar todo: tipo real, tamaño y cantidad).
 */
export function FileDropzone({
  files,
  onChange,
  accept,
  maxFiles = 3,
  maxBytes = 10 * 1024 * 1024,
  label = "Adjuntos",
  hint,
  invalid,
  compact,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string[];
  maxFiles?: number;
  maxBytes?: number;
  label?: string;
  hint?: string;
  invalid?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = (incoming: FileList | File[]) => {
    setError(null);
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= maxFiles) {
        setError(`Puedes adjuntar máximo ${maxFiles} archivo(s).`);
        break;
      }
      if (accept && !mimeAllowed(f.type, accept)) {
        setError(`"${f.name}" no es un tipo de archivo permitido aquí.`);
        continue;
      }
      if (f.size > maxBytes) {
        setError(`"${f.name}" supera el máximo de ${formatBytes(maxBytes)}.`);
        continue;
      }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed bg-card px-4 transition-colors",
          compact ? "py-2.5" : "flex-col justify-center py-6 text-center",
          drag && "border-primary bg-secondary/60",
          invalid && "border-destructive",
        )}
      >
        <Upload
          aria-hidden="true"
          className={cn("text-muted-foreground", compact ? "size-4" : "size-6")}
        />
        <p className="text-sm text-muted-foreground">
          Arrastra aquí o{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => input.current?.click()}
          >
            elige archivos
          </button>
          {!compact && hint && <span className="mt-1 block text-xs">{hint}</span>}
        </p>
        <input
          ref={input}
          id={id}
          type="file"
          multiple={maxFiles > 1}
          accept={accept?.join(",")}
          aria-label={label}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label={`${label} seleccionados`}>
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-2 pr-1"
            >
              <Preview file={f} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{f.name}</span>
                <span className="tabular text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
