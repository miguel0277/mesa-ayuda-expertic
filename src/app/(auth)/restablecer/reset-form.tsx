"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { authClient, authErrorMessage } from "@/shared/auth/auth-client";
import { passwordStrength } from "@/shared/lib/password-strength";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/components/alert";
import { Button } from "@/shared/ui/components/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/components/field";
import { Spinner } from "@/shared/ui/components/spinner";
import { PasswordInput, PasswordMeter } from "@/shared/ui/password-input";

const schema = z
  .object({
    password: z.string().min(8, "Usa al menos 8 caracteres.").max(128),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const s = passwordStrength(v.password);
    if (!s.acceptable)
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: s.hints[0] ?? "Elige una contraseña más segura.",
      });
    if (v.password !== v.confirm)
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Las contraseñas no coinciden." });
  });

export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const invalid = !token || params.get("error") !== null;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });
  const password = useWatch({ control: form.control, name: "password" });

  if (invalid || !token) {
    return (
      <div className="flex flex-col gap-6">
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>El enlace no es válido</AlertTitle>
          <AlertDescription>
            Puede que ya lo hayas usado o que haya vencido. Pide uno nuevo.
          </AlertDescription>
        </Alert>
        <Button asChild size="lg">
          <Link href="/recuperar">Pedir un enlace nuevo</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(({ password: newPassword }) =>
    start(async () => {
      setError(null);
      const { error: err } = await authClient.resetPassword({ newPassword, token });
      if (err) {
        setError(authErrorMessage(err));
        return;
      }
      router.replace("/login?restablecida=1");
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">Elige una contraseña nueva</h1>
        <p className="text-sm text-muted-foreground">
          Por seguridad, cerraremos tus otras sesiones abiertas.
        </p>
      </div>
      {error && (
        <Alert variant="destructive" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>No pudimos cambiarla</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="password">Contraseña nueva</FieldLabel>
                <PasswordInput
                  {...field}
                  id="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                <PasswordMeter password={password} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="confirm"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="confirm">Repítela</FieldLabel>
                <PasswordInput
                  {...field}
                  id="confirm"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <KeyRound data-icon="inline-start" aria-hidden="true" />
            )}
            Guardar contraseña
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
