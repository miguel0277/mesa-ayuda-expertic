import { v7 as uuidv7 } from "uuid";

/** Generador de identificadores inyectable. UUID v7: ordenable por tiempo. */
export interface IdGenerator {
  next(): string;
}

export const uuidV7Generator: IdGenerator = { next: () => uuidv7() };

export const newId = (): string => uuidv7();

/** Generador secuencial predecible para pruebas. */
export class SequentialIdGenerator implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `00000000-0000-7000-8000-${this.n.toString().padStart(12, "0")}`;
  }
}
