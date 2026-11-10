"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { BrandLogo } from "@/shared/ui/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/shared/ui/components/sidebar";
import { activeHref, navForRole } from "./nav";
import { UserMenu, type ShellUser } from "./user-menu";

/** Sidebar agrupado por rol: colapsable a íconos en escritorio y cajón en móvil. */
export function AppSidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const groups = useMemo(() => navForRole(user.role), [user.role]);
  const current = activeHref(
    pathname,
    groups.flatMap((g) => g.items.map((i) => i.href)),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <Link
          href="/inicio"
          aria-label="Mesa de Ayuda ExperTIC, ir al inicio"
          className="flex items-center rounded-md"
        >
          <BrandLogo className="h-8 group-data-[collapsible=icon]:hidden" priority />
          <Image
            src="/brand/isotipo-expertic.png"
            alt=""
            width={128}
            height={128}
            className="hidden size-8 group-data-[collapsible=icon]:block"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent className="py-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = item.href === current;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className="relative h-9"
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => isMobile && setOpenMobile(false)}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden"
                            />
                          )}
                          <item.icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
