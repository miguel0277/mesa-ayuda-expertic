"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, LogIn, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { authClient, authErrorMessage } from "@/shared/auth/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/components/alert";
import { Button } from "@/shared/ui/components/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Spinner } from "@/shared/ui/components/spinner";
import { PasswordInput } from "@/shared/ui/password-input";

const schema = z.object({
  email: z.email("Escribe un correo válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});
type Values = z.infer<typeof schema>;

/** Solo se permite volver a rutas internas (evita redirecciones abiertas). */
function safeReturn(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/inicio";
}

const NOTICES: Record<string, { title: string; body: string }> = {
  verificado: {
    title: "Correo confirmado",
    body: "Ya puedes iniciar sesión con tu correo y contraseña.",
  },
  restablecida: { title: "Contraseña actualizada", body: "Inicia sesión con tu contraseña nueva." },
  salida: { title: "Cerraste sesión", body: "Vuelve cuando quieras." },
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get("error")
      ? "El enlace de confirmación no es válido o ya venció. Pide uno nuevo desde el registro."
      : null,
  );
  const [pending, start] = useTransition();
  const notice = NOTICES[[...params.keys()].find((k) => k in NOTICES) ?? ""];

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setError(null);
      const { error: err } = await authClient.signIn.email({
        email: values.email.trim(),
        password: values.password,
      });
      if (err) {
        setError(authErrorMessage(err));
        form.setFocus("password");
        return;
      }
      router.replace(safeReturn(params.get("volver")));
      router.refresh();
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">Inicia sesión</h1>
        <p className="text-sm text-muted-foreground">
          Entra a la Mesa de Ayuda ExperTIC con tu correo.
        </p>
      </div>

      {notice && !error && (
        <Alert className="border-ok/30 bg-ok-soft text-ok">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription className="text-ok/90">{notice.body}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>No pudimos iniciar sesión</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="email">Correo</FieldLabel>
                <Input
                  {...field}
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="tu.nombre@correo.uis.edu.co"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                  <Link
                    href="/recuperar"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    ¿La olvidaste?
                  </Link>
                </div>
                <PasswordInput
                  {...field}
                  id="password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <LogIn data-icon="inline-start" aria-hidden="true" />
            )}
            {pending ? "Entrando…" : "Iniciar sesión"}
          </Button>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
