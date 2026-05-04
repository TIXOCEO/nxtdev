# AVG/GDPR Phase 1 Audit Report — NXTTRACK

**Scope:** Multi-tenant Dutch sports-club PWA (Next.js 15 + Supabase Postgres + Storage + web-push).
**Method:** Read-only static review of `artifacts/nxttrack/supabase/*.sql`, `src/lib/db/*`, `src/lib/permissions/*`, `src/lib/actions/*`, `src/lib/notifications/*`, `src/lib/push/*`, `src/app/api/*`, `src/app/t/[slug]/*`, `src/app/(tenant)/*`, `src/app/(platform)/*`. **No code, schema, or configuration was modified.**
**Audit areas covered:** Personal-data inventory, minor-athlete protection, public exposure surface, social feed (Sprint 19), media/storage, attendance & health-adjacent data, performance/training data, messaging, API & RLS, consent, role hierarchy, logging, user rights (access/erasure/portability), notifications & push.
**Risk legend:** **CRITICAL** = immediate AVG breach risk · **HIGH** = likely breach without compensating control · **MEDIUM** = compliance gap · **LOW** = hygiene · **INFO** = informational.

---

## 1. Executive Summary

NXTTRACK is a tenant-isolated SaaS for Dutch sports clubs that processes large volumes of personal data — including data of **minors** (athletes < 16) — across registrations, members, parent–child links, training attendance with health-adjacent fields (`absence_reason`, `attendance_reason`, `injured`, `trainer_note`), messaging, a social feed, and media. The schema layer demonstrates a competent multi-tenant model: every business table is `tenant_id`-scoped, RLS is enabled on virtually all tables, and a small set of `SECURITY DEFINER` helpers (`is_platform_admin`, `is_tenant_admin`, `has_tenant_access`, `fn_is_tenant_member`) cleanly mediates tenant access. Defense-in-depth triggers (e.g. `enforce_link_tenant_consistency`, `notification_recipients_integrity`) close several cross-tenant leakage vectors at the database level.

However, the audit identifies **structural weaknesses that conflict with AVG (GDPR) principles of data minimisation, lawful basis (Art. 6/8), confidentiality (Art. 5(1)(f)), and data-subject rights (Art. 15-22)**. The most material findings are:

