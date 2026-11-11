import { eq } from "drizzle-orm";
import { connection, NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { user } from "@/shared/db/schema";
import { getStorage } from "@/shared/storage";

/** Foto de perfil: solo para personas con sesión, y solo la clave vigente del usuario. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/avatar/[id]">) {
  await connection();
  if (!(await getViewer())) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const key = request.nextUrl.searchParams.get("k") ?? "";
  const [u] = await getDb()
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  // La clave pedida debe ser la que el usuario tiene guardada (no se puede leer otra cosa del almacenamiento).
  if (!u?.image || !key || !u.image.includes(encodeURIComponent(key)))
    return new NextResponse(null, { status: 404 });
  const file = await getStorage().get(key);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.contentType ?? "image/webp",
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
