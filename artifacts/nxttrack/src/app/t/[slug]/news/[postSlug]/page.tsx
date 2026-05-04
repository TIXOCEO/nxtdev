import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string; postSlug: string }>;
}

export default async function LegacyNewsPostRedirect({ params }: PageProps) {
  const { slug, postSlug } = await params;
  redirect(`/t/${slug}/nieuws/${postSlug}`);
}
