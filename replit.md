# NXTTRACK Workspace

## Overview
NXTTRACK is a multi-tenant SaaS platform for managing sports academies. It provides a scalable and secure environment for public users, tenant administrators, and platform administrators. Key capabilities include public tenant pages (news, registration), tenant-specific administration (news, registration tracking, branding), and platform-level administration (tenant creation, management). The platform aims to streamline academy operations from public engagement to internal administration.

## User Preferences
I prefer the AI to
- Focus on completing the tasks requested.
- Use the existing libraries and frameworks.
- Not refactor the code unless explicitly asked.
- Provide concise summaries of changes in PRs.
- Not use many emojis.
- Ask clarifying questions if something is unclear.

## System Architecture
NXTTRACK is a pnpm monorepo using Next.js 15 App Router, TypeScript, Tailwind CSS v4, shadcn/ui, and Supabase.

### UI/UX Decisions
- **Theming**: Uses CSS custom properties mapped to Tailwind v4 for consistent styling.
- **Tenant Branding**: Tenants can apply a `primary_color` for custom branding on public pages.
- **Responsiveness**: Implements mobile responsiveness using Tailwind and shadcn/ui components.
- **Component Reusability**: Leverages shadcn/ui and custom components for consistent UI.

### Technical Implementations
- **Monorepo Structure**: Organized with `artifacts/nxttrack` (Next.js frontend) and `artifacts/api-server` (Express API).
- **Database**: PostgreSQL with Drizzle ORM, hosted on Supabase.
- **Authentication**: Email/password authentication managed by Supabase, with server-side and client-side session management. Platform admins create user accounts.
- **Authorization & Permissions**: Role-Based Access Control (RBAC) with `isPlatformAdmin`, `isTenantAdmin`, `hasMembership`, enforced via SQL RLS and TypeScript helpers.
- **Tenant Resolution**: `middleware.ts` identifies tenants from subdomain or path parameters, passing the slug via `x-tenant-slug` header.
- **API Codegen**: Orval generates API clients from an OpenAPI specification.
- **Data Access Layer**: Dedicated modules (`src/lib/db/*`) for specific database operations.
- **Server Actions**: Next.js Server Actions handle data mutations, secured with `assertTenantAccess` and Zod validation.
- **Rich Text Editor**: Integrated TipTap editor for news content creation, supporting rich formatting and image uploads.

