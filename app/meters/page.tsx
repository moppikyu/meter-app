import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import MetersManager from "./meters-manager";

export default async function MetersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "editor") redirect("/dashboard");

  return <MetersManager />;
}
