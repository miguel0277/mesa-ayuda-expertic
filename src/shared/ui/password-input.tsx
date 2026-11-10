"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { passwordStrength } from "@/shared/lib/password-strength";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/shared/ui/components/input-group";

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <InputGroup className={className}>
        <InputGroupInput ref={ref} type={visible ? "text" : "password"} {...props} />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
);

const BAR = ["bg-late-fill", "bg-late-fill", "bg-risk-fill", "bg-ok-fill", "bg-ok-fill"];
const INK = ["text-late", "text-late", "text-risk", "text-ok", "text-ok"];

/** Medidor de fortaleza en vivo (HU-01): barra segmentada + etiqueta + sugerencia. */
export function PasswordMeter({
  password,
  context = [],
}: {
  password: string;
  context?: string[];
}) {
  const s = passwordStrength(password, context);
  if (!password) return null;
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full bg-muted transition-colors duration-200",
              i < Math.max(1, s.score) && BAR[s.score],
            )}
          />
        ))}
      </div>
      <p className="text-xs">
        <span className={cn("font-medium", INK[s.score])}>Seguridad: {s.label.toLowerCase()}.</span>{" "}
        {s.hints[0] && <span className="text-muted-foreground">{s.hints[0]}</span>}
      </p>
    </div>
  );
}
