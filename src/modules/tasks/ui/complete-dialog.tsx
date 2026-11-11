"use client";

import { CircleCheckBig } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/shared/ui/components/field";
import { Spinner } from "@/shared/ui/components/spinner";
import { Textarea } from "@/shared/ui/components/textarea";
import { FileDropzone } from "@/shared/ui/file-dropzone";
import { addEvidenceAction } from "./actions";

/**
 * Completar con evidencia (HU-21). También sirve para solo agregar evidencia (`complete=false`).
 */
export function EvidenceDialog({
  task,
  open,
  onOpenChange,
  complete = true,
  onDone,
}: {
  task: { id: string; code: string; title: string; requiresEvidence: boolean };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complete?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (!note.trim() && !files.length) {
      setError("Escribe una nota o adjunta al menos un archivo.");
      return;
    }
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        taskId: task.id,
        code: task.code,
        note: note.trim() || undefined,
        complete,
      }),
    );
    for (const f of files) fd.append("archivos", f);
    start(async () => {
      setError(null);
      const r = await addEvidenceAction(fd);
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      toast.success(complete ? `¡${task.code} completada!` : "Evidencia agregada.");
      setNote("");
      setFiles([]);
      onOpenChange(false);
      onDone?.();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{complete ? "Completar tarea" : "Agregar evidencia"}</DialogTitle>
          <DialogDescription>
            <span className="code-id">{task.code}</span> · {task.title}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nota-evidencia">¿Qué hiciste?</FieldLabel>
            <Textarea
              id="nota-evidencia"
              rows={4}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej.: Corregí los 4 enlaces rotos de la semana 5 y verifiqué desde la vista de estudiante."
            />
            {complete && task.requiresEvidence && (
              <FieldDescription>
                Esta tarea pide evidencia: una nota o al menos un archivo.
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel>Archivos</FieldLabel>
            <FileDropzone
              files={files}
              onChange={setFiles}
              maxFiles={5}
              compact
              label="Archivos de evidencia"
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <CircleCheckBig data-icon="inline-start" aria-hidden="true" />
            )}
            {complete ? "Completar" : "Guardar evidencia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
