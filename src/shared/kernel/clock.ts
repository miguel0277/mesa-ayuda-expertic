/** Reloj inyectable: permite pruebas deterministas. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Reloj fijo para pruebas. `advance` mueve el tiempo en milisegundos. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(initial: Date | string) {
    this.current = new Date(initial);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date | string): void {
    this.current = new Date(date);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
