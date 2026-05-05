"use server";

import { assertTenantAccess } from "./_assert-access";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string };

/**
 * Generic image upload for homepage modules (hero slider backgrounds, etc).
 * Stores under `<tenantId>/homepage/...` in the `tenant-media` bucket.
 */
export async function uploadHomepageImage(
  formData: FormData,
): Promise<UploadResult> {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const file = formData.get("file");

  if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId))
    return { ok: false, error: "Ongeldige tenant id." };
  if (!(file instanceof File)) return { ok: false, error: "Geen bestand meegegeven." };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type))
    return { ok: false, error: `Bestandstype niet ondersteund: ${file.type || "onbekend"}.` };
  if (file.size > MAX_UPLOAD_BYTES)
    return { ok: false, error: "Bestand te groot (max 5MB)." };

  const user = await assertTenantAccess(tenantId);

  const supabase = await createClient();
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
    : "bin";
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const path = `${tenantId}/homepage/${filename}`;

  const { error: upErr } = await supabase.storage
    .from("tenant-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = supabase.storage.from("tenant-media").getPublicUrl(path);

  await supabase.from("media_assets").insert({
    tenant_id: tenantId,
    url: pub.publicUrl,
    path,
    file_type: file.type,
    uploaded_by: user.id,
  });

  return { ok: true, url: pub.publicUrl, path };
}
