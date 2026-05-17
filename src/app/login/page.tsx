import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { SignInPage } from "@/components/layout/SignInPage";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/app");
  return <SignInPage />;
}
