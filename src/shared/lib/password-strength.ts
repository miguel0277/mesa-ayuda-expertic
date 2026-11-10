/**
 * Fortaleza de contraseña para el medidor en vivo del registro (HU-01).
 * Heurística simple y explicable: longitud + variedad + ausencia de patrones obvios.
 */
export type Strength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Muy débil" | "Débil" | "Aceptable" | "Buena" | "Fuerte";
  /** Sugerencias concretas para mejorarla. */
  hints: string[];
  /** ¿Cumple el mínimo para aceptarla? */
  acceptable: boolean;
};

const COMMON = [
  "123456",
  "password",
  "contrasena",
  "contraseña",
  "qwerty",
  "uis",
  "expertic",
  "abc123",
  "111111",
];
const LABELS: Strength["label"][] = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"];

export function passwordStrength(password: string, context: string[] = []): Strength {
  const hints: string[] = [];
  if (!password)
    return { score: 0, label: "Muy débil", hints: ["Escribe una contraseña."], acceptable: false };

  let points = 0;
  if (password.length >= 8) points++;
  else hints.push("Usa al menos 8 caracteres.");
  if (password.length >= 12) points++;
  else if (password.length >= 8) hints.push("Con 12 caracteres o más es mucho más segura.");

  const variety = [/[a-záéíóúñ]/, /[A-ZÁÉÍÓÚÑ]/, /\d/, /[^A-Za-z0-9áéíóúñÁÉÍÓÚÑ]/].filter((r) =>
    r.test(password),
  ).length;
  if (variety >= 3) points++;
  if (variety === 4) points++;
  if (variety < 3) hints.push("Combina mayúsculas, minúsculas, números o símbolos.");

  const lower = password.toLowerCase();
  const obvious =
    COMMON.some((c) => lower.includes(c)) ||
    context.filter((c) => c.length >= 3).some((c) => lower.includes(c.toLowerCase())) ||
    /(.)\1{3,}/.test(password);
  if (obvious) {
    points = Math.max(0, points - 2);
    hints.push("Evita tu nombre, tu correo o secuencias obvias.");
  }

  const score = Math.min(4, points) as Strength["score"];
  return {
    score,
    label: LABELS[score] ?? "Muy débil",
    hints,
    acceptable: password.length >= 8 && score >= 2 && !obvious,
  };
}
