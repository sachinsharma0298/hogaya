import { redirect } from "next/navigation";

// The old demo "My bookings" picker is replaced by the Pro app.
export default function OldProviderPage() {
  redirect("/pro");
}
