import { describe, expect, it, vi } from "vitest";
import { createEvent, EventBus, matchesPattern } from "./event-bus";

const ev = (type: string) => createEvent(type, { id: 1 }, new Date("2026-11-10T12:00:00Z"));

describe("matchesPattern", () => {
  it.each([
    ["*", "ticket.created", true],
    ["ticket.created", "ticket.created", true],
    ["ticket.*", "ticket.status_changed", true],
    ["ticket.*", "task.created", false],
    ["task.completed", "task.created", false],
  ])("%s ~ %s → %s", (pattern, type, expected) => {
    expect(matchesPattern(pattern, type)).toBe(expected);
  });
});

describe("EventBus", () => {
  it("entrega el evento y el contexto (transacción) a los suscriptores que coinciden", async () => {
    const bus = new EventBus<string>();
    const handler = vi.fn();
    bus.subscribe("ticket.*", handler);
    bus.subscribe("task.*", () => {
      throw new Error("no debería llamarse");
    });
    await bus.publish(ev("ticket.created"), { tx: "tx-1" });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: "ticket.created" }), {
      tx: "tx-1",
    });
  });

  it("un suscriptor crítico que falla propaga el error (la transacción se revierte)", async () => {
    const bus = new EventBus();
    bus.subscribe(
      "*",
      () => {
        throw new Error("auditoría caída");
      },
      { critical: true },
    );
    await expect(bus.publish(ev("ticket.created"), { tx: null })).rejects.toThrow(
      "auditoría caída",
    );
  });

  it("un suscriptor no crítico que falla NO rompe la operación y se reporta", async () => {
    const onError = vi.fn();
    const bus = new EventBus(onError);
    const after = vi.fn();
    bus.subscribe(
      "*",
      async () => {
        throw new Error("correo caído");
      },
      { name: "email" },
    );
    bus.subscribe("*", after);
    await expect(bus.publish(ev("ticket.created"), { tx: null })).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ subscriber: "email" }));
    expect(after).toHaveBeenCalled();
  });

  it("los críticos corren antes que los no críticos", async () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.subscribe("*", () => void order.push("no-critico"));
    bus.subscribe("*", () => void order.push("critico"), { critical: true });
    await bus.publish(ev("x"), { tx: null });
    expect(order).toEqual(["critico", "no-critico"]);
  });

  it("subscribe devuelve una función para desuscribirse", async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.subscribe("*", handler);
    off();
    await bus.publish(ev("x"), { tx: null });
    expect(handler).not.toHaveBeenCalled();
  });
});
