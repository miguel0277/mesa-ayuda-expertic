import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/shared/ui/components/sidebar";
import { AppSidebar } from "./app-sidebar";
import { CommandPaletteProvider } from "./command-palette";
import { ImpersonationBanner } from "./impersonation-banner";
import { Topbar } from "./topbar";
import type { ShellUser } from "./user-menu";

/**
 * Shell autenticado: sidebar por rol + topbar (migas, ⌘K, notificaciones) + contenido.
 * Recibe solo datos serializables; la navegación por rol se resuelve en el cliente desde nav.ts.
 */
export function AppShell({
  user,
  sidebarOpen,
  children,
}: {
  user: ShellUser;
  sidebarOpen: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <CommandPaletteProvider role={user.role}>
        <AppSidebar user={user} />
        <SidebarInset className="min-w-0">
          {user.impersonating && (
            <ImpersonationBanner name={user.name} roleLabel={user.roleLabel} />
          )}
          <Topbar />
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </SidebarInset>
      </CommandPaletteProvider>
    </SidebarProvider>
  );
}
