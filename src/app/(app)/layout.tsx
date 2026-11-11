import { cookies } from "next/headers";
import { Suspense } from "react";
import { unreadCount } from "@/modules/notifications/infrastructure/notification-queries";
import { requireViewer } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { AppShell } from "@/shared/ui/shell/app-shell";
import { PageSkeleton } from "@/shared/ui/states";

/** Shell autenticado: exige sesión activa (Better Auth) y arma el menú según el rol. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}

async function AuthedShell({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const store = await cookies();
  const sidebarOpen = store.get("sidebar_state")?.value !== "false";
  const unread = await unreadCount(getDb(), viewer.id);
  return (
    <AppShell
      sidebarOpen={sidebarOpen}
      unread={unread}
      user={{
        name: viewer.name,
        email: viewer.email,
        role: viewer.role,
        roleLabel: viewer.roleLabel,
        image: viewer.image,
        impersonating: viewer.impersonatedBy !== null,
      }}
    >
      {children}
    </AppShell>
  );
}

/** Mientras se resuelve la sesión: la silueta del shell, sin saltos de layout. */
function ShellFallback() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-64 shrink-0 border-r bg-sidebar md:block" />
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b" />
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
