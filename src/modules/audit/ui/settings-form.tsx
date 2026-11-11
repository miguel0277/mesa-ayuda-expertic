"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Switch } from "@/shared/ui/components/switch";
import { saveSettingsAction } from "./settings-actions";

type Values = {
  "auth.allowedEmailDomains": string[];
  "registration.approvalRoles": ("auxiliar" | "lider" | "docente")[];
  "attachments.maxSizeMB": number;
  "tasks.riskThresholdHours": number;
  "tickets.autoCloseDays": number;
  "tickets.reopenWindowDays": number;
  "privacy.noticeVersion": string;
};

const ROLES = [
  { v: "auxiliar", l: "Auxiliar" },
  { v: "lider", l: "Auxiliar líder" },
  { v: "docente", l: "Docente ExperTIC" },
] as const;

export function SettingsForm({ initial, envDomains }: { initial: Values; envDomains: string[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [domains, setDomains] = useState(initial["auth.allowedEmailDomains"].join(", "));
  const [pending, start] = useTransition();
  const num = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: Number(e.target.value) }));

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction({
        ...v,
        "auth.allowedEmailDomains": domains
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
      });
      if (!r.ok) return void toast.error(r.error.message);
      toast.success(
        r.data.changed ? `Guardamos ${r.data.changed} ajuste(s).` : "No había cambios.",
      );
      router.refresh();
    });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Registro y acceso</h2>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="aj-dominios">Dominios de correo permitidos</FieldLabel>
            <Input
              id="aj-dominios"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="Vacío = cualquier dominio"
              disabled={envDomains.length > 0}
            />
            <FieldDescription>
              {envDomains.length > 0
                ? `Lo define la variable ALLOWED_EMAIL_DOMAINS del servidor: ${envDomains.join(", ")}.`
                : "Separados por coma (ej.: uis.edu.co, correo.uis.edu.co). Vacío acepta cualquier correo (D-001)."}
            </FieldDescription>
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Roles que el administrador debe aprobar</FieldLegend>
            <FieldDescription>
              Estudiantes y profesores entran solos al confirmar su correo (D-002).
            </FieldDescription>
            <div className="flex flex-col gap-2">
              {ROLES.map((r) => (
                <Field key={r.v} orientation="horizontal">
                  <Switch
                    id={`aj-rol-${r.v}`}
                    checked={v["registration.approvalRoles"].includes(r.v)}
                    onCheckedChange={(on) =>
                      setV((s) => ({
                        ...s,
                        "registration.approvalRoles": on
                          ? [...s["registration.approvalRoles"], r.v]
                          : s["registration.approvalRoles"].filter((x) => x !== r.v),
                      }))
                    }
                  />
                  <FieldLabel htmlFor={`aj-rol-${r.v}`} className="font-normal">
                    {r.l}
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="aj-aviso">Versión del aviso de datos</FieldLabel>
            <Input
              id="aj-aviso"
              value={v["privacy.noticeVersion"]}
              onChange={(e) => setV((s) => ({ ...s, "privacy.noticeVersion": e.target.value }))}
              className="max-w-xs font-mono text-sm"
            />
            <FieldDescription>
              Súbela cuando cambie el texto del aviso: queda registrada con cada aceptación.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Solicitudes y tareas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="aj-riesgo">Umbral “en riesgo” (horas)</FieldLabel>
            <Input
              id="aj-riesgo"
              type="number"
              min={1}
              max={240}
              value={v["tasks.riskThresholdHours"]}
              onChange={num("tasks.riskThresholdHours")}
            />
            <FieldDescription>
              Una tarea abierta pasa a ámbar cuando le quedan estas horas o menos.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="aj-adj">Tamaño máximo de adjunto (MB)</FieldLabel>
            <Input
              id="aj-adj"
              type="number"
              min={1}
              max={50}
              value={v["attachments.maxSizeMB"]}
              onChange={num("attachments.maxSizeMB")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="aj-cierre">Autocierre de respondidas (días)</FieldLabel>
            <Input
              id="aj-cierre"
              type="number"
              min={1}
              max={60}
              value={v["tickets.autoCloseDays"]}
              onChange={num("tickets.autoCloseDays")}
            />
            <FieldDescription>
              Si el solicitante no responde, la solicitud se cierra sola.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="aj-reabrir">Ventana para reabrir (días)</FieldLabel>
            <Input
              id="aj-reabrir"
              type="number"
              min={1}
              max={60}
              value={v["tickets.reopenWindowDays"]}
              onChange={num("tickets.reopenWindowDays")}
            />
          </Field>
        </div>
      </section>
      <Button onClick={save} disabled={pending} size="lg" className="self-start">
        <Save data-icon="inline-start" aria-hidden="true" />
        {pending ? "Guardando…" : "Guardar ajustes"}
      </Button>
    </div>
  );
}
