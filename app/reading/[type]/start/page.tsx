import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ReadingForm from "./reading-form";

export default async function StartReadingPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (type !== "water" && type !== "electric") notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "editor") redirect("/dashboard");

  return <ReadingForm type={type} />;
}
