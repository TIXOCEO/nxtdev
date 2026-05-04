-- Sprint 21 — Staff/Trainer dedicated invite email template.
--
-- Adds the `staff_invite` email template (with `{{function_label}}` variable)
-- to every existing tenant. Idempotent — uses ON CONFLICT DO NOTHING on the
-- (tenant_id, key) unique constraint, mirroring `seedDefaultEmailTemplates`.
--
-- New tenants pick this up automatically through the existing seed action
-- because `staff_invite` is now part of `DEFAULT_TEMPLATES`.

insert into email_templates (
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
  'staff_invite',
  'Account uitnodiging — staf/trainer',
  'Welkom bij {{tenant_name}}, {{member_name}} — activeer je {{function_label}}-account',
  '<h1 style="font-size:20px;margin:0 0 14px;line-height:1.3;">Welkom bij het team, {{member_name}}!</h1>'
    || '<p>We hebben een <strong>{{function_label}}</strong>-account voor je aangemaakt bij <strong>{{tenant_name}}</strong>. Je hoeft alleen nog je registratie af te ronden door een wachtwoord te kiezen.</p>'
    || '<p><a href="{{invite_link}}" style="display:inline-block;padding:10px 16px;background:#b6d83b;color:#111;border-radius:8px;text-decoration:none;">Account activeren</a></p>'
    || '<p>Of gebruik deze code: <strong>{{invite_code}}</strong></p>'
    || '<p>Deze uitnodiging vervalt op {{expiry_date}}.</p>',
  E'Welkom bij het team, {{member_name}}!\n\nWe hebben een {{function_label}}-account voor je aangemaakt bij {{tenant_name}}. Rond je registratie af door een wachtwoord te kiezen: {{invite_link}}\nCode: {{invite_code}}\nVervalt op: {{expiry_date}}\n\n— {{tenant_name}}',
  true
from tenants t
on conflict (tenant_id, key) do nothing;
