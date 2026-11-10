"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/shared/auth/auth-client";
import { Button } from "@/shared/ui/components/button";

/**
 * Banner persistente mientras un admin "ve como" otro usuario (HU-52).
 * La entrada y la salida quedan en la auditoría (hooks de Better Auth).
 */
export function ImpersonationBanner({ name, roleLabel }: { name: string; roleLabel: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const stop = () =>
    start(async () => {
      const { error } = await authClient.admin.stopImpersonating();
      if (error) {
        toast.error("No pudimos volver a tu cuenta. Cierra sesión e inicia de nuevo.");
        return;
      }
      router.replace("/admin/usuarios");
      router.refresh();
    });

  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-risk-fill px-4 py-2 text-center text-sm font-medium text-[#3a2400]"
    >
      <Eye aria-hidden="true" className="size-4" />
      <span>
        Estás viendo la app como <strong>{name}</strong> ({roleLabel}). Todo lo que hagas queda a su
        nombre y en la auditoría.
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-[#3a2400]/30 bg-white/70 text-[#3a2400]"
        onClick={stop}
        disabled={pending}
      >
        Volver a mi cuenta
      </Button>
    </div>
  );
}