1. **Storage bucket `tenant-media` is fully PUBLIC** (`storage.buckets.public = true`) with an open `for select using (bucket_id = 'tenant-media')` policy — every uploaded file (including minors' photos, profile pictures, news cover images, sponsor logos and any media uploaded for a `private`/`team` social post) is reachable by any anonymous internet visitor who guesses or harvests the URL. **CRITICAL.**
2. **Service-role bypass is used pervasively in application code.** ≥ 50 modules import `createAdminClient` (service role) including all public server actions and the social-feed read path. RLS is therefore *not* an enforcement layer — it is at most a defence-in-depth net, and any application logic bug becomes a tenant-isolation breach. **HIGH.**
3. **Social-feed RLS does not enforce visibility.** `posts_select` only checks tenant membership and `is_hidden = false`; team / private / trainers visibility is enforced exclusively in TypeScript. Any future developer call that bypasses `getFeedPosts` filtering will leak private/team posts cross-cohort. **HIGH.**
4. **No DOB-based minor detection and no parental consent (Art. 8 AVG/UAVG art. 5).** A "minor" is inferred from *role = athlete* + *parent_member_link exists*. There is no explicit consent record, no age threshold (UAVG = 16), and `members.date_of_birth` is not in the schema (only on `athletes` & `registrations`). **CRITICAL.**
5. **Public registration forms (`/t/{slug}/inschrijven`, `/proefles`, `/register`) collect minors' name, DOB, address, postcode, parent contact** with `agreed_terms boolean` as the *only* lawful-basis artefact — there is no granular consent (photo/media, social-feed visibility, push, processing of health-adjacent attendance reasons), no privacy notice version pin, no withdraw-consent surface. **CRITICAL.**
6. **Push payloads include up to 200 chars of `content_text`** (e.g. *"Iemand liket je bericht"* + emoji, *"Je bent genoemd in een bericht"* + content snippet, coach broadcast snippet). On a locked phone screen this can disclose minor-related content (e.g. team chat snippets, mentions of a child) to anyone holding the device. **HIGH.**
7. **`profiles_admin_read` policy lets every `platform_admin` read every user profile across every tenant.** The admin client bypass extends this to silent cross-tenant introspection. AVG Art. 32 / 5(1)(f) require purpose-bound access; there is no audit log of platform-admin reads. **HIGH.**
8. **No data-subject rights surface (Art. 15 access, Art. 17 erasure, Art. 20 portability).** No export endpoint, no self-service deletion, no soft-delete column, no retention schedule on `email_logs`, `notification_recipients`, `training_attendance`, `registrations`. **HIGH.**
9. **`themes_public_read` / `tenant_active_themes` / `tenant_seo_settings` / `news_categories` are world-readable (`using (true)`) — including for inactive/suspended tenants.** Token leakage of internal theme/SEO config is low harm, but the `using (true)` pattern indicates the team's mental model treats RLS as cosmetic for "public" data; the same pattern was incorrectly applied to `media_assets` (`media_public_read`). **MEDIUM.**
10. **Email logs (`email_logs`) and notifications (`notifications.content_text/html`) retain full message bodies with no TTL**, including invitation tokens and notification snippets that may contain minors' personal data. **MEDIUM.**

The system is **not production-ready under AVG** for processing minors' data without remediation of items 1, 4, 5 (CRITICAL) at minimum, and items 2, 3, 6, 7, 8 (HIGH) before scaled rollout. None of the findings require an architectural rewrite; they are a focused remediation programme of ~6 sprints (see §11).

---

## 2. Personal Data Inventory

| # | Table / Source | PII Category | Special Cat? | Minors? | Tenant scoped | RLS | Retention | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `auth.users` (Supabase) | Email, password hash | — | Indirect | No (global) | Supabase-managed | None | Linked to `profiles` |
| 2 | `profiles` | full_name, email | — | Indirect | No | Self + platform admin | None | `profiles_admin_read` lets ALL platform admins read ALL profiles |
| 3 | `tenant_memberships` | user↔tenant role | — | — | Yes | Self/admin | None | role in (platform_admin, tenant_admin, parent, member) |
| 4 | `members` | full_name, email, phone, **public_bio**, **show_in_public** | — | **Yes** | Yes | tenant admin only | None | No DOB column. `public_bio` exposed to anon via `public_trainers` view |
| 5 | `member_roles` | role label per member | — | Yes | via parent | Yes | None | athlete/trainer/staff/volunteer/parent |
| 6 | `member_links` | parent_member_id ↔ child_member_id | — | **Yes (child)** | Yes | tenant admin | None | Sole minor-detection signal |
| 7 | `athletes` | full_name, **date_of_birth**, athlete_code | — | **Yes** | Yes | tenant + parent self-read | None | DOB stored here, but separated from `members` |
| 8 | `parent_athlete_links` | parent_user_id ↔ athlete_id | — | **Yes** | Yes | parent self + tenant | None | Trigger enforces tenant consistency ✅ |
| 9 | `registrations` | parent_name, parent_email, parent_phone, child_name, child_age, **address, postal_code, city, date_of_birth, player_type**, message, agreed_terms, athletes_json | — | **Yes** | Yes | Public INSERT (anon) + tenant SELECT | None | `agreed_terms` is the only consent artefact |
| 10 | `groups`, `group_members` | team membership | — | Yes | Yes | tenant | None | |
| 11 | `membership_plans`, `member_memberships`, `membership_payment_logs` | financial: amount, status, paid_at | — | Indirect | Yes | tenant | None | |
| 12 | `member_invites` | email, full_name, token, invite_code, child_member_id | — | Yes | Yes | tenant + service-role public route | None | Tokens never expire from DB after acceptance |
| 13 | `news_posts` | content (may contain photos/names of minors) | — | Possible | Yes | Public read where `status='published'` | None | |
| 14 | `media_assets` | URL, path, uploaded_by | — | Possible | Yes | **PUBLIC SELECT (`using (true)`)** + storage bucket public | None | See §4 |
| 15 | **storage `tenant-media` bucket** | All uploaded photos/videos | — | **Yes** | Path-prefixed | **PUBLIC** read policy | None | URL = `<tenant_id>/<filename>` — guess/scrape feasible |
| 16 | `training_sessions` | title, description, location, time | — | Indirect | Yes | tenant + group member | None | |
| 17 | `training_attendance` | rsvp, attendance, **`absence_reason`, `attendance_reason`, trainer_note**, "injured" status, notes | **Health-adjacent** | **Yes** | Yes | tenant + self + parent | None | "injured" is potentially special-category if it implies medical condition |
| 18 | `notifications` + `_recipients` + `_targets` | title, content_html/text, recipient user_id | — | Yes | Yes | tenant + recipient self | None | Bodies never purged |
| 19 | `push_subscriptions` | endpoint, p256dh, auth, user_agent | Device fingerprint | Possible | Yes | self + tenant | None | UA stored indefinitely |
| 20 | `tenant_push_settings`, `platform_push_settings` (VAPID) | public + **VAPID PRIVATE KEY in DB** | Secret | — | tenant / global | platform admin | None | Private VAPID key stored unencrypted in `platform_push_settings.vapid_private_key` |
| 21 | `email_settings` (SMTP) | host, username, **password**, from_email | Secret | — | global | platform admin | None | SMTP password stored plaintext in DB |
| 22 | `email_templates` | subject, content_html/text | — | Indirect | Yes | tenant | None | |
| 23 | `email_logs` | recipient_email, subject, error, sent_at, **from_email**, provider | — | Possible | Yes | tenant read + platform write | None | No TTL — long-term mailing log |
| 24 | `tenant_email_settings` | reply_to, sender prefs | — | — | Yes | tenant | None | |
| 25 | `conversations`, `conversation_participants`, `messages` | private message bodies | — | Yes | Yes | participant + tenant admin | None | Tenant admin can read ALL conversations (incl. minors) |
| 26 | `posts` (Sprint 19) | content, media_url, visibility, target_id, coach_broadcast | — | Yes | Yes | tenant member + admin | None | RLS does NOT enforce team/private/trainers — see §10 |
| 27 | `post_likes`, `comments`, `social_mutes`, `post_mentions` | reactions, comment bodies, mute reason | — | Yes | Yes | mixed | None | |
| 28 | `social_settings` | minor_read_only, minor_team_feed_allowed, allow_* | — | — | Yes | member read, admin write | n/a | |
| 29 | `user_notification_preferences` | per-event opt-out | — | Yes | Yes | self + admin read | None | |
| 30 | `themes`, `tenant_active_themes`, `user_theme_preferences` | UI prefs | — | — | Yes / global | **Public read (`using (true)`)** | None | Cosmetic |
| 31 | `tenant_custom_pages`, `tenant_seo_settings`, `tenant_page_seo` | CMS content | — | Possible | Yes | Public read | None | `requires_auth` enforced only in app code |
| 32 | `tenant_modules`, `alerts`, `media_wall_items`, `sponsors`, `tenant_social_links` | CMS modules | — | Possible | Yes | Public read for active tenants | None | |
| 33 | `tenant_roles`, `tenant_role_permissions`, `tenant_member_roles` | Custom RBAC | — | — | Yes | tenant | None | |
| 34 | `profile_picture_templates`, `tenant_profile_picture_settings`, `member_profile_pictures` | template choice (no real photo today) | — | Yes | mixed | Yes | None | |

---

## 3. Risk Register

| ID | Title | Area | Severity | Likelihood | Impact | Status |
|---|---|---|---|---|---|---|
| R-01 | Storage bucket `tenant-media` is publicly readable for ALL paths | Media | **CRITICAL** | High | Mass disclosure of minors' photos/videos | Open |
| R-02 | `media_assets.media_public_read` policy returns `using (true)` for any anon | Media | **CRITICAL** | High | Inventory of every uploaded file leaks (URL + path + uploader) | Open |
| R-03 | No granular lawful-basis / parental consent recording | Consent / minors | **CRITICAL** | Certain | Art. 6 + Art. 8 violation; no defence vs. AP enforcement | Open |
| R-04 | Minor detection relies on `member_links` only; no DOB check; UAVG age (16) not encoded | Minors | **CRITICAL** | High | Adult posts/likes from minors mis-classified; consent thresholds unenforceable | Open |
| R-05 | Service-role admin client used in all public actions → RLS is decorative | API/RLS | **HIGH** | Certain | A logic bug = tenant breach; no defence-in-depth | Open |
| R-06 | Social-feed RLS does not enforce visibility (team/private/trainers) | Social feed | **HIGH** | Medium | Direct PostgREST/RLS bypass returns private posts cross-cohort | Open |
| R-07 | Push notification body leaks 200 chars of message/comment content to lock screen | Notifications | **HIGH** | Certain | Confidentiality breach for shared phones / minors' devices | Open |
| R-08 | `profiles_admin_read` lets every platform admin read every profile | Hierarchy | **HIGH** | Certain | Disproportionate access; no purpose-binding; no audit | Open |
| R-09 | No data-subject rights endpoints (access, export, erasure) | User rights | **HIGH** | Certain | Art. 15-20 non-compliance | Open |
| R-10 | SMTP password and VAPID private key stored plaintext in DB | Secrets | **HIGH** | High | Any read access to two specific tables = full impersonation | Open |
| R-11 | No retention TTL on `email_logs`, `notifications`, `notification_recipients`, `messages`, `push_subscriptions` | Retention | **MEDIUM** | Certain | Unlimited storage of personal data; Art. 5(1)(e) violation | Open |
| R-12 | `tenant_admin` can read ALL `conversations`/`messages` of tenant via `conv_select` `has_tenant_access(tenant_id)` | Messaging / hierarchy | **HIGH** | Certain | Private messages between minors readable by club admin without justification or notice | Open |
| R-13 | `attendance_reason`/`absence_reason`/`injured`/`trainer_note` are health-adjacent and lack DPIA / category-9 controls | Attendance / health | **HIGH** | High | If "injured" stores medical context → Art. 9 special category w/o lawful basis | Open |
| R-14 | `parent_athlete_links` allows parent to read child's athlete row but offers no granular field minimisation | Minors | MEDIUM | Medium | Over-disclosure to non-custodial parent; no consent of co-parent | Open |
| R-15 | `member_invites` tokens & `email_logs` retain identifying tokens after acceptance/expiry | Security | MEDIUM | Medium | Replay risk if backups leak | Open |
| R-16 | `notifications.content_text/html` retains full body indefinitely | Retention | MEDIUM | Certain | Long-term storage of in-app notifications about minors | Open |
| R-17 | `themes_public_read`, `tat_public_read`, `tps_public_read`, `news_cat_public_read`, `tcp_public_read` use blanket `using (true)` — including for suspended tenants | RLS hygiene | MEDIUM | Certain | Status-bypass leakage; pattern signal of misuse | Open |
| R-18 | Public-trainers view and `show_in_public`/`public_bio` exposed to anon — no per-trainer consent recorded | Public exposure / consent | MEDIUM | High | Trainers may not have consented to listing | Open |
| R-19 | `news_posts` are world-readable; no opt-out for minors appearing in cover image / content | Public exposure / minors | MEDIUM | High | Minor's image published without verifiable consent | Open |
| R-20 | `messages.body` plaintext in DB; tenant admin readable; no end-to-end encryption | Messaging | MEDIUM | Certain | Reasonable for clubs but must be in privacy notice | Open |
| R-21 | `registrations` retains free-text `message`, `extra_details` indefinitely; ingested via anon `for insert with check (true)` | Registration | MEDIUM | Certain | Spam / large free-text PII; no rate limit visible at DB layer | Open |
| R-22 | No audit log of admin actions (who deleted/edited what, who viewed minor data) | Logging | MEDIUM | Certain | Cannot satisfy Art. 30 records; no incident forensics | Open |
| R-23 | `push_subscriptions.user_agent` retained indefinitely | Telemetry | LOW | Certain | Device fingerprint over time | Open |
| R-24 | `tenant_modules.config` JSONB allows arbitrary configuration including third-party embed URLs (video module) | Public exposure | LOW | Medium | Cross-site tracking via embedded YT/Vimeo without cookie consent | Open |
| R-25 | `email_settings.from_email` global SMTP — no DKIM/DMARC enforcement at app level | Deliverability/security | LOW | Medium | Minor; SES extension partially mitigates | Partially mitigated |
| R-26 | No CAPTCHA / rate limit on public registration POST | Abuse | LOW | High | Form spam → PII pollution | Open |
| R-27 | `notification_recipients_integrity` trigger ✅ closes UPDATE-pivot vector — note this is a strength | RLS | INFO | — | — | Mitigated |
| R-28 | `enforce_link_tenant_consistency` trigger ✅ blocks cross-tenant athlete linking | Tenant isolation | INFO | — | — | Mitigated |

---

## 4. Public Exposure Map

The following data is reachable **without authentication** today:

| Surface | Data exposed | Mechanism | AVG concern |
|---|---|---|---|
| `GET /t/{slug}` (homepage) | All `tenant_modules` rows where `visible_for='public'`; alerts (active window); media_wall_items; sponsors; news_posts (status=published); social_links | RLS `using (true)` / `is_active=true` + tenant `status='active'` | Photos/names of minors in news cover, media wall, alerts |
| `GET /t/{slug}/news`, `/nieuws`, `/news/{slug}` | News post content_html (rich text — may embed minors' photos & names) | `news_posts_public_read` `status='published'` | No consent capture for subjects appearing in articles |
| `GET /t/{slug}/p/{path}` (custom pages) | All `tenant_custom_pages` with `is_enabled=true`; `requires_auth` enforced ONLY in app code, the row itself is anon-readable | `tcp_public_read` `using (is_enabled=true)` | Minor disclosure if app check skipped |
| `GET /t/{slug}/inschrijven`, `/proefles`, `/register` | Forms collecting minor PII (DOB, address, parent contact) | Public route + `registrations_public_insert` `with check (true)` | No CAPTCHA; only `agreed_terms` boolean for consent |
| `GET /t/{slug}/invite/{token}` | Invite metadata (email, full_name, child_member_id) via service-role client | App route reads via admin client | Tokens single-use but never DB-purged |
| `GET /t/{slug}/login` | Standard auth | n/a | n/a |
| **storage.objects in `tenant-media`** | Any uploaded image/video where the URL is known | Bucket `public=true` + `tenant_media_public_read` for any select | **Mass enumeration trivially possible — minors' photos exposed** |
| `media_assets` table SELECT | URL + path + uploaded_by user_id of every upload | `media_public_read using (true)` | Even rows for deleted news / private uploads remain visible |
| `tenants` SELECT | All tenants where `status='active'` | `tenants_public_read` | Includes contact_email, domain |
| `themes`, `tenant_active_themes`, `tenant_seo_settings`, `tenant_page_seo` | Theme tokens + SEO defaults | `using (true)` | Low harm but inactive tenants leak |
| `public_trainers` view | id, tenant_id, full_name, public_bio of any member with role=trainer + `show_in_public=true` | `grant select to anon` | Per-trainer consent not recorded |
| `news_categories` | All categories cross-tenant | `using (true)` | Low harm |
| `tenant_social_links` (active) | Platform + URL | `tsl_public_read` | Low harm |

---

## 5. Role / Access Matrix

Effective access (combining schema RLS + service-role bypass in application):

| Resource | anon | parent (member) | athlete (member) | trainer/staff/volunteer (member) | tenant_admin | platform_admin |
|---|---|---|---|---|---|---|
| Own profile | — | R/W | R/W | R/W | R/W | R/W |
| Other profiles in tenant | — | — | — | — | — (no policy) | **R (all profiles, all tenants)** |
| `members` (own tenant) | — | own + child via link | own | own | full | full |
| `member_links` | — | own (via tenant admin only — see RLS) | — | — | full | full |
| `athletes` | — | linked child only | — | — | full | full |
| `registrations` | INSERT only | — | — | — | full | full |
| `news_posts` (published) | R | R | R | R | R/W | R/W |
| `media_assets` row | **R (all)** | R | R | R | R/W | R/W |
| `tenant-media` storage objects | **R (all)** | R | R | R | R/W (own tenant) | R/W |
| `posts` (social) | — | tenant filter only | tenant filter only | tenant filter only | full | full |
| `comments`, `post_likes` | — | tenant | tenant | tenant | full | full |
| `messages` | — | own conversations | own conversations | own conversations | **all conversations in tenant** | all |
| `notifications` | — | own delivered | own | own | full | full |
| `training_attendance` | — | own + child | own | full (via tenant access) | full | full |
| `email_logs` | — | — | — | — | tenant rows | all |
| `email_settings` (SMTP password) | — | — | — | — | — | **R (plaintext)** |
| `platform_push_settings` (VAPID priv) | — | R public key only | R | R | R | **R/W (plaintext priv)** |
| `tenant_memberships` | — | self | self | self | tenant | all |

**Findings:**
- `platform_admin` is effectively *super-user across every tenant's profiles, media, messages, attendance, notifications, push settings, SMTP creds*. There is no purpose-binding, no break-glass workflow, no audit trail. (R-08, R-22)
- `tenant_admin` can read every member's private messages and attendance reasons in the tenant without member awareness. Privacy notice + lawful-basis must mention this. (R-12, R-13)
- The `member` role in `tenant_memberships` is unused in practice — most authorization decisions are based on `member_roles` (athlete/trainer/staff/volunteer/parent) joined to the auth user via `members.user_id`. This dual model is confusing and increases bug surface.

---

## 6. Consent Gap Analysis (AVG Art. 6 / 7 / 8 / 9)

| Processing purpose | Lawful basis used today | Required by AVG | Gap |
|---|---|---|---|
| Account creation (adult member) | Implied by sign-up | 6(1)(b) contract | OK in principle, but no privacy-notice version pinned to user record |
| Minor athlete registration | `registrations.agreed_terms boolean` only | 6(1)(b) + Art. 8 (parental consent < 16 NL) + Art. 9 if health | **No verifiable parental consent**; no age-of-child gate; no consent text version stored |
| Photo/video upload of minors | None recorded | 6(1)(a) explicit consent or 6(1)(f) with balancing test documented | **Missing entirely** |
| Public listing of trainer name + bio (`show_in_public`) | `show_in_public` boolean toggled by tenant admin | 6(1)(a) consent of trainer | **No trainer-side consent record**; admin can flip on behalf of user |
| Social feed posting / commenting / liking by minor | `social_settings.minor_read_only` default `true` | Art. 8 if profiling/social | OK *only* when minor_read_only=true; flipping it to false is irrevocable choice not surfaced as parental consent |
| Coach broadcast & team posts containing minor content | None | 6(1)(b) if necessary for service | Acceptable but no logging |
| Push notifications | Browser permission + opt-out per event | 6(1)(a) consent (ePrivacy) | **No granular consent capture before subscribe**; only post-hoc opt-out |
| Email notifications | Default-on, opt-out via `user_notification_preferences` | 6(1)(b) for transactional / 6(1)(a) for marketing | Mixed; no distinction transactional vs marketing |
| Attendance tracking | App use | 6(1)(b) | OK; but `injured` / `absence_reason` may trigger Art. 9 |
| Health-adjacent: `injured` attendance, `absence_reason` (e.g. "ziek") | None | **Art. 9(2)(a) explicit consent** OR (h) preventive medicine — neither documented | **CRITICAL gap if "injured" or "ziek" stored** |
| Messaging between members | Implied | 6(1)(f) | OK, but admin readability not disclosed |
| Cookies / theme preference | None (server-side row) | ePrivacy not triggered for strictly-necessary | OK for theme; YouTube/Vimeo embed in `video` module triggers 3rd-party cookies → consent banner needed |
| Email logs retention | None | 5(1)(e) storage limitation | **No retention policy** |

**Recommended consent table (proposal — for Phase 2 design, NOT to be implemented in this audit):**

```
consents (id, tenant_id, user_id, member_id, subject_member_id, purpose_key,
          consent_version, granted_at, withdrawn_at, evidence_text, granted_by_user_id)
```

with `purpose_key` ∈ {`processing_basic`, `photo_publication`, `social_feed_minor`, `health_attendance`, `marketing_email`, `push_marketing`, `trainer_public_listing`, `messaging`}.

---

## 7. Minor-Athlete Protection Review

**Detection logic (`src/lib/permissions/social.ts` + `src/lib/auth/user-role-rules.ts` via `isMinorAthlete`):**

```
isMinorViewer = roles.includes('athlete') && member_links exists where child_member_id = me
```

**Findings:**

| # | Finding | Severity |
|---|---|---|
| M-01 | No `date_of_birth` on `members`. DOB only on `athletes` and `registrations`. The runtime "minor" flag never consults DOB. | CRITICAL |
| M-02 | An athlete *without* a `member_links` parent row (orphaned, transferred club, parent left tenant) is treated as ADULT and gets full posting/commenting rights even if 8 years old. | CRITICAL |
| M-03 | An adult athlete (e.g. 25y senior team member) who happens to have a `member_links` row (e.g. ageing parent linked them as caretaker) is treated as MINOR — incorrect restriction. | MEDIUM |
| M-04 | UAVG legal age threshold (16) for valid consent in NL is not encoded anywhere. | CRITICAL |
| M-05 | `social_settings.minor_read_only` defaults to `true` ✅ (good), and `minor_team_feed_allowed` defaults `false` ✅. These are tenant-wide flags — no per-minor override possible. | LOW |
| M-06 | `posts` of a minor's `team` group are blocked from minor view by app code (`getFeedPosts`), but not by RLS — direct API/PostgREST query bypasses. | HIGH |
| M-07 | A minor's `member_id` may appear as `target_id` in any `posts.visibility='private'` row created by another member without the minor's (or parent's) consent. The minor sees it; parent does not. | HIGH |
| M-08 | Minors can be `@mention`-ed in posts without their consent; mention triggers a push to the minor with the snippet of the post body. | HIGH |
| M-09 | Photos of minors are uploaded into the public `tenant-media` bucket with no flag, no metadata, no consent reference, no expiry. | CRITICAL |
| M-10 | Parent–child link is binary; no concept of co-parents (joint custody) or non-custodial parents. Either listed parent gets full access. | MEDIUM |
| M-11 | Minor's `training_attendance.notes` and `trainer_note` (free text) may contain medical/behavioural commentary, fully readable by every tenant_admin. | HIGH |
| M-12 | Minor's profile picture template choice is self-modifiable (`mpp_self_update`) — fine. | INFO |
| M-13 | No "minor" badge in tenant admin UI; admins editing members do not see whether subject is < 16. | MEDIUM |

---

## 8. Media & Storage Review

**Bucket configuration (`storage.sql:8-11`):**
```
insert into storage.buckets (id, name, public)
values ('tenant-media', 'tenant-media', true);
```

**Read policy (`storage.sql:38-40`):**
```
create policy "tenant_media_public_read"
  on storage.objects for select
  using (bucket_id = 'tenant-media');
```

**`media_assets` policy (`schema.sql:436-437`):**
```
create policy "media_public_read" on public.media_assets
  for select using (true);
```

**Combined effect:** Every uploaded file's URL, path, and uploader user_id is enumerable via PostgREST (anonymous), and every storage object is fetchable directly. Path convention `<tenant_id>/<filename>` provides no obscurity once `tenant_id` is known (and tenants are listed publicly).

**Findings:**

| ID | Finding | Severity |
|---|---|---|
| ME-01 | Bucket is `public=true` (top-level) — even with stricter policies the bucket is reachable via the public URL pattern Supabase provides. | **CRITICAL** |
| ME-02 | `tenant_media_public_read` is unconditional. | **CRITICAL** |
| ME-03 | `media_public_read using (true)` enumerates the catalogue. | **CRITICAL** |
| ME-04 | No virus / EXIF / size scanning visible at app layer. EXIF GPS in minor's photo would be published. | HIGH |
| ME-05 | No deletion job; orphan files (referenced by deleted `news_posts`/`posts`/`alerts`/`sponsors`) remain forever. | MEDIUM |
| ME-06 | No watermark / minor-content tagging. | LOW |
| ME-07 | Social-feed posts with `visibility='private'`/`'team'` reference `media_url` which lives in the same public bucket → "private" media is publicly fetchable. | **CRITICAL** |
| ME-08 | Profile-picture template `image_url` is fine (template imagery), but member-uploaded avatars (if added later) would inherit the bucket's public-read by default. | MEDIUM |

---

## 9. Social Feed Review (Sprint 19)

The feed implementation has the correct *intent* — strong app-layer permission helpers (`canPostToSocial`, `canCommentOnPost`, `canLikePost`, `canViewPost`), explicit minor-read-only default, and a moderation surface (`social_mutes`, `is_hidden`). However:

| ID | Finding | Severity |
|---|---|---|
| SF-01 | `posts_select` RLS only checks `fn_is_tenant_member(tenant_id) AND is_hidden=false`. **Visibility (team / private / trainers) is enforced ONLY in TypeScript (`canViewPost`).** | **HIGH** |
| SF-02 | The read path uses `createAdminClient()` (service role), so even the partial RLS policy is irrelevant in production. | **HIGH** |
| SF-03 | Visibility filter is post-fetch (`overscan = limit*3`, then `.filter(canViewPost)`), so an attacker calling Supabase directly bypasses entirely. | **HIGH** |
| SF-04 | `canViewPost('private')` accepts viewer if their member_id is the `target_id` *or* if viewer is the author — fine, but private posts are still tenant-readable through the `pl_select`/`cm_select` like/comment policies for any tenant member. | MEDIUM |
| SF-05 | A `coach_broadcast` post fan-outs push to ALL members (`target_type:'all'`) with `pushUrl=/feed/{id}` — every push body is `content?.slice(0, 200)`. Lock-screen disclosure. | HIGH |
| SF-06 | Mention of a minor → push notification with snippet of the post — without parental consent. | HIGH |
| SF-07 | `social_mutes` has no `muted_until` enforcement at DB level — purely app-checked via `isMemberMuted()`. | MEDIUM |
| SF-08 | `comments.parent_id` 2-level depth enforced only in app. | LOW |
| SF-09 | `post_likes` & `comments` RLS allow all tenant members to read counts/authorship of likes on a `private` post they cannot view → indirect inference. | MEDIUM |
| SF-10 | No rate limit on `createPost`/`createComment`/`toggleLike`. | LOW |
| SF-11 | `posts.media_url` references the public bucket → "private" post media is anonymously fetchable (see ME-07). | **CRITICAL** |
| SF-12 | `social_settings.allow_mentions` flag exists but `persistMentions` runs whenever `mentioned_member_ids` are sent — bypass via direct API. | MEDIUM |

**Strengths to preserve:**
- `canPostToSocial`/`canCommentOnPost` correctly default-deny when settings missing.
- `minor_read_only=true` and `minor_team_feed_allowed=false` defaults are conservative.
- `social_mutes` UPSERT with `unique(tenant_id, member_id)` is correct.
- `coach_broadcast` requires `canCoachBroadcast(roles)` — good.

---

## 10. API & RLS Review

**Service-role usage:** `rg createAdminClient` returns ≥ 50 modules including every public server action (`createPost`, `createComment`, `toggleLike`, `registrations`, `push`, `notification-prefs`, `theme-pref`, `trainings`, `koppel-kind`) and every read path (`getFeedPosts`, `getViewerVisibilityContext`, `homepage`, `messages`). RLS is therefore an advisory layer.

**Problematic RLS patterns:**

| Policy | Issue |
|---|---|
| `media_public_read using (true)` | Open enumeration |
| `themes_public_read`, `tat_public_read`, `news_cat_public_read`, `tcp_public_read using (is_enabled=true)`, `tps_public_read`, `tss_public_read` | Use `using (true)` or near-true; ignore tenant `status='suspended'` |
| `posts_select using (fn_is_tenant_member(tenant_id) and is_hidden=false)` | Misses team/private/trainers visibility |
| `pl_select`, `cm_select` | Tenant-wide select on likes/comments enables inference of private post existence |
| `notif_recipients_self_update` | Allows user to set `is_read=true` arbitrarily — fine, but trigger only blocks pivot of FK columns; `created_at` could be tampered (low) |
| `conv_select` & `msg_select` | Tenant admin can read all messages — must be disclosed in privacy notice |
| `profiles_admin_read` | Cross-tenant profile read for any platform admin |

**Defense-in-depth wins to preserve:**
- `enforce_link_tenant_consistency` trigger on `parent_athlete_links`
- `notification_recipients_integrity` trigger blocks notification_id/tenant_id pivot on UPDATE
- `tenant_memberships_role_tenant_check` enforces NULL tenant for platform_admin
- `tenant_media_first_segment_uuid()` validates path prefix before UUID cast (avoids policy crash)

**API surface:**
- Only `/api/posts/*` exists (the rest is server actions). The `/api/posts` GET correctly checks viewer is tenant member or admin before delegating to `getFeedPosts`. POST delegates to `createPost` which itself does authz. ✅
- No CSRF token visible — Next.js Server Actions provide built-in protection, but the `/api/posts` route bypasses that and accepts JSON; consider Origin/SameSite checks. (LOW)

---

## 11. Implementation Roadmap (Phases 2 – 7)

> **Phase 1 (this report)** is investigation only. The phases below are a *recommended* roadmap — they are **NOT** to be executed under this audit task.

### Phase 2 — Confidentiality Lockdown (≈ 1 sprint, blocking for production)
- Make `tenant-media` bucket **private**; introduce signed-URL service for reads (server-side authorization).
- Replace `media_public_read using (true)` with tenant-member visibility + signed URL read.
- Tighten `posts_select` RLS to encode visibility (`tenant`/`team`/`trainers`/`private`) at DB level using a `SECURITY DEFINER` helper that joins on `group_members` / `member_roles` / `member_links`.
- Drop service-role usage from public read paths (`getFeedPosts`, homepage, news listing). Service role limited to: invite acceptance, system posts, push fan-out, atomic notification RPC.
- Add Origin/CSRF check to `/api/posts/*`.

### Phase 3 — Minor & Consent Layer (≈ 2 sprints)
- Add `members.date_of_birth` (or `birth_year` for minimisation) and a `is_minor` GENERATED column based on `current_date - dob >= 16` (UAVG threshold).
- Introduce `consents` table (see §6) with `purpose_key`, `consent_version`, `evidence_text`, `granted_by_user_id`.
- Re-implement `isMinorAthlete()` to consult DOB; deprecate the `member_links`-based heuristic.
- Add parental-consent gate on registration form (`/inschrijven`, `/proefles`, `/register`) — separate consents for: processing, photo publication, social-feed visibility, push, health-adjacent attendance reasons.
- Add a "minor" badge in tenant admin UI; restrict `show_in_public` toggle on minors to require parental consent record.

### Phase 4 — User Rights & Retention (≈ 1 sprint)
- `GET /t/{slug}/profile/data-export` — JSON export of all rows where `user_id = me` or `member.user_id = me` or `parent_member_id = my member_id`.
- `POST /t/{slug}/profile/erase` — soft-delete + 30-day grace + cascade to `posts`, `comments`, `likes`, `messages`, `attendance`, `media_assets` (re-anonymise), `notifications`.
- Retention jobs:
  - `email_logs`: 12 months
  - `notifications` + `_recipients`: 90 days for non-actionable, 12 months for actionable
  - `messages`: tenant-configurable, default 24 months
  - `member_invites`: purge tokens on accept; hard-delete after `expires_at + 30d`
  - `push_subscriptions`: deactivate after 90 d inactivity
  - `training_attendance`: purge `notes`, `trainer_note`, `*_reason` after 24 months; keep aggregates

### Phase 5 — Confidentiality of Notifications & Messages (≈ 1 sprint)
- Push body collapses to neutral "Nieuwe melding" + count; deep-link only carries the URL.
- Tenant admin access to `messages`/`conversations` requires explicit "open as admin" action that writes an audit row.
- Rotate VAPID keys; move SMTP password and VAPID private key to Supabase Vault / env-secret only references; DB stores opaque references.

### Phase 6 — Hierarchy & Audit (≈ 1 sprint)
- Replace `profiles_admin_read` with purpose-bound break-glass policy + `admin_access_log`.
- Add `audit_log(actor_user_id, tenant_id, action, target_table, target_id, before_jsonb, after_jsonb, ts)` written by triggers for: `members`, `member_links`, `training_attendance`, `posts`, `comments`, `social_mutes`, `tenant_memberships`, `messages` (admin reads), media deletes.
- Make `member` role enum on `tenant_memberships` definitive; deprecate dual `member_roles` model OR document mapping.

### Phase 7 — Hardening & DPIA (≈ 1 sprint)
- DPIA document for: minors processing, social feed, attendance health-adjacent fields, public CMS.
- Privacy-notice surface (`/t/{slug}/p/privacy`) with version-pin and re-consent triggers.
- CAPTCHA + rate-limit on public registration.
- EXIF stripping + size limits on media uploads; auto-tag minor faces (out of scope of bare AVG but good practice).
- 3rd-party embed (YouTube/Vimeo in `video` module) consent banner.

---

## 12. Exact Fix Backlog

> Per-row, file-anchored backlog for the engineering team. **No code changes performed under this audit.**

| ID | File / Object | Line ref | Change requested | Phase |
|---|---|---|---|---|
| FB-01 | `supabase/storage.sql` | 9-11 | Set `public=false` on bucket `tenant-media` | 2 |
| FB-02 | `supabase/storage.sql` | 38-40 | Replace `tenant_media_public_read` with auth-only policy that joins via `media_assets` to verify viewer can see referencing row | 2 |
| FB-03 | `supabase/schema.sql` | 436-437 | Drop `media_public_read using (true)`; replace with `(public_visibility = true and tenants.status='active')` and add `media_assets.public_visibility boolean default false` | 2 |
| FB-04 | `supabase/sprint19_social_feed.sql` | 173-178 | Replace `posts_select` with visibility-aware policy (`SECURITY DEFINER` helper computing tenant/team/private/trainers) | 2 |
| FB-05 | `src/lib/db/social.ts` | 60, 121-127 | Stop using `createAdminClient()` for read path; switch to authenticated supabase client; remove `limit*3` overscan | 2 |
| FB-06 | `src/lib/actions/public/social.ts` | 107, 197, 240, 280, 333, 440, 464, 477, 537 | Use authenticated client for INSERT/UPDATE/DELETE wherever possible; isolate service-role usage to system_post / achievement_post helpers | 2 |
| FB-07 | `src/app/api/posts/route.ts` | 39-46 | Add Origin / SameSite check | 2 |
| FB-08 | `supabase/schema.sql` | members table | Add `date_of_birth date` + `is_minor` generated column (UAVG age 16) | 3 |
| FB-09 | NEW `supabase/sprint20_consent.sql` | — | Create `consents` table per §6; add FKs and RLS (self-read, tenant-admin-read, evidence immutable) | 3 |
| FB-10 | `src/lib/auth/user-role-rules.ts` | `isMinorAthlete` | Replace heuristic with DOB-based check; keep parent-link as separate boolean | 3 |
| FB-11 | `src/app/t/[slug]/inschrijven/page.tsx` + `/proefles` + `/register` | form | Replace single `agreed_terms` with multi-purpose consent checkboxes; persist into `consents` with version | 3 |
| FB-12 | `supabase/sprint12.sql` | 110-128 | Add CHECK or move free-text `notes`/`trainer_note`/`absence_reason`/`attendance_reason` into separate `training_attendance_notes` table with retention TTL + admin audit | 4 |
| FB-13 | NEW `supabase/sprint20_retention.sql` | — | TTL functions + pg_cron for `email_logs`, `notifications`, `messages`, `push_subscriptions`, `member_invites` | 4 |
| FB-14 | NEW `src/app/t/[slug]/profile/data-export/route.ts` | — | Implement Art. 15 export (JSON dump scoped to viewer) | 4 |
| FB-15 | NEW `src/lib/actions/public/erase-account.ts` | — | Implement Art. 17 soft-delete with 30-day grace + cascade | 4 |
| FB-16 | `src/lib/push/send-push.ts` | 72-76 | Strip `body`; send neutral "Nieuwe melding" + `url`; or make per-tenant configurable with consent | 5 |
| FB-17 | `src/lib/notifications/send-notification.ts` | 75-76, 183 | Stop persisting raw `content_text/html` for minor-targeting events; store reference id only | 5 |
| FB-18 | `supabase/schema.sql` | 38-39 (email_settings) | Move `password` to Vault reference column; same for `platform_push_settings.vapid_private_key` (sprint13.sql:78) | 5 |
| FB-19 | `supabase/sprint17.sql` | 96-122 (conv_select) | Wrap tenant-admin select with `audit_log_admin_message_access()` SECURITY DEFINER helper | 5 |
| FB-20 | `supabase/schema.sql` | 360-361 (profiles_admin_read) | Replace with `admin_break_glass` policy that requires a row in `admin_access_grants` (TTL'd) | 6 |
| FB-21 | NEW `supabase/sprint20_audit.sql` | — | `audit_log` table + per-table triggers for §11 Phase 6 list | 6 |
| FB-22 | `supabase/sprint15.sql` | 45-46, 73-74, 198-199, 226 | Tighten `using (true)` to `tenants.status='active'` join; same for `news_categories`, `tenant_modules`, `alerts`, `media_wall_items`, `sponsors`, `themes`, `tat`, `seo` | 2 |
| FB-23 | `supabase/sprint18_homepage_cms.sql` | public_trainers view | Require a `consents` row of type `trainer_public_listing` for the trainer; drop `show_in_public` admin-toggle authority | 3 |
| FB-24 | `src/app/t/[slug]/inschrijven/page.tsx` etc. | — | Add CAPTCHA + per-IP rate limit at edge / middleware | 7 |
| FB-25 | `src/lib/notifications/send-notification.ts` | 183 (push body slice) | Replace `plain.slice(0,200)` with `''` for events involving minors | 5 |
| FB-26 | `supabase/sprint19_social_feed.sql` | 88-95 (post_mentions) | Add: cannot mention a minor unless `consents.purpose_key='social_mention'` exists for subject | 3 |
| FB-27 | `supabase/sprint13.sql` | 27-39 (push_subscriptions) | Add `last_used_at` + auto-deactivate trigger after 90d | 4 |
| FB-28 | `src/app/(tenant)/tenant/members/[id]/page.tsx` | trainer-public-settings component | Remove ability for tenant admin to flip `show_in_public` for a member without that member's consent record | 3 |
| FB-29 | NEW privacy notice routes | — | `/t/{slug}/p/privacy`, `/t/{slug}/p/cookies` with versioning | 7 |
| FB-30 | `supabase/sprint10.sql` | member_invites | Add nightly purge of `token` after status in (`accepted`,`revoked`,`expired`) | 4 |

---

### Audit closure

**Investigation completed; no production data was queried, no code, configuration, RLS policy, or migration was modified.** All findings derive from static source review of files listed in the cover header. The roadmap and backlog are recommendations — execution is governed by separate, approved sprints under Phases 2 – 7.
