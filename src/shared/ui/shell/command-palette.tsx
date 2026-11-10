"use client";

import { FilePlus2, Hash, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role } from "@/shared/auth/roles";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/shared/ui/components/command";
import { ACCOUNT_NAV, navForRole } from "./nav";

/**
 * Paleta de comandos (HU-61): Ctrl+K / ⌘K.
 * Navega según el rol, ejecuta acciones y abre un ticket escribiendo su código.
 * La búsqueda global de tickets y tareas (HU-62) se conecta aquí en la Fase 4.
 */

type PaletteContext = { open: () => void };
const Ctx = createContext<PaletteContext | null>(null);

export function useCommandPalette() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCommandPalette debe usarse dentro de CommandPaletteProvider");
  return ctx;
}

const CODE_RE = /^(exp|tar)-?(\d{4})-?(\d{1,5})$/i;

/** Normaliza "exp2026-42" → "EXP-2026-00042". */
export function normalizeCode(input: string): string | null {
  const m = CODE_RE.exec(input.trim().replace(/\s+/g, ""));
  if (!m) return null;
  const [, prefix = "", year = "", n = ""] = m;
  return `${prefix.toUpperCase()}-${year}-${n.padStart(5, "0")}`;
}

export function CommandPaletteProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback(
    (fn: () => void) => {
      setOpen(false);
      setQuery("");
      fn();
    },
    [setOpen],
  );

  const groups = useMemo(() => navForRole(role), [role]);
  const code = normalizeCode(query);
  const ctx = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <CommandDialog
        open={isOpen}
        onOpenChange={setOpen}
        title="Paleta de comandos"
        description="Busca una sección, una acción o escribe el código de un ticket."
        className="sm:max-w-xl"
      >
        {/* shadcn 4: CommandDialog ya no incluye la raíz de cmdk; sin ella los ítems fallan. */}
        <Command>
          <CommandInput
            placeholder="Escribe una sección, una acción o un código (EXP-2026-00042)"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No encontramos nada con “{query}”.</CommandEmpty>
            {code && (
              <CommandGroup heading="Ir a">
                <CommandItem
                  value={`codigo ${query}`}
                  onSelect={() =>
                    run(() =>
                      router.push(
                        code.startsWith("TAR") ? `/tareas/${code}` : `/solicitudes/${code}`,
                      ),
                    )
                  }
                >
                  <Hash aria-hidden="true" />
                  Abrir <span className="code-id">{code}</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Acciones">
              <CommandItem
                value="nueva solicitud crear ticket reportar"
                onSelect={() => run(() => router.push("/solicitudes/nueva"))}
              >
                <FilePlus2 aria-hidden="true" />
                Nueva solicitud
              </CommandItem>
              <CommandItem value="tema claro" onSelect={() => run(() => setTheme("light"))}>
                <Sun aria-hidden="true" />
                Usar tema claro
              </CommandItem>
              <CommandItem value="tema oscuro" onSelect={() => run(() => setTheme("dark"))}>
                <Moon aria-hidden="true" />
                Usar tema oscuro
              </CommandItem>
              <CommandItem value="tema del sistema" onSelect={() => run(() => setTheme("system"))}>
                <Monitor aria-hidden="true" />
                Usar el tema del sistema
              </CommandItem>
            </CommandGroup>
            {groups.map((g) => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={[item.label, ...(item.keywords ?? [])].join(" ")}
                    onSelect={() => run(() => router.push(item.href))}
                  >
                    <item.icon aria-hidden="true" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup heading="Tu cuenta">
              {ACCOUNT_NAV.map((item) => (
                <CommandItem
                  key={item.href}
                  value={[item.label, ...(item.keywords ?? [])].join(" ")}
                  onSelect={() => run(() => router.push(item.href))}
                >
                  <item.icon aria-hidden="true" />
                  {item.label}
                  {item.href === "/perfil" && <CommandShortcut>Cuenta</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </Ctx.Provider>
  );
}
