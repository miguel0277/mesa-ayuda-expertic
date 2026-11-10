"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/shared/auth/auth-client";
import { Button } from "@/shared/ui/components/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Spinner } from "@/shared/ui/components/spinner";

const schema = z.object({ email: z.email("Escribe un correo válido.") });

/**
 * Recuperar contraseña (HU-02). Siempre muestra el mismo mensaje, exista o no la cuenta,
 * para no revelar qué correos están registrados.
 */
export function RecoverForm() {
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(({ email }) =>
    start(async () => {
      const normalized = email.trim().toLowerCase();
      await authClient.requestPasswordReset({ email: normalized, redirectTo: "/restablecer" });
      setSent(normalized);
    }),
  );

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Revisa tu correo</h1>
          <p className="text-muted-foreground">
            Si existe una cuenta con <strong className="font-medium text-foreground">{sent}</strong>
            , te llegará un enlace para elegir una contraseña nueva. Vence en 1 hora.
          </p>
        </div>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Volver a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">Recupera tu contraseña</h1>
        <p className="text-sm text-muted-foreground">
          Escribe tu correo y te enviaremos un enlace para cambiarla.
        </p>
      </div>
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
              <Send data-icon="inline-start" aria-hidden="true" />
            )}
            Enviar enlace
          </Button>
        </FieldGroup>
      </form>
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
