import "server-only";
import { getEnv } from "@/env";
import { LocalDiskStorage, VercelBlobStorage, type StorageProvider } from "./provider";

let storage: StorageProvider | undefined;

/** Proveedor de archivos según STORAGE_DRIVER (Strategy). */
export function getStorage(): StorageProvider {
  if (storage) return storage;
  const env = getEnv();
  storage =
    env.STORAGE_DRIVER === "vercel-blob" && env.BLOB_READ_WRITE_TOKEN
      ? new VercelBlobStorage(env.BLOB_READ_WRITE_TOKEN)
      : new LocalDiskStorage();
  return storage;
}
