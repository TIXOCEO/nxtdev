import { redirect } from "next/navigation";
import {
  getTenantContactEmailBySlug,
  resolveSubmissionByReviewToken,
} from "@/lib/actions/public/propose-slot";
import { NoCapacityChoiceForm } from "@/components/public/intake/NoCapacityChoiceForm";
import { ExpiredReviewLinkNotice } from "@/components/public/intake/ExpiredReviewLinkNotice";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function NoCapacityPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { token } = await searchParams;
  if (!token) redirect(`/t/${slug}`);
  const sub = await resolveSubmissionByReviewToken(token);
  if (!sub || sub.tenant_slug !== slug) {
    const contactEmail = await getTenantContactEmailBySlug(slug);
    return (
      <ExpiredReviewLinkNotice tenantSlug={slug} contactEmail={contactEmail} />
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1
          className="text-xl font-semibold sm:text-2xl"
          style={{ color: "var(--text-primary)" }}
        >
          Helaas — op dit moment geen vrije plek
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Alle groepen die bij {sub.contact_name ? `${sub.contact_name}'s ` : "je "}aanvraag passen zijn op dit moment vol. Wat wil je doen?
        </p>
      </header>
      <NoCapacityChoiceForm reviewToken={token} tenantSlug={slug} />
    </main>
  );
}
