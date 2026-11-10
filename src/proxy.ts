import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isRole } from "@/shared/auth/roles";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/shared/lib/request-id";
import { canVisitPath } from "@/shared/ui/shell/nav";

/**
 * Proxy (antes "middleware"): corre antes de renderizar.
 * 1. Asigna un requestId a cada petición (logs, auditoría y errores).
 * 2. Sin cookie de sesión en una ruta privada → /login?volver=<ruta>.
 * 3. Con sesión cuyo rol no puede ver la ruta → 403 real (D-028), antes del streaming.
 * Las páginas y acciones vuelven a verificar en el servidor: el proxy es la primera barrera, no la única.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/registro",
  "/verificar-correo",
  "/recuperar",
  "/restablecer",
  "/sin-acceso",
  "/api/auth",
  "/api/health",
  "/api/cron",
  "/diseno",
];

const isPublic = (pathname: string) =>
  pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const { pathname, search } = request.nextUrl;

  const finish = (response: NextResponse) => {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  };

  if (!isPublic(pathname) && !pathname.startsWith("/api/")) {
    if (!getSessionCookie(request)) {
      const url = new URL("/login", request.url);
      url.searchParams.set("volver", `${pathname}${search}`);
      return finish(NextResponse.redirect(url));
    }
    const cached = await getCookieCache(request).catch(() => null);
    const role = (cached?.user as { role?: unknown } | undefined)?.role;
    if (isRole(role) && !canVisitPath(role, pathname)) {
      return finish(NextResponse.rewrite(new URL("/sin-acceso", request.url), { status: 403 }));
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  return finish(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|\\.well-known/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
