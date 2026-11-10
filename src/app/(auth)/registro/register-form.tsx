"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, TriangleAlert, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { authClient, authErrorMessage } from "@/shared/auth/auth-client";
import { PRIVACY_NOTICE, PRIVACY_NOTICE_VERSION } from "@/shared/legal/aviso-datos";
import { passwordStrength } from "@/shared/lib/password-strength";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/components/alert";
import { Button } from "@/shared/ui/components/button";
import { Checkbox } from "@/shared/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/components/radio-group";
import { Spinner } from "@/shared/ui/components/spinner";
import { duration, ease } from "@/shared/ui/motion";
import { PasswordInput, PasswordMeter } from "@/shared/ui/password-input";

const ROLE_OPTIONS = [
  { value: "estudiante", label: "Estudiante", hint: "Tu cuenta se activa al confirmar el correo." },
  { value: "profesor", label: "Profesor", hint: "Tu cuenta se activa al confirmar el correo." },
  { value: "auxiliar", label: "Auxiliar", hint: "El administrador debe aprobar tu cuenta." },
  { value: "lider", label: "Auxiliar líder", hint: "El administrador debe aprobar tu cuenta." },
  { value: "docente", label: "Docente ExperTIC", hint: "El administrador debe aprobar tu cuenta." },
] as const;

const NEEDS_CODE = new Set(["estudiante", "auxiliar", "lider"]);

const accountSchema = z
  .object({
    name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
    email: z.email("Escribe un correo válido.").max(160),
    password: z.string().min(8, "Usa al menos 8 caracteres.").max(128),
    confirm: z.string().min(1, "Repite la contraseña."),
  })
  .superRefine((v, ctx) => {
    const s = passwordStrength(v.password, [v.name, v.email.split("@")[0] ?? ""]);
    if (!s.acceptable)
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: s.hints[0] ?? "Elige una contraseña más segura.",
      });
    if (v.password !== v.confirm)
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Las contraseñas no coinciden." });
  });

const profileSchema = z
  .object({
    requestedRole: z.enum(["estudiante", "profesor", "auxiliar", "lider", "docente"], {
      error: "Elige cómo vas a usar la plataforma.",
    }),
    codigoUis: z
      .string()
      .trim()
      .max(20)
      .regex(/^\d*$/, "El código UIS solo lleva números.")
      .optional(),
    programa: z.string().trim().min(3, "Escribe tu programa o escuela.").max(120),
    telefono: z
      .string()
      .trim()
      .max(20)
      .regex(/^[\d\s+()-]*$/, "Escribe solo números.")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (NEEDS_CODE.has(v.requestedRole) && !v.codigoUis)
      ctx.addIssue({ code: "custom", path: ["codigoUis"], message: "Escribe tu código UIS." });
  });

const consentSchema = z.object({
  consent: z.boolean().refine((v) => v, "Debes aceptar el aviso para crear tu cuenta."),
});

/** Un esquema por paso: cada paso valida sus campos, incluidas las reglas cruzadas. */
const STEP_SCHEMAS = [accountSchema, profileSchema, consentSchema] as const;

type Values = z.infer<typeof accountSchema> &
  z.infer<typeof profileSchema> &
  z.infer<typeof consentSchema>;

