import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength";

describe("passwordStrength", () => {
  it("vacía o corta no es aceptable", () => {
    expect(passwordStrength("").acceptable).toBe(false);
    expect(passwordStrength("Ab1!").acceptable).toBe(false);
    expect(passwordStrength("Ab1!").hints).toContain("Usa al menos 8 caracteres.");
  });

  it("solo minúsculas de 8 es débil", () => {
    const s = passwordStrength("bucaramanga");
    expect(s.score).toBeLessThan(2);
    expect(s.acceptable).toBe(false);
  });

  it("variada y larga es fuerte", () => {
    const s = passwordStrength("Cerro-Santander-2026");
    expect(s.label).toBe("Fuerte");
    expect(s.acceptable).toBe(true);
  });

  it("penaliza patrones obvios y datos personales", () => {
    expect(passwordStrength("Expertic2026!").score).toBeLessThan(
      passwordStrength("Guayacan2026!").score,
    );
    expect(passwordStrength("Natalia2026!", ["natalia"]).acceptable).toBe(false);
    expect(passwordStrength("Aaaaaaaa1!").hints).toContain(
      "Evita tu nombre, tu correo o secuencias obvias.",
    );
  });
});