### Feature Specifications
- **Public Tenant Pages**: Routes for tenant home, news, trial lessons, and registration, with legacy redirects. Includes forms for trial lesson and membership registration, validated with RHF + Zod.
- **Tenant Admin Dashboard**: Provides features for dashboard statistics, news management (CRUD, publish), tenant profile branding, and registration management. Includes member and group management with role-based access and membership plans.
- **Email Infrastructure**: Supports email sending via the SendGrid API with per-tenant sender resolution and customizable templates. Email logs are maintained, and tenant domain verification is supported.
- **Staff/trainer invite flow (Sprint 21)**: Tenant-admin "lid toevoegen" form supports a dedicated `staff_account` invite type (next to the existing `trainer_account`). Both map to a new `staff_invite` email template that includes a `{{function_label}}` variable derived from the member's `member_roles` (trainer/staf, with fallback to the invite-type default). Acceptance flow re-uses the simple name+password `AcceptAdultInviteForm` — no player/keeper choice and no kids-add UI. Backward-compat: `dispatchInvite` lazily seeds the `staff_invite` template row from `DEFAULT_TEMPLATES` for tenants that were created before sprint 21 (idempotent insert before send). Optional bulk backfill SQL: `supabase/sprint21_staff_invite_template.sql`.
- **Platform Admin Dashboard**: Allows platform administrators to manage tenants, including creation, editing, and master admin assignment. All actions are secured by `requirePlatformAdmin()`.
- **Themes (Sprint 15)**: Platform-admin theme manager (light/dark sets, full CSS-var control, scope=platform|tenant). Tenants choose which themes are active for their members; users pick auto/light/dark. Runtime injection via `ThemeStyleInjector` (server-rendered `<style>` for both modes; wrapper class `theme-light`/`theme-dark`/`theme-auto` chosen from `nxt-mode` cookie or user preference; `theme-auto` uses `prefers-color-scheme`). Two seeded defaults: NXTTRACK Light/Dark.
- **Custom Tenant Pages (Sprint 15)**: Tenant admins build menu + submenu pages with slug, optional auth-gate, on/off + show-in-menu flags. Routed at `/t/[slug]/p/[...path]`; reserved top-level slugs blocked. Renders inside `PublicTenantShell` and is auto-injected into the public sidebar under "Pagina's".
- **Tenant SEO (Sprint 15)**: Per-tenant SEO defaults (title, template, description, og:image, og:site_name, twitter handle) plus per-page overrides keyed by `page_path`. News posts have their own `seo_*` columns for per-post automation. `composeMetadata()` builds Next.js `Metadata` from tenant + override + per-call hints; wired into `/t/[slug]/layout.tsx`, news index/detail, and custom pages.
- **Apex Marketing Site (Dutch)**: Public marketing site at root domain (`nxttrack.nl`) for prospect acquisition. Built in `src/app/(marketing)/` route group, served alongside platform/tenant routes; `middleware.ts` skips apex/www so no rewrite conflict. Pages: home (`/`), features overview + 6 detail pages (`leerlingvolgsysteem`, `gamification`, `clubfeed`, `ledenbeheer`, `certificaten`, `communicatie`), voor-wie overview + 5 sector pages (`sportverenigingen`, `zwemscholen`, `sportscholen`, `academies`, `dansscholen`), `voor-sporters`, `prijzen` (op-maat tarieven), `roadmap`, `over-ons`, `contact`, `privacy`, `voorwaarden`. Shared data in `src/lib/marketing/site-data.ts` (FEATURES, SECTORS, PRIMARY_NAV, FOOTER_GROUPS, ROADMAP, STATS, TRUST_POINTS, HOW_IT_WORKS, SITE). Components in `src/components/marketing/`: `site-header` (NavigationMenu desktop + Sheet mobile, keyboard-a11y submenu), `site-footer`, `section`+`EyebrowHeading` (`as` prop voor h1/h2/h3), `scroll-reveal` (framer-motion met fallback), `icon-frame` (lucide-iconen als image-placeholders, lime/ivory/midnight tonen), `feature-card`, `cta-block`, `feature-detail` + `sector-detail` templates, `contact-form` (RHF + zodResolver). Stylering: lime accent #b6d83b (#3f5a08 voor tekst), rounded-3xl containers, light-mode only. Contactformulier via Server Action `src/lib/actions/marketing/contact.ts` met Zod-validatie (`src/lib/validation/marketing.ts`), honeypot `_company`, e-mail naar `MARKETING_LEAD_RECIPIENT` env (fallback `MAIL_DEFAULT_FROM_EMAIL` → `hallo@nxttrack.nl`) via bestaande `sendRawEmail`. SEO: per-page metadata, `sitemap.ts` + `robots.ts` op root. Logo geladen van `dgwebservices.nl` (toegevoegd aan `next.config.ts` `images.remotePatterns`). Root `<html lang="nl">`.

### System Design Choices
- **Monorepo**: Centralizes code and tooling.
- **App Router**: Utilizes Next.js 15 for server components and routing.
- **Supabase Integration**: Deep integration for Auth, Database, and Storage with extensive RLS.
- **Server-Side Rendering (SSR) / Server Actions**: Enhances performance and security.
- **Zod for Validation**: Ensures robust input validation.

## External Dependencies
- **Supabase**: Database (PostgreSQL), Authentication, Storage.
- **Next.js 15**: Frontend framework.
- **Express 5**: Backend API.
- **Drizzle ORM**: PostgreSQL ORM.
- **Tailwind CSS v4**: Styling.
- **shadcn/ui**: Component library.
- **lucide-react**: Icon library.
- **Orval**: API client code generation.
- **TipTap**: Rich text editor.
- **@sendgrid/mail**: SendGrid HTTPS API client for outbound email.
- **Zod**: Schema validation.