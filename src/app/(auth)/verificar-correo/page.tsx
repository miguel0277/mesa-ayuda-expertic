import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyNotice } from "./verify-notice";

export const metadata: Metadata = { title: "Confirma tu correo" };

export default function VerificarCorreoPage() {
  return (
    <Suspense>
      <VerifyNotice />
    </Suspense>
  );
}
