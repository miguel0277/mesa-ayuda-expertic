import { describe, expect, it } from "vitest";
import { invalidTransition } from "./errors";
import { andThen, err, isErr, isOk, map, ok, unwrap } from "./result";

describe("Result", () => {
  it("ok / err con guardas de tipo", () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err("x"))).toBe(true);
  });

  it("map y andThen solo actúan sobre éxitos", () => {
    expect(map(ok(2), (n) => n * 2)).toEqual(ok(4));
    expect(map(err("e"), (n: number) => n * 2)).toEqual(err("e"));
    expect(andThen(ok(2), (n) => (n > 1 ? ok(n) : err("pequeño")))).toEqual(ok(2));
    expect(andThen(ok(0), (n) => (n > 1 ? ok(n) : err("pequeño")))).toEqual(err("pequeño"));
  });

  it("unwrap lanza el error de dominio", () => {
    expect(() => unwrap(err(invalidTransition("ticket", "abierto", "cerrado")))).toThrow(
      'No se puede pasar de "abierto" a "cerrado".',
    );
  });
});
