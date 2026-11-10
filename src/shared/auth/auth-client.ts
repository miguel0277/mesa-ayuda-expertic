"use client";

import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";

/** Cliente de Better Auth para formularios de autenticación (navegador). */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), adminClient()],
});

/** Traduce los códigos de error de Better Auth a mensajes humanos en español. */
export function authErrorMessage(
  error: { code?: string; message?: string; status?: number } | null | undefined,
): string {
  if (!error) return "Ocurrió un error inesperado. Intenta de nuevo.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "El correo o la contraseña no coinciden.";
    case "EMAIL_NOT_VERIFIED":
      return "Aún no confirmas tu correo. Revisa tu bandeja de entrada (y la de correo no deseado).";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "La contraseña es demasiado larga.";
    case "INVALID_TOKEN":
      return "El enlace no es válido o ya venció. Pide uno nuevo.";
    case "INVALID_PASSWORD":
      return "La contraseña actual no es correcta.";
    case "BANNED_USER":
      return "Tu cuenta está bloqueada. Escríbele al administrador si crees que es un error.";
  }
  if (error.status === 429) return "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
  // Mensajes propios (ya en español) definidos en auth.ts.
  if (error.message && /[áéíóúñ]|tu cuenta|aviso|rol|correos de/i.test(error.message))
    return error.message;
  return "No pudimos completar la operación. Intenta de nuevo.";
}
