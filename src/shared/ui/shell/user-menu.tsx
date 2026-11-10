"use client";

import {
  Bell,
  ChevronsUpDown,
  Monitor,
  Moon,
  Palette,
  Sun,
  UserRound,
  VenetianMask,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { switchDevRole } from "@/shared/auth/dev-actions";
import { ROLE_LABEL, ROLES, type Role } from "@/shared/auth/roles";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/components/sidebar";

/** Datos serializables del usuario para el shell (sin funciones ni íconos). */
export type ShellUser = {
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  image: string | null;
  isDevViewer: boolean;
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function UserMenu({ user }: { user: ShellUser }) {
  const { theme, setTheme } = useTheme();
  const { isMobile } = useSidebar();
  const [pending, startTransition] = useTransition();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
              aria-label={`Menú de ${user.name}`}
            >
              <Avatar className="size-8 rounded-full">
                {user.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.roleLabel}</span>
              </span>
              <ChevronsUpDown aria-hidden="true" className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={8}
            className="w-64"
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/perfil">
                  <UserRound aria-hidden="true" />
                  Mi perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/notificaciones">
                  <Bell aria-hidden="true" />
                  Notificaciones
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette aria-hidden="true" />
                  Tema
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                    <DropdownMenuRadioItem value="light">
                      <Sun aria-hidden="true" />
                      Claro
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <Moon aria-hidden="true" />
                      Oscuro
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <Monitor aria-hidden="true" />
                      Sistema
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            {user.isDevViewer && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={pending}>
                    <VenetianMask aria-hidden="true" />
                    Ver como (solo desarrollo)
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={user.role}
                      onValueChange={(role) => startTransition(() => switchDevRole(role))}
                    >
                      {ROLES.map((r) => (
                        <DropdownMenuRadioItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
