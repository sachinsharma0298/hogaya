import { redirect } from "next/navigation";

// The old self-service sign-up is gone: Hogaya onboards Pros personally.
export default function ProSignupMoved() {
  redirect("/pro/join");
}
