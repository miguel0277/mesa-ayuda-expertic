"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/components/alert-dialog";
import { buttonVariants } from "@/shared/ui/components/button";

type Options = { title: string; description: string; confirmLabel?: string; destructive?: boolean };
type Confirm = (o: Options) => Promise<boolean>;

const Ctx = createContext<Confirm | null>(null);

/**
 * Confirmación antes de acciones destructivas (sección 8), con un diálogo accesible propio
 * en lugar del `confirm()` del navegador. Uso: `if (await confirm({...})) …`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = useCallback<Confirm>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );
  const close = (value: boolean) => {
    resolver.current(value);
    setOpts(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AlertDialog open={opts !== null} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            <AlertDialogDescription>{opts?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={opts?.destructive ? buttonVariants({ variant: "destructive" }) : undefined}
            >
              {opts?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export function useConfirm(): Confirm {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return c;
}
