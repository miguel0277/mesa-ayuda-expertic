import { describe, expect, it, vi } from "vitest";
import { BrevoEmail, parseFromAddress } from "./provider";

describe("parseFromAddress", () => {
  it("separa nombre y correo", () => {
    expect(parseFromAddress("Mesa de Ayuda ExperTIC <recursos@gmail.com>")).toEqual({
      name: "Mesa de Ayuda ExperTIC",
      email: "recursos@gmail.com",
    });
  });
  it("acepta el nombre entre comillas", () => {
    expect(parseFromAddress('"Mesa ExperTIC" <a@b.co>')).toEqual({
      name: "Mesa ExperTIC",
      email: "a@b.co",
    });
  });
  it("acepta solo el correo", () => {
    expect(parseFromAddress(" a@b.co ")).toEqual({ email: "a@b.co" });
    expect(parseFromAddress("<a@b.co>")).toEqual({ email: "a@b.co" });
  });
});

describe("BrevoEmail", () => {
  const message = {
    to: "persona@gmail.com",
    subject: "Confirma",
    html: "<p>Hola</p>",
    text: "Hola",
  };

  it("llama a la API transaccional de Brevo con remitente y destinatario", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    await new BrevoEmail("clave", "Mesa <rem@gmail.com>", fetchFn).send(message);

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("clave");
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: "Mesa", email: "rem@gmail.com" },
      to: [{ email: "persona@gmail.com" }],
      subject: "Confirma",
      htmlContent: "<p>Hola</p>",
      textContent: "Hola",
    });
  });

  it("falla con el detalle si Brevo rechaza el envío", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("sender not valid", { status: 400 }));
    await expect(new BrevoEmail("clave", "rem@gmail.com", fetchFn).send(message)).rejects.toThrow(
      "Brevo respondió 400: sender not valid",
    );
  });
});
