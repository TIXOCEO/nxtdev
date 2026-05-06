# NXTTRACK

NXTTRACK is a multi-tenant SaaS platform for managing sports academies, offering public, tenant, and platform administration features.

## Run & Operate

- **Run Dev**: `pnpm dev`
- **Build**: `pnpm build`
- **Typecheck**: `pnpm typecheck`
- **Codegen**: `pnpm orval` (generates API clients)
- **DB Push**: `pnpm drizzle-kit push:pg` (schema migrations)

**Required Environment Variables**:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SENDGRID_API_KEY`
- `MAIL_DEFAULT_FROM_EMAIL`
- `MARKETING_LEAD_RECIPIENT`

## Stack

- **Frameworks**: Next.js 15 (App Router), Express 5
- **Runtime**: Node.js (latest LTS)
- **ORM**: Drizzle ORM
- **Validation**: Zod, React Hook Form
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Build Tool**: pnpm (monorepo)
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth

## Where things live

- **Frontend Application**: `artifacts/nxttrack/`
- **Backend API Server**: `artifacts/api-server/`
- **Database Schema**: `supabase/` (SQL migration files), `src/lib/db/schema.ts` (Drizzle schema)
- **API Contracts**: `openapi.yaml` (for Orval codegen)
- **Marketing Site Data**: `src/lib/marketing/site-data.ts`
- **Theming**: CSS custom properties mapped to Tailwind v4, `src/components/theme-style-injector.tsx`
- **Validation Schemas**: `src/lib/validation/`

## Architecture decisions

- **Monorepo Structure**: Centralized code and tooling using pnpm for `artifacts/nxttrack` (Next.js) and `artifacts/api-server` (Express).
- **Tenant Resolution**: `middleware.ts` identifies tenants via subdomain or path, passing `x-tenant-slug` header.
- **Role-Based Access Control (RBAC)**: Implemented with `isPlatformAdmin`, `isTenantAdmin`, `hasMembership`, enforced via SQL RLS and TypeScript helpers.
- **Server Actions for Mutations**: Next.js Server Actions used for data mutations, secured with `assertTenantAccess` and Zod validation.
- **Email Infrastructure**: SendGrid API for emails, with per-tenant sender resolution and customizable templates.

## Product

- **Public Tenant Pages**: Tenant-specific home, news, trial lessons, and registration with branding.
- **Tenant Admin Dashboard**: Management for news, registrations, tenant profile, members, groups, and membership plans.
- **Platform Admin Dashboard**: Tenant creation and management, master admin assignment.
- **Marketing Site**: Apex domain public website for prospect acquisition with feature overviews, sector-specific pages, and contact forms.
- **User Profile Management**: Users can manage general info, children, sports details, and financial information.
- **Audit Logging**: Persistent `public.audit_logs` table for tracking key actions, viewable by tenant/platform admins.
- **Release Notes**: Platform-admins beheren versies onder `/platform/releases` in een vast format (versie, type, datum, titel, samenvatting, secties Nieuw/Verbeterd/Opgelost/Voor admins). Tenant-admins zien de meest recente publicatie als vaste container op het dashboard, een chronologische lijst onder `/tenant/releases` en het versielabel onder "Powered by NXTTRACK" in de sidebar.

## User preferences

I prefer the AI to
- Focus on completing the tasks requested.
- Use the existing libraries and frameworks.
- Not refactor the code unless explicitly asked.
- Provide concise summaries of changes in PRs.
- Not use many emojis.
- Ask clarifying questions if something is unclear.

## Gotchas

- **Release notifications**: `sprint32_release_notifications.sql` adds `platform_release_notifications` (PK `(release_id, tenant_id)`, RLS: platform-admin select). `setReleaseStatus`/`createRelease`/`updateRelease` triggers `notifyTenantsAboutRelease`, idempotent per (release, tenant). E-mail naar tenant-admins is opt-in via `notification_events.event_key='platform_release_published'` (email_enabled).
- **Release notes seed**: `sprint31_release_notes.sql` voegt `platform_releases` toe (semver-uniek, RLS: platform-admin schrijft, ingelogde users lezen alleen `published`) en seedt de historische versies `0.1.0` → `0.9.0` (incl. enkele patches). Bij herhaling worden bestaande `version`-rijen niet overschreven.
- **Manual Supabase migrations (VPS)**: Run new sprint SQL files in `artifacts/nxttrack/supabase/` against the production DB in order. Apply in this order: `sprint30_trainer_bio.sql` (adds `tenant_roles.is_trainer_role`, `trainer_bio_sections/fields/answers` tables with RLS, `seed_trainer_bio_template` RPC and `trainer_cards` entry in `modules_catalog`), then `sprint30_payments_v2.sql` (adds `is_default` on `membership_plans` & `payment_methods` (one-default partial-unique index), extends `membership_payment_logs` with `amount_expected`/`amount_paid`/`period`/`due_date`/`parent_payment_id`/`original_amount_paid`, broadens status check (paid|due|partial|overdue|refunded|cancelled|waived), creates `membership_payment_audit` (payment_id nullable + ON DELETE SET NULL) plus atomic `set_membership_plan_default` / `set_payment_method_default` RPCs, and adds `ended_at`/`end_reason` on `member_memberships` (status enum incl. `ended`)). Also note: `sprint29_homepage_modules_v2.sql` relaxes `tenant_modules.size` check and seeds `news_hero_slider`, `image_slider`, `google_maps` in `modules_catalog`. Sprint 30 introduces migration of admin-actions to RLS; see `supabase/tests/sprint30_rls_admin_actions.sql` and `supabase/sprint30_admin_client_inventory.md`. Then apply `sprint30_homepage_layout_locks.sql` (adds `add_tenant_module` and `update_tenant_module_layout` RPCs that serialise homepage-layout writes per tenant via `pg_advisory_xact_lock`).
- **Tenant-scoped Operations**: Always ensure tenant context is correctly applied to prevent data leakage. `assertTenantAccess` is crucial.
- **RLS**: Supabase Row Level Security is fundamental for data isolation and access control; understand its implications before making schema changes.
- **Email Templates**: New tenants lazily seed `staff_invite` email templates; ensure consistency if modifying default templates.
- **Onboarding Rebuilds**: The onboarding flow has undergone significant rebuilds across multiple sprints; be aware of legacy paths vs. current implementations (e.g., `members` table is canonical for persons).

## Pointers

- **Supabase Docs**: `https://supabase.com/docs`
- **Next.js Docs**: `https://nextjs.org/docs`
- **Drizzle ORM Docs**: `https://orm.drizzle.team/docs/overview`
- **Tailwind CSS Docs**: `https://tailwindcss.com/docs`
- **shadcn/ui Docs**: `https://ui.shadcn.com/docs`
- **Zod Docs**: `https://zod.dev/`
- **Orval Docs**: `https://orval.dev/docs`
- **TipTap Docs**: `https://tiptap.dev/docs`
- **SendGrid Docs**: `https://docs.sendgrid.com/`