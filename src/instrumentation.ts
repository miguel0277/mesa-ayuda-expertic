/**
 * Se ejecuta una vez al arrancar el servidor: valida el entorno para fallar pronto
 * y con un mensaje claro si falta alguna variable.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("./env");
    getEnv();
  }
}
