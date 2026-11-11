"use client";

import { Camera, KeyRound, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { authClient, authErrorMessage } from "@/shared/auth/auth-client";
import { passwordStrength } from "@/shared/lib/password-strength";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/components/avatar";
import { Button } from "@/shared/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Spinner } from "@/shared/ui/components/spinner";
import { PasswordInput, PasswordMeter } from "@/shared/ui/password-input";
import { initials } from "@/shared/ui/shell/user-menu";
import { updateProfileAction, uploadAvatarAction } from "./actions";

type Profile = {
  name: string;
  email: string;
  telefono: string | null;
  programa: string | null;
  codigoUis: string | null;
  image: string | null;
};

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: profile.name,
    telefono: profile.telefono ?? "",
    programa: profile.programa ?? "",
    codigoUis: profile.codigoUis ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [image, setImage] = useState(profile.image);
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const save = () =>
    start(async () => {
      setErrors({});
      const r = await updateProfileAction(v);
      if (!r.ok) {
        setErrors(r.error.fieldErrors ?? {});
        return void toast.error(r.error.message);
      }
      toast.success("Guardamos tus datos.");
      router.refresh();
    });

  const upload = (f: File | null) =>
    startUpload(async () => {
      const fd = new FormData();
      if (f) fd.append("foto", f);
      const r = await uploadAvatarAction(fd);
      if (!r.ok) return void toast.error(r.error.message);
      setImage(r.data.image);
      toast.success(f ? "Actualizamos tu foto." : "Quitamos tu foto.");
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">Tus datos</h2>
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {image && <AvatarImage src={image} alt="Tu foto de perfil" />}
          <AvatarFallback className="bg-secondary text-lg font-semibold text-secondary-foreground">
            {initials(profile.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => file.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Camera data-icon="inline-start" aria-hidden="true" />
            )}
            Cambiar foto
          </Button>
          {image && (
            <Button variant="ghost" size="sm" onClick={() => upload(null)} disabled={uploading}>
              <Trash2 data-icon="inline-start" aria-hidden="true" />
              Quitar
            </Button>
          )}
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Elegir foto de perfil"
            onChange={(e) => {
              upload(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <p className="w-full text-xs text-muted-foreground">PNG, JPG o WEBP de hasta 2 MB.</p>
        </div>
      </div>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="p-nombre">Nombre completo</FieldLabel>
          <Input id="p-nombre" value={v.name} onChange={set("name")} autoComplete="name" />
          {errors.name && (
            <FieldDescription className="text-destructive">{errors.name[0]}</FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="p-correo">Correo</FieldLabel>
          <Input id="p-correo" value={profile.email} disabled />
          <FieldDescription>Para cambiar el correo escríbele al administrador.</FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.telefono}>
            <FieldLabel htmlFor="p-tel">
              Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
            </FieldLabel>
            <Input
              id="p-tel"
              type="tel"
              value={v.telefono}
              onChange={set("telefono")}
              autoComplete="tel"
            />
          </Field>
          <Field data-invalid={!!errors.codigoUis}>
            <FieldLabel htmlFor="p-cod">Código UIS</FieldLabel>
            <Input id="p-cod" inputMode="numeric" value={v.codigoUis} onChange={set("codigoUis")} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="p-prog">Programa o escuela</FieldLabel>
          <Input id="p-prog" value={v.programa} onChange={set("programa")} />
        </Field>
      </FieldGroup>
      <Button onClick={save} disabled={pending} className="self-start">
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Save data-icon="inline-start" aria-hidden="true" />
        )}
        Guardar cambios
      </Button>
    </section>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const strength = passwordStrength(next);

  const submit = () => {
    if (!strength.acceptable)
      return setError(strength.hints[0] ?? "Elige una contraseña más segura.");
    if (next !== confirm) return setError("Las contraseñas nuevas no coinciden.");
    start(async () => {
      setError(null);
      const { error: e } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (e) return setError(authErrorMessage(e));
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Cambiamos tu contraseña y cerramos tus otras sesiones.");
    });
  };

  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">Contraseña</h2>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pw-actual">Contraseña actual</FieldLabel>
          <PasswordInput
            id="pw-actual"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pw-nueva">Contraseña nueva</FieldLabel>
          <PasswordInput
            id="pw-nueva"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
          <PasswordMeter password={next} />
        </Field>
        <Field>
          <FieldLabel htmlFor="pw-conf">Repite la nueva</FieldLabel>
          <PasswordInput
            id="pw-conf"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </FieldGroup>
      <Button
        onClick={submit}
        disabled={pending || !current || !next}
        variant="outline"
        className="self-start"
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <KeyRound data-icon="inline-start" aria-hidden="true" />
        )}
        Cambiar contraseña
      </Button>
    </section>
  );
}
