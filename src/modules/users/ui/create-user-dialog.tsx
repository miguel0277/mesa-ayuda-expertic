"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ROLE_LABEL, ROLES, type Role } from "@/shared/auth/roles";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Spinner } from "@/shared/ui/components/spinner";
import { createUserAction } from "./actions";

/** Admin: crear una cuenta. La persona recibe un enlace para elegir su contraseña. */
export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    name: "",
    email: "",
    role: "auxiliar" as Role,
    codigoUis: "",
    programa: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      setErrors({});
      const r = await createUserAction(v);
      if (!r.ok) {
        setErrors(r.error.fieldErrors ?? {});
        setError(r.error.message);
        return;
      }
      toast.success(
        `Creamos la cuenta de ${v.name}. Le enviamos un enlace para elegir su contraseña.`,
      );
      setOpen(false);
      setV({ name: "", email: "", role: "auxiliar", codigoUis: "", programa: "" });
      router.refresh();
    });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus data-icon="inline-start" aria-hidden="true" />
          Crear cuenta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear una cuenta</DialogTitle>
          <DialogDescription>
            Queda activa de inmediato. Le enviaremos un correo para que elija su contraseña.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="nu-nombre">Nombre completo</FieldLabel>
            <Input id="nu-nombre" value={v.name} onChange={set("name")} />
            <FieldError errors={errors.name?.map((message) => ({ message }))} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="nu-correo">Correo</FieldLabel>
            <Input id="nu-correo" type="email" value={v.email} onChange={set("email")} />
            <FieldError errors={errors.email?.map((message) => ({ message }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="nu-rol">Rol</FieldLabel>
              <Select
                value={v.role}
                onValueChange={(role) => setV((s) => ({ ...s, role: role as Role }))}
              >
                <SelectTrigger id="nu-rol" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="nu-codigo">
                Código UIS <span className="font-normal text-muted-foreground">(opcional)</span>
              </FieldLabel>
              <Input
                id="nu-codigo"
                inputMode="numeric"
                value={v.codigoUis}
                onChange={set("codigoUis")}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="nu-prog">
              Programa o escuela{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </FieldLabel>
            <Input id="nu-prog" value={v.programa} onChange={set("programa")} />
          </Field>
          {error && !Object.keys(errors).length && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Crear cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
