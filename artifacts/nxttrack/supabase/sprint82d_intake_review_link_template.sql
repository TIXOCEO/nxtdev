-- Sprint 82d — Task #145: admin-trigger "Stuur 3 voorstellen aan aanvrager".
--
-- Seeds the `intake_review_link` email template for every existing tenant.
-- New tenants pick this up automatically through `seedDefaultEmailTemplates`
-- because `intake_review_link` is now part of `DEFAULT_TEMPLATES`.
--
-- Idempotent — `on conflict (tenant_id, key) do nothing` mirrors the seed
-- action and the Sprint 21 pattern.

insert into public.email_templates (
  tenant_id,
  key,
  name,
  subject,
  content_html,
  content_text,
  is_enabled
)
select
  t.id,
  'intake_review_link',
  'Intake — voorstellen-link',
  'Kies een tijdsblok bij {{tenant_name}}',
  '<h1 style="font-size:20px;margin:0 0 14px;line-height:1.3;">We hebben 3 voorstellen voor je</h1>'
    || '<p>Beste {{contact_name}},</p>'
    || '<p>We hebben je intake-aanvraag bekeken en hebben <strong>3 best passende tijdsblokken</strong> voor je geselecteerd. Klik hieronder om ze te bekijken en je voorkeur te kiezen:</p>'
    || '<p><a href="{{review_url}}" style="display:inline-block;padding:10px 16px;background:#1f9d55;color:#fff;border-radius:8px;text-decoration:none;">Bekijk de voorstellen</a></p>'
    || '<p style="font-size:12px;color:#666;">Deze link is geldig tot <strong>{{expires_label}}</strong>. Daarna kun je opnieuw contact met ons opnemen.</p>',
  E'Beste {{contact_name}},\n\nWe hebben je intake-aanvraag bekeken en hebben 3 best passende tijdsblokken voor je geselecteerd.\n\nBekijk en kies je voorkeur: {{review_url}}\n\nDeze link is geldig tot {{expires_label}}. Daarna kun je opnieuw contact met ons opnemen.\n\n— {{tenant_name}}',
  true
from public.tenants t
on conflict (tenant_id, key) do nothing;
