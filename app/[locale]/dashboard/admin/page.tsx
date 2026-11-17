import { redirect } from "next/navigation";

// Platform administration lives at /admin (outside the locale routes).
export default function AdminPage() {
  redirect("/admin");
}
