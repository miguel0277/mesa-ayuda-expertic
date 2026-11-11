"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/components/button";
import { markReadAction } from "./actions";

export function MarkAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await markReadAction({ ids: null });
          if (!r.ok) return void toast.error(r.error.message);
          router.refresh();
        })
      }
    >
      <CheckCheck data-icon="inline-start" aria-hidden="true" />
      Marcar todas como leídas
    </Button>
  );
}
