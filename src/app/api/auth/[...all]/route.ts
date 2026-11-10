import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/shared/auth/auth";

/** Endpoints de Better Auth (/api/auth/*). */
export const { GET, POST } = toNextJsHandler(auth);
