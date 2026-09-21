import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PasswordForm from "./password-form";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <PasswordForm username={user.username} />;
}
