import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Strategy/Adapter de almacenamiento de archivos. La lógica de negocio solo conoce esta interfaz.
 * Los bytes nunca van a la base de datos; ahí solo queda la `storage_key`.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  /** Devuelve un stream para responder al navegador, o null si no existe. */
  get(
    key: string,
  ): Promise<{
    stream: ReadableStream<Uint8Array>;
    size: number | null;
    contentType: string | null;
  } | null>;
  delete(key: string): Promise<void>;
}

/** Desarrollo: guarda en `.data/archivos` (fuera de /public: nada se sirve sin autorización). */
export class LocalDiskStorage implements StorageProvider {
  readonly name = "local";
  constructor(private readonly root = path.join(process.cwd(), ".data", "archivos")) {}

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    // Defensa en profundidad contra rutas con "..".
    if (!full.startsWith(path.resolve(this.root) + path.sep))
      throw new Error("Clave de archivo inválida");
    return full;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  async get(key: string) {
    const file = this.resolve(key);
    try {
      const stat = await fs.stat(file);
      const nodeStream = (await import("node:fs")).createReadStream(file);
      return {
        stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
        size: stat.size,
        contentType: null,
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}

/** Producción: Vercel Blob con acceso PRIVADO (solo se descarga a través de la app). */
export class VercelBlobStorage implements StorageProvider {
  readonly name = "vercel-blob";
  constructor(private readonly token: string) {}

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    const { put } = await import("@vercel/blob");
    await put(key, Buffer.from(data), {
      access: "private",
      contentType,
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  }

  async get(key: string) {
    const { get } = await import("@vercel/blob");
    const res = await get(key, { access: "private", token: this.token });
    if (!res || res.statusCode !== 200) return null;
    return { stream: res.stream, size: res.blob.size, contentType: res.blob.contentType };
  }

  async delete(key: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(key, { token: this.token });
  }
}

/** Pruebas: en memoria. */
export class MemoryStorage implements StorageProvider {
  readonly name = "memory";
  readonly files = new Map<string, { data: Uint8Array; contentType: string }>();
  async put(key: string, data: Uint8Array, contentType: string) {
    this.files.set(key, { data, contentType });
  }
  async get(key: string) {
    const f = this.files.get(key);
    if (!f) return null;
    return {
      stream: new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(f.data);
          c.close();
        },
      }),
      size: f.data.byteLength,
      contentType: f.contentType,
    };
  }
  async delete(key: string) {
    this.files.delete(key);
  }
}
