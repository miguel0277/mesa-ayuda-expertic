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

/** Página 403 autocontenida (marca, modo oscuro del sistema y salida clara). */
const FORBIDDEN_HTML = `<!doctype html><html lang="es-CO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sin acceso · Mesa de Ayuda ExperTIC</title>
<style>:root{--bg:#f4f6f9;--card:#fff;--ink:#16202b;--muted:#556373;--primary:#1673bb;--soft:#e6f0f9}@media (prefers-color-scheme:dark){:root{--bg:#0b131c;--card:#111b26;--ink:#e4ebf2;--muted:#95a5b6;--primary:#4a9ee0;--soft:#13304a}}
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.5 "IBM Plex Sans",system-ui,sans-serif;padding:24px}
main{max-width:28rem;text-align:center}.icon{width:72px;height:72px;margin:0 auto 20px;border-radius:999px;background:var(--soft);display:grid;place-items:center;color:var(--primary)}
h1{font-size:1.5rem;margin:0 0 8px;letter-spacing:-.01em}p{color:var(--muted);margin:0 0 24px}a{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600}a:focus-visible{outline:2px solid var(--primary);outline-offset:3px}@media (prefers-color-scheme:dark){a{color:#06121e}}</style></head>
<body><main><div class="icon" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
<h1>Esta sección no está disponible para tu rol</h1><p>Si crees que deberías tener acceso, pídele al docente ExperTIC o al administrador que revise tu rol.</p><a href="/inicio">Ir a mi inicio</a></main></body></html>`;

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
    // El prefijo __Secure- solo existe sobre HTTPS: se decide por el protocolo real, no por NODE_ENV.
    const cached = await getCookieCache(request, {
      isSecure: request.nextUrl.protocol === "https:",
    }).catch(() => null);
    const role = (cached?.user as { role?: unknown } | undefined)?.role;
    if (isRole(role) && !canVisitPath(role, pathname)) {
      // `rewrite` no conserva el 403: se responde aquí mismo con una página liviana.
      return finish(
        new NextResponse(FORBIDDEN_HTML, {
          status: 403,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        }),
      );
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
