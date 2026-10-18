import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

// The console is for the operator only: anyone else is sent to the sign-in page before any of it loads.
export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user?.role !== "operator") redirect("/login?next=/operator");
  return children;
}
