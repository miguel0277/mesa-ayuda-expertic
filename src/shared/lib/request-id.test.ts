import { describe, expect, it } from "vitest";
import { resolveRequestId } from "./request-id";

describe("resolveRequestId", () => {
  it("reutiliza un id entrante válido", () => {
    expect(resolveRequestId("abcdef12-3456")).toBe("abcdef12-3456");
    expect(resolveRequestId("iad1.req_0123456789")).toBe("iad1.req_0123456789");
  });

  it("genera uno nuevo si falta o trae caracteres peligrosos", () => {
    expect(resolveRequestId(null)).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId("<script>alert(1)</script>")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
