import { redirect } from "next/navigation";

/** La raíz lleva al inicio de cada rol. */
export default function Home() {
  redirect("/inicio");
}
