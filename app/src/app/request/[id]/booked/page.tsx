import { redirect } from "next/navigation";

// The old timeline lives on the single booking page now.
export default async function Old({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/b/${id}`);
}
