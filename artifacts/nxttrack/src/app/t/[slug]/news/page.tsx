import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyNewsRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/t/${slug}/nieuws`);
}
