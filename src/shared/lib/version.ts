import pkg from "../../../package.json";

/** Versión desplegada: versión del paquete + commit corto en Vercel. */
export const APP_VERSION = [pkg.version, process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)]
  .filter(Boolean)
  .join("+");
