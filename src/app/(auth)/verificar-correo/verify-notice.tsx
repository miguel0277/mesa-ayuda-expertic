"use client";

import { MailCheck, RotateCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { authClient, authErrorMessage } from "@/shared/auth/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/components/alert";
import { Button } from "@/shared/ui/components/button";
import { Spinner } from "@/shared/ui/components/spinner";

const COOLDOWN = 60;

/** Después del registro: "revisa tu correo" con reenvío (con espera para no saturar). */
export function VerifyNotice() {
  const params = useSearchParams();
  const email = params.get("correo") ?? "";
  const needsApproval = params.get("aprobacion") === "1";
  const [wait, setWait] = useState(COOLDOWN);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = () =>
    start(async () => {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/login?verificado=1",
      });
      if (error) {
        toast.error(authErrorMessage(error));
        return;
      }
      toast.success("Te enviamos un correo nuevo.");
      setWait(COOLDOWN);
    });

  return (
    <div className="flex flex-col gap-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <MailCheck aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Revisa tu correo</h1>
        <p className="text-muted-foreground">
          Te enviamos un enlace para confirmar tu cuenta
          {email && (
            <>
              {" "}
              a <strong className="font-medium text-foreground">{email}</strong>
            </>
          )}
          . Si no lo ves en unos minutos, busca en correo no deseado.
        </p>
      </div>

      {needsApproval && (
        <Alert>
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Tu cuenta necesita aprobación</AlertTitle>
          <AlertDescription>
            Pediste un rol del equipo ExperTIC. Después de confirmar tu correo, el administrador
            revisará tu cuenta y te avisaremos cuando puedas entrar.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        {email && (
          <Button variant="outline" size="lg" onClick={resend} disabled={pending || wait > 0}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RotateCw data-icon="inline-start" aria-hidden="true" />
            )}
            {wait > 0 ? `Reenviar correo en ${wait} s` : "Reenviar correo"}
          </Button>
        )}
        <Button asChild variant="ghost" size="lg">
          <Link href="/login">Ir a iniciar sesión</Link>
        </Button>
      </div>
    </div>
  );
}
