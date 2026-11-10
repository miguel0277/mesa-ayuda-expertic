import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function RestablecerPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
