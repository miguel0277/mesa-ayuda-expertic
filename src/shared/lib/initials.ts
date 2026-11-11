/** Iniciales para avatares sin foto ("Carolina Méndez" → "CM"). Usable en servidor y cliente. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
