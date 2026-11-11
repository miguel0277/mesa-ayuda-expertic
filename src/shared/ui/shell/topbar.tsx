"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/components/breadcrumb";
import { Button } from "@/shared/ui/components/button";
import { Kbd } from "@/shared/ui/components/kbd";
import { Separator } from "@/shared/ui/components/separator";
import { SidebarTrigger } from "@/shared/ui/components/sidebar";
import { useCommandPalette } from "./command-palette";
import { buildCrumbs } from "./nav";
import { NotificationBell } from "./notification-bell";

export function Topbar({ unread }: { unread: number }) {
  const pathname = usePathname();
  const { open } = useCommandPalette();
  const crumbs = buildCrumbs(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
      <SidebarTrigger aria-label="Mostrar u ocultar el menú" className="size-9" />
      <Separator orientation="vertical" className="mr-1 hidden h-5 sm:block" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink asChild>
              <Link href="/inicio">Inicio</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={c.href}>
                <BreadcrumbSeparator className={i === 0 ? "hidden sm:list-item" : undefined} />
                <BreadcrumbItem className={last ? "min-w-0" : "hidden md:inline-flex"}>
                  {last ? (
                    <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={c.href}>{c.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={open}
          className="hidden h-9 w-64 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground md:flex lg:w-72"
        >
          <Search aria-hidden="true" className="size-4" />
          <span className="flex-1 text-left">Buscar o ir a…</span>
          <Kbd>Ctrl K</Kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Buscar o ir a (Ctrl K)"
          className="md:hidden"
          onClick={open}
        >
          <Search aria-hidden="true" />
        </Button>
        <NotificationBell initialUnread={unread} />
      </div>
    </header>
  );
}
