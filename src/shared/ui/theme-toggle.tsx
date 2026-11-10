"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/shared/ui/components/button";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

const subscribe = () => () => {};

/** Selector de tema: claro, oscuro o el del sistema. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Evita desajustes de hidratación: en el servidor no se conoce el tema elegido.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex rounded-lg border bg-card p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          aria-label={label}
          title={label}
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(value)}
          className="aria-checked:bg-secondary aria-checked:text-secondary-foreground"
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
