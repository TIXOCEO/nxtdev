import { PageHeading } from "@/components/ui/page-heading";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformTemplates } from "@/lib/db/profile-pictures";
import { PlatformProfilePicturesManager } from "./_manager";

export const dynamic = "force-dynamic";

export default async function PlatformProfilePicturesPage() {
  await requirePlatformAdmin();
  const templates = await getPlatformTemplates();

  return (
    <>
      <PageHeading
        title="Platform-templates"
        description="Standaard profielafbeeldingen die beschikbaar zijn voor alle clubs."
      />
      <PlatformProfilePicturesManager templates={templates} />
    </>
  );
}
