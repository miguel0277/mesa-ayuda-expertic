import { describe, expect, it } from "vitest";
import { checkFile, mimeAllowed, sanitizeFileName, sniff, storageKey } from "./file-policy";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PDF = new TextEncoder().encode("%PDF-1.7 contenido");
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9]);
const TXT = new TextEncoder().encode("codigo,nombre\n2201234,Ana");
const opts = {
  allowedMime: [
    "image/*",
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  maxBytes: 1024 * 1024,
};

describe("sniff", () => {
  it("reconoce firmas", () => {
    expect(sniff(PNG)).toBe("image/png");
    expect(sniff(PDF)).toBe("application/pdf");
    expect(sniff(ZIP)).toBe("application/zip");
    expect(sniff(TXT)).toBeNull();
  });
});

describe("checkFile", () => {
  it("acepta un PNG real", () => {
    const r = checkFile({ name: "captura.png", type: "image/png", size: PNG.length }, PNG, opts);
    expect(r).toEqual({ ok: true, mime: "image/png", safeName: "captura.png" });
  });

  it("rechaza un ejecutable disfrazado de PDF", () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const r = checkFile({ name: "factura.pdf", type: "application/pdf", size: 4 }, exe, opts);
    expect(r.ok).toBe(false);
  });

  it("rechaza tipos no permitidos y archivos grandes o vacíos", () => {
    expect(
      checkFile({ name: "a.exe", type: "application/x-msdownload", size: 4 }, PNG, opts).ok,
    ).toBe(false);
    expect(
      checkFile({ name: "g.png", type: "image/png", size: 5 * 1024 * 1024 }, PNG, opts).ok,
    ).toBe(false);
    expect(
      checkFile({ name: "v.png", type: "image/png", size: 0 }, new Uint8Array(), opts).ok,
    ).toBe(false);
  });

  it("acepta CSV de texto y XLSX (zip)", () => {
    expect(checkFile({ name: "lista.csv", type: "text/csv", size: TXT.length }, TXT, opts).ok).toBe(
      true,
    );
    const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    expect(checkFile({ name: "l.xlsx", type: xlsx, size: ZIP.length }, ZIP, opts).ok).toBe(true);
  });

  it("respeta el accept de la plantilla", () => {
    const r = checkFile({ name: "c.csv", type: "text/csv", size: TXT.length }, TXT, {
      ...opts,
      accept: ["image/*"],
    });
    expect(r.ok).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("quita rutas y caracteres peligrosos", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\a\\info<>.pdf")).toBe("info.pdf");
    expect(sanitizeFileName("...oculto")).toBe("oculto");
    expect(sanitizeFileName("")).toBe("archivo");
  });

  it("acorta nombres largos conservando la extensión", () => {
    const n = sanitizeFileName(`${"a".repeat(300)}.pdf`);
    expect(n.length).toBeLessThanOrEqual(120);
    expect(n.endsWith(".pdf")).toBe(true);
  });
});

describe("utilidades", () => {
  it("comodines de MIME", () => {
    expect(mimeAllowed("image/webp", ["image/*"])).toBe(true);
    expect(mimeAllowed("application/pdf", ["image/*"])).toBe(false);
  });

  it("clave no adivinable sin el nombre original", () => {
    expect(storageKey("tickets", "0190-abc", new Date("2026-11-10T00:00:00Z"))).toBe(
      "tickets/2026/11/0190-abc",
    );
  });
});
