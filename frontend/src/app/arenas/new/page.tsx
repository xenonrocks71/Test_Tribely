import { redirect } from "next/navigation";

export default function NewArenaPage() {
  redirect("/dashboard?create=1");
}
