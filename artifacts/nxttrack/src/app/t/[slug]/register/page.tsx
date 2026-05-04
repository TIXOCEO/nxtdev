import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyRegisterRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/t/${slug}/inschrijven`);
}