const STEPS: { title: string; description: string; fields: FieldPath<Values>[] }[] = [
  {
    title: "Tu cuenta",
    description: "Con este correo y contraseña vas a entrar.",
    fields: ["name", "email", "password", "confirm"],
  },
  {
    title: "Tu perfil",
    description: "Así sabremos qué puedes hacer en la plataforma.",
    fields: ["requestedRole", "codigoUis", "programa", "telefono"],
  },
  { title: "Tus datos", description: "Lee cómo usamos tu información.", fields: ["consent"] },
];

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  // El resolver lee el paso al validar (después del render), no durante el render.
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const form = useForm<Values>({
    // El resolver valida solo el esquema del paso actual.
    resolver: (values, ctx, opts) =>
      // `raw`: conserva los valores de todos los pasos (no solo los validados en este paso).
      zodResolver(
        STEP_SCHEMAS[stepRef.current] as unknown as z.ZodType<Values, Values>,
        undefined,
        {
          raw: true,
        },
      )(values, ctx, opts),
    mode: "onTouched",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirm: "",
      codigoUis: "",
      programa: "",
      telefono: "",
      consent: false,
    },
  });
  const [password, name, email, role] = useWatch({
    control: form.control,
    name: ["password", "name", "email", "requestedRole"],
  });

  const next = async () => {
    const ok = await form.trigger();
    if (!ok) return;
    setDir(1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setDir(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = form.handleSubmit((v) =>
    start(async () => {
      setError(null);
      const { error: err } = await authClient.signUp.email({
        name: v.name.trim(),
        email: v.email.trim().toLowerCase(),
        password: v.password,
        requestedRole: v.requestedRole,
        codigoUis: v.codigoUis || undefined,
        programa: v.programa,
        telefono: v.telefono || undefined,
        dataConsentVersion: PRIVACY_NOTICE_VERSION,
        callbackURL: "/login?verificado=1",
      });
      if (err) {
        setError(authErrorMessage(err));
        return;
      }
      const params = new URLSearchParams({ correo: v.email.trim().toLowerCase() });
      if (!["estudiante", "profesor"].includes(v.requestedRole)) params.set("aprobacion", "1");
      router.push(`/verificar-correo?${params}`);
    }),
  );

  const current = STEPS[step];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">Crea tu cuenta</h1>
        <p className="text-sm text-muted-foreground">
          ¿Ya tienes una?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>

      {/* Progreso: es una secuencia real, por eso numerada */}
      <ol className="grid grid-cols-3 gap-2" aria-label="Pasos del registro">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="flex flex-col gap-1.5"
            aria-current={i === step ? "step" : undefined}
          >
            <span
              className={cn(
                "h-1 rounded-full bg-muted transition-colors duration-300",
                i <= step && "bg-primary",
              )}
            />
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                i === step ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {i < step ? (
                <Check aria-hidden="true" className="size-3 text-ok" />
              ) : (
                <span className="tabular">{i + 1}.</span>
              )}
              {s.title}
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <Alert variant="destructive" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>No pudimos crear tu cuenta</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(e) =>
          step === STEPS.length - 1 ? onSubmit(e) : (e.preventDefault(), void next())
        }
        noValidate
      >
        <p className="mb-4 text-sm text-muted-foreground">{current?.description}</p>
        <div className="relative overflow-hidden p-0.5">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{
                opacity: 1,
                x: 0,
                transition: { duration: duration.base, ease: ease.out },
              }}
              exit={{
                opacity: 0,
                x: dir * -24,
                transition: { duration: duration.fast, ease: ease.in },
              }}
            >
              {step === 0 && (
                <FieldGroup>
                  <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="name">Nombre completo</FieldLabel>
                        <Input
                          {...field}
                          id="name"
                          autoComplete="name"
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
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
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldDescription>
                          Te enviaremos un enlace para confirmarlo.
                        </FieldDescription>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                        <PasswordInput
                          {...field}
                          id="password"
                          autoComplete="new-password"
                          aria-invalid={fieldState.invalid}
                        />
                        <PasswordMeter
                          password={password ?? ""}
                          context={[name ?? "", (email ?? "").split("@")[0] ?? ""]}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  <Controller
                    name="confirm"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="confirm">Repite la contraseña</FieldLabel>
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
                </FieldGroup>
              )}

              {step === 1 && (
                <FieldGroup>
                  <Controller
                    name="requestedRole"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <FieldSet data-invalid={fieldState.invalid}>
                        <FieldLegend variant="label">¿Cómo vas a usar la plataforma?</FieldLegend>
                        <RadioGroup
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          className="gap-2"
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <FieldLabel
                              key={o.value}
                              htmlFor={`rol-${o.value}`}
                              className="rounded-lg border has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary/60"
                            >
                              <Field orientation="horizontal" className="p-3">
                                <RadioGroupItem value={o.value} id={`rol-${o.value}`} />
                                <FieldContent>
                                  <span className="font-medium">{o.label}</span>
                                  <FieldDescription className="text-xs">{o.hint}</FieldDescription>
                                </FieldContent>
                              </Field>
                            </FieldLabel>
                          ))}
                        </RadioGroup>
                        <FieldError errors={[fieldState.error]} />
                      </FieldSet>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Controller
                      name="codigoUis"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="codigoUis">
                            Código UIS
                            {!NEEDS_CODE.has(role ?? "") && (
                              <span className="font-normal text-muted-foreground"> (opcional)</span>
                            )}
                          </FieldLabel>
                          <Input
                            {...field}
                            id="codigoUis"
                            inputMode="numeric"
                            autoComplete="off"
                            aria-invalid={fieldState.invalid}
                          />
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                    <Controller
                      name="telefono"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="telefono">
                            Teléfono{" "}
                            <span className="font-normal text-muted-foreground">(opcional)</span>
                          </FieldLabel>
                          <Input
                            {...field}
                            id="telefono"
                            type="tel"
                            autoComplete="tel"
                            aria-invalid={fieldState.invalid}
                          />
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  </div>
                  <Controller
                    name="programa"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="programa">Programa o escuela</FieldLabel>
                        <Input
                          {...field}
                          id="programa"
                          placeholder="Ej.: Ingeniería de Sistemas"
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                </FieldGroup>
              )}

              {step === 2 && (
                <FieldGroup>
                  <section
                    aria-labelledby="aviso-titulo"
                    tabIndex={0}
                    className="max-h-64 overflow-y-auto rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed"
                  >
                    <h2 id="aviso-titulo" className="mb-2 text-sm font-semibold">
                      {PRIVACY_NOTICE.title}
                    </h2>
                    <div className="flex flex-col gap-2 text-muted-foreground">
                      {PRIVACY_NOTICE.paragraphs.map((p) => (
                        <p key={p.slice(0, 24)}>{p}</p>
                      ))}
                    </div>
                  </section>
                  <Controller
                    name="consent"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                        <Checkbox
                          id="consent"
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="consent" className="font-normal">
                            Leí el aviso y autorizo el tratamiento de mis datos (Ley 1581 de 2012).
                          </FieldLabel>
                          <FieldError errors={[fieldState.error]} />
                        </FieldContent>
                      </Field>
                    )}
                  />
                </FieldGroup>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={back} disabled={pending}>
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Atrás
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="submit" size="lg" className="flex-1">
              Continuar
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" size="lg" className="flex-1" disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UserPlus data-icon="inline-start" aria-hidden="true" />
              )}
              {pending ? "Creando tu cuenta…" : "Crear mi cuenta"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
