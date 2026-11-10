import { describe, expect, it } from "vitest";
import { ROLES } from "@/shared/auth/roles";
import { normalizeCode } from "./command-palette";
import { activeHref, canVisit, homeFor, NAV, navForRole } from "./nav";
import { buildCrumbs } from "./topbar";

const hrefs = (role: (typeof ROLES)[number]) =>
  navForRole(role).flatMap((g) => g.items.map((i) => i.href));

describe("navegación por rol", () => {
  it("cada rol tiene un inicio que puede visitar", () => {
    for (const role of ROLES) expect(canVisit(role, homeFor(role)), role).toBe(true);
  });

  it("inicio por rol (sección 7)", () => {
    expect(homeFor("docente")).toBe("/panel");
    expect(homeFor("admin")).toBe("/panel");
    expect(homeFor("lider")).toBe("/equipo");
    expect(homeFor("auxiliar")).toBe("/tareas");
    expect(homeFor("profesor")).toBe("/solicitudes");
    expect(homeFor("estudiante")).toBe("/solicitudes");
  });

  it("estudiante y profesor solo ven sus solicitudes", () => {
    expect(hrefs("estudiante")).toEqual(["/solicitudes", "/solicitudes/nueva"]);
    expect(hrefs("profesor")).toEqual(["/solicitudes", "/solicitudes/nueva"]);
  });

  it("un estudiante no puede entrar al panel ni a la consola admin", () => {
    expect(canVisit("estudiante", "/panel")).toBe(false);
    expect(canVisit("estudiante", "/admin/usuarios")).toBe(false);
    expect(canVisit("auxiliar", "/equipo")).toBe(false);
    expect(canVisit("docente", "/admin")).toBe(false);
  });

  it("el admin ve todo lo del docente más la consola", () => {
    const docente = hrefs("docente");
    const admin = hrefs("admin");
    for (const h of docente) expect(admin).toContain(h);
    expect(admin).toContain("/admin/auditoria");
  });

  it("el líder ve lo del auxiliar más su equipo", () => {
    const aux = hrefs("auxiliar");
    const lider = hrefs("lider");
    for (const h of aux) expect(lider).toContain(h);
    expect(lider).toContain("/equipo");
  });

  it("todos pueden crear una solicitud", () => {
    for (const role of ROLES) expect(canVisit(role, "/solicitudes/nueva")).toBe(true);
  });

  it("no hay rutas duplicadas en el menú", () => {
    const all = NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(all).size).toBe(all.length);
  });

  it("rutas desconocidas no se permiten", () => {
    expect(canVisit("admin", "/no-existe")).toBe(false);
  });
});

describe("ítem activo", () => {
  it("elige el prefijo más largo", () => {
    const list = ["/panel", "/panel/tickets", "/solicitudes", "/solicitudes/nueva"];
    expect(activeHref("/panel/tickets", list)).toBe("/panel/tickets");
    expect(activeHref("/panel", list)).toBe("/panel");
    expect(activeHref("/solicitudes/EXP-2026-00001", list)).toBe("/solicitudes");
    expect(activeHref("/solicitudes/nueva", list)).toBe("/solicitudes/nueva");
    expect(activeHref("/panelito", list)).toBeUndefined();
  });
});

describe("migas de pan", () => {
  it("usa las etiquetas del menú y los códigos en mayúscula", () => {
    expect(buildCrumbs("/panel/tickets")).toEqual([
      { href: "/panel", label: "Panel de control" },
      { href: "/panel/tickets", label: "Bandeja de tickets" },
    ]);
    expect(buildCrumbs("/solicitudes/exp-2026-00042").at(-1)?.label).toBe("EXP-2026-00042");
  });
});

describe("códigos en la paleta ⌘K", () => {
  it.each([
    ["EXP-2026-00042", "EXP-2026-00042"],
    ["exp-2026-42", "EXP-2026-00042"],
    ["exp2026-42", "EXP-2026-00042"],
    [" tar-2026-7 ", "TAR-2026-00007"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeCode(input)).toBe(expected);
  });

  it("ignora texto que no es un código", () => {
    expect(normalizeCode("moodle")).toBeNull();
    expect(normalizeCode("EXP-26-1")).toBeNull();
  });
});
