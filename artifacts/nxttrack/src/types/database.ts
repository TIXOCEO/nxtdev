/**
 * NXTTRACK — Database row types.
 * Mirrors /supabase/schema.sql.
 */

export type Role = "platform_admin" | "tenant_admin" | "parent" | "member";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  contact_email: string | null;
  status: string;
  domain: string | null;
  /** True once the tenant's `domain` is DKIM-verified with the email provider. */
  email_domain_verified: boolean;
  settings_json: Record<string, unknown>;
  /** Per-tenant audit-log retentie in maanden. NULL = nooit opschonen. */
  audit_retention_months: number | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMembership {
  id: string;
  /** NULL for platform_admin, otherwise the tenant id. */
  tenant_id: string | null;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface NewsCategory {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export type NewsPostStatus = "draft" | "published" | "archived";

export interface NewsPost {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_json: Record<string, unknown> | null;
  content_html: string | null;
  cover_image_url: string | null;
  category_id: string | null;
  status: NewsPostStatus | string;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RegistrationStatus = "new" | "contacted" | "accepted" | "rejected" | "archived";
export type RegistrationType = "tryout" | "registration";
export type RegistrationTarget = "self" | "child";
export type PlayerType = "player" | "goalkeeper";

export type TryoutMembershipStatus =
  | "new"
  | "contacted"
  | "invited"
  | "completed"
  | "declined";
export type AspirantMembershipStatus =
  | "aspirant"
  | "accepted"
  | "rejected"
  | "archived";
export type MembershipStatus = TryoutMembershipStatus | AspirantMembershipStatus;

export interface RegistrationAthleteEntry {
  full_name: string;
  date_of_birth: string;
  player_type: PlayerType;
}

export interface Registration {
  id: string;
  tenant_id: string;
  // Legacy fields (kept for back-compat with the original sprint-1 form).
  parent_name: string | null;
  parent_email: string;
  parent_phone: string | null;
  child_name: string | null;
  child_age: number | null;
  message: string | null;
  status: RegistrationStatus | string;
  // Sprint 7 additions
  type: RegistrationType | string | null;
  membership_status: MembershipStatus | string | null;
  registration_target: RegistrationTarget | string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  date_of_birth: string | null;
  player_type: PlayerType | string | null;
  agreed_terms: boolean | null;
  extra_details: string | null;
  athletes_json: RegistrationAthleteEntry[] | null;
  created_at: string;
}

export interface MediaAsset {
  id: string;
  tenant_id: string;
  url: string;
  path: string;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Athlete {
  id: string;
  tenant_id: string;
  full_name: string;
  date_of_birth: string | null;
  athlete_code: string;
  created_at: string;
  updated_at: string;
}

export type ParentAthleteLinkStatus = "active" | "pending" | "revoked";

export interface ParentAthleteLink {
  id: string;
  tenant_id: string;
  parent_user_id: string;
  athlete_id: string;
  link_status: ParentAthleteLinkStatus | string;
  created_at: string;
}

// ── Sprint 8: Member Management ──────────────────────────────

export type MemberStatus =
  // Legacy (sprint 8/9) — blijven geldig in DB-check
  | "prospect"
  | "new"
  | "contacted"
  | "accepted"
  | "rejected"
  | "paused"
  | "cancelled"
  // Sprint 23 canonieke set
  | "invited"
  | "aspirant"
  | "pending"
  | "active"
  | "inactive"
  | "archived";

export type MemberRoleName = "parent" | "athlete" | "trainer" | "staff" | "volunteer";

// Sprint 23 — accounttype bepaalt onboarding-flow + admin/usershell rechten.
export type AccountType =
  | "athlete"
  | "minor_athlete"
  | "parent"
  | "trainer"
  | "staff";

export type Gender = "male" | "female" | "other";
// PlayerType al gedefinieerd bij Sprint 12 (registrations).
export type PaymentMethodType = "contant" | "rekening" | "incasso" | "overig";

// Sprint 16 — Custom tenant roles
export type TenantRoleScope = "admin" | "usershell";

export interface TenantRole {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  sort_order: number;
  /** Sprint 22 — 'admin' = backend (tenant admin shell), 'usershell' = frontend. */
  scope: TenantRoleScope;
  /** Sprint 22 — automatisch alle permissies, lock in UI. */
  is_super_admin: boolean;
  /** Sprint 30 — markeert deze custom rol als trainer (voor profiel-tab + trainerskaartjes). */
  is_trainer_role: boolean;
  created_at: string;
  updated_at: string;
}
export interface TenantRolePermission {
  role_id: string;
  permission: string;
  created_at: string;
}
export interface TenantMemberRoleLink {
  tenant_id: string;
  member_id: string;
  role_id: string;
  created_at: string;
}

// Sprint 17 — Social links
export interface TenantSocialLink {
  id: string;
  tenant_id: string;
  platform: string;
  url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Sprint 17 — Messaging
export interface Conversation {
  id: string;
  tenant_id: string;
  title: string;
  created_by_member_id: string;
  created_at: string;
  last_message_at: string;
}
export interface ConversationParticipant {
  conversation_id: string;
  member_id: string;
  tenant_id: string;
  last_read_at: string | null;
  added_at: string;
}
export interface Message {
  id: string;
  conversation_id: string;
  tenant_id: string;
  sender_member_id: string;
  body: string;
  created_at: string;
}

export interface Member {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  member_status: MemberStatus | string;
  /** Sprint 10: optional auth-user link (set when an invite is accepted). */
  user_id: string | null;
  /** Sprint 18: trainers public bio. */
  public_bio: string | null;
  /** Sprint 18: opt-in for the public Trainers homepage module. */
  show_in_public: boolean;
  // Sprint 23 — gestructureerde persoons-/adresvelden + accounttype.
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  gender: Gender | string | null;
  player_type: PlayerType | string | null;
  account_type: AccountType | string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  archived_at: string | null;
  archived_by: string | null;
  // Sprint 24 / Sprint F — admin-only velden.
  member_since: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Sprint 23 — financiële gegevens per member (1:1).
export interface MemberFinancialDetails {
  member_id: string;
  tenant_id: string;
  iban: string | null;
  account_holder_name: string | null;
  payment_method_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Sprint 23 — beheersbare betaalmethoden per tenant.
export interface PaymentMethod {
  id: string;
  tenant_id: string;
  name: string;
  type: PaymentMethodType | string;
  description: string | null;
  iban_for_rekening: string | null;
  sort_order: number;
  archived_at: string | null;
  /** Sprint 30 — tenant-default methode; max 1 per tenant. */
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberRole {
  id: string;
  member_id: string;
  role: MemberRoleName | string;
}

export interface MemberLink {
  id: string;
  tenant_id: string;
  parent_member_id: string;
  child_member_id: string;
  created_at: string;
}

export interface Group {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  member_id: string;
  created_at: string;
}

export type BillingPeriod = "monthly" | "quarterly" | "yearly" | "custom";

export interface MembershipPlan {
  id: string;
  tenant_id: string;
  name: string;
  price: number | null;
  billing_period: BillingPeriod | string | null;
  is_active: boolean;
  /** Sprint 30 — tenant-default plan; max 1 per tenant via partial unique. */
  is_default: boolean;
  created_at: string;
}

export type MemberMembershipStatus =
  | "active"
  | "paused"
  | "ended"
  | "cancelled";

export interface MemberMembership {
  id: string;
  member_id: string;
  membership_plan_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: MemberMembershipStatus | string;
  /** Sprint 30 — gezet door endMemberMembership. */
  ended_at: string | null;
  end_reason: string | null;
  created_at: string;
}

export type PaymentLogStatus =
  | "paid"
  | "due"
  | "partial"
  | "overdue"
  | "waived"
  | "refunded"
  | "cancelled";

export type PaymentPeriod = "maand" | "jaar" | "anders";

export interface MembershipPaymentLog {
  id: string;
  member_membership_id: string;
  /** Legacy (Sprint 8). Bestaande rijen behouden hun waarde; nieuwe rijen
   *  schrijven `amount_paid` en `amount_expected`. */
  amount: number | null;
  amount_paid: number | null;
  amount_expected: number | null;
  status: PaymentLogStatus | string;
  paid_at: string | null;
  due_date: string | null;
  period: PaymentPeriod | string | null;
  membership_plan_id: string | null;
  paid_via_payment_method_id: string | null;
  parent_payment_id: string | null;
  /** Snapshot van amount_paid vóór dat restant-children werden geboekt. */
  original_amount_paid: number | null;
  note: string | null;
  created_at: string;
}

export interface MembershipPaymentAudit {
  id: string;
  payment_id: string;
  tenant_id: string;
  actor_user_id: string | null;
  action: "updated" | "deleted";
  note: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

// ── Sprint 9: email infrastructure ────────────────────────

export interface EmailTemplate {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  subject: string;
  content_html: string;
  content_text: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type EmailLogStatus = "sent" | "failed";

export interface EmailLog {
  id: string;
  tenant_id: string | null;
  template_key: string | null;
  recipient_email: string | null;
  subject: string | null;
  status: EmailLogStatus | string;
  error_message: string | null;
  trigger_source: string | null;
  /** Which provider dispatched the message (e.g. "sendgrid"). */
  provider: string | null;
  /** Actual From: address used for the send. */
  from_email: string | null;
  sent_at: string;
}

export interface TenantEmailSettings {
  id: string;
  tenant_id: string;
  emails_enabled: boolean;
  default_sender_name: string | null;
  reply_to_email: string | null;
  invite_expiry_days: number;
  max_resend_count: number;
  resend_cooldown_days: number;
  reminder_enabled: boolean;
  reminder_after_days: number;
  created_at: string;
  updated_at: string;
}

// ── Sprint 10: Onboarding (invites) ──────────────────────

export type InviteType =
  | "parent_account"
  | "trainer_account"
  | "staff_account"
  | "adult_athlete_account"
  | "minor_parent_link"
  | "complete_registration"
  | "add_existing_minor";

export type InviteStatus =
  | "pending"
  | "sent"
  | "opened"
  | "accepted"
  | "expired"
  | "revoked";

export interface MemberInvite {
  id: string;
  tenant_id: string;
  member_id: string | null;
  invite_type: InviteType | string;
  email: string;
  full_name: string | null;
  child_member_id: string | null;
  token: string;
  invite_code: string;
  status: InviteStatus | string;
  expires_at: string;
  resend_count: number;
  last_sent_at: string | null;
  accepted_at: string | null;
  accepted_user_id: string | null;
  created_by: string | null;
  /** Sprint 23 — JSON met geprefilde waarden voor de complete-registration wizard. */
  prefill_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTrigger {
  id: string;
  tenant_id: string;
  event_key: string;
  template_key: string;
  enabled: boolean;
  created_at: string;
}

// ── Sprint 11: Notifications ─────────────────────────────

export type NotificationTargetType = "member" | "group" | "role" | "all";

export interface Notification {
  id: string;
  tenant_id: string;
  title: string;
  content_html: string | null;
  content_text: string | null;
  source: string | null;
  source_ref: string | null;
  email_sent: boolean;
  created_by: string | null;
  created_at: string;
}

export interface NotificationTarget {
  id: string;
  notification_id: string;
  target_type: NotificationTargetType | string;
  target_id: string | null;
  created_at: string;
}

export interface NotificationRecipient {
  id: string;
  notification_id: string;
  tenant_id: string;
  member_id: string | null;
  user_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationEvent {
  id: string;
  tenant_id: string;
  event_key: string;
  template_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ── Sprint 12: Training schedule ─────────────────────────

export type TrainingSessionStatus = "scheduled" | "cancelled" | "completed";

export interface TrainingSession {
  id: string;
  tenant_id: string;
  group_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: TrainingSessionStatus | string;
  created_by: string | null;
  /** Sprint 35 — auto-reminder run marker (per session). */
  reminder_run_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AttendanceRsvp = "attending" | "not_attending" | "maybe";
export type AttendanceMark = "present" | "absent" | "late" | "injured";

/** Sprint 13 — reasons a member is absent (free-string for forward compat). */
export type AbsenceReason =
  | "ziekte"
  | "blessure"
  | "school"
  | "werk"
  | "vakantie"
  | "geen_vervoer"
  | "overig";

export interface TrainingAttendance {
  id: string;
  tenant_id: string;
  session_id: string;
  member_id: string;
  rsvp: AttendanceRsvp | string | null;
  rsvp_at: string | null;
  rsvp_by_user_id: string | null;
  rsvp_late: boolean;
  attendance: AttendanceMark | string | null;
  attendance_at: string | null;
  attendance_by_user_id: string | null;
  notes: string | null;
  /** Sprint 13 — selected reason when athlete RSVPs not_attending. */
  absence_reason: AbsenceReason | string | null;
  /** Sprint 13 — free text used when absence_reason = "overig". */
  attendance_reason: string | null;
  /** Sprint 13 — trainer-only note. Deprecated; replaced by `note` + `note_visibility`. */
  trainer_note: string | null;
  /** Sprint 35 — single trainer note (replaces notes + trainer_note). */
  note: string | null;
  /** Sprint 35 — `private` (trainers/staff only) or `member` (lid/ouder kan zien). */
  note_visibility: "private" | "member" | string;
  /** Sprint 35 — auto-reminder idempotency. */
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Sprint 35 — minimal LVS observation. */
export interface MemberObservation {
  id: string;
  tenant_id: string;
  member_id: string;
  author_user_id: string;
  session_id: string | null;
  body: string;
  visibility: "private" | "member" | string;
  created_at: string;
  updated_at: string;
}

export interface TenantTrainingSettings {
  id: string;
  tenant_id: string;
  reminder_hours_before: number;
  late_response_hours: number;
  notify_trainer_on_late: boolean;
  created_at: string;
  updated_at: string;
}

// ── Sprint 12: Profile picture templates ─────────────────

export interface ProfilePictureTemplate {
  id: string;
  /** NULL → platform-default template (visible to all tenants). */
  tenant_id: string | null;
  name: string;
  image_url: string;
  created_by: string | null;
  created_at: string;
}

export interface TenantProfilePictureSettings {
  id: string;
  tenant_id: string;
  default_template_id: string | null;
  allow_member_choose: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberProfilePicture {
  id: string;
  tenant_id: string;
  member_id: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Sprint 13: Push subscriptions + push settings ─────────

export interface PushSubscriptionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantPushSettings {
  id: string;
  tenant_id: string;
  push_enabled: boolean;
  /** Map of event_key → boolean. Missing key = enabled by default. */
  event_overrides: Record<string, boolean>;
  default_push_on_manual: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformPushSettings {
  id: string;
  singleton: boolean;
  vapid_public_key: string | null;
  vapid_private_key: string | null;
  vapid_subject: string;
  /** Empty array = all event keys allowed. */
  allowed_event_keys: string[];
  created_at: string;
  updated_at: string;
}

// ── Sprint 18 — Modular Homepage CMS ─────────────────────────
export interface ModuleCatalog {
  id: string;
  key: string;
  name: string;
  description: string | null;
  config_schema: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export type ModuleSize = "1x1" | "1x2" | "2x1" | "2x2";
export type ModuleVisibility = "public" | "logged_in";

export interface TenantModule {
  id: string;
  tenant_id: string;
  module_key: string;
  title: string | null;
  size: ModuleSize | string;
  position: number;
  position_mobile: number | null;
  /** Sprint 22 — 2D grid coordinates (admin/public renderer). x = 0|1, y >= 0. */
  position_x: number;
  position_y: number;
  /** Sprint 22 — width in cols (1 of 2) en height in rows (1 of 2). */
  w: number;
  h: number;
  visible_for: ModuleVisibility | string;
  visible_mobile: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type AlertType = "alert" | "announcement";
export interface Alert {
  id: string;
  tenant_id: string;
  title: string;
  content: string | null;
  type: AlertType | string;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MediaType = "image" | "video";
export interface MediaWallItem {
  id: string;
  tenant_id: string;
  title: string | null;
  media_url: string;
  media_type: MediaType | string;
  position: number;
  is_active: boolean;
  created_at: string;
}

export interface Sponsor {
  id: string;
  tenant_id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
}

export interface PublicTrainer {
  id: string;
  tenant_id: string;
  full_name: string;
  public_bio: string | null;
}

// ── Sprint 19 — Social Feed ──────────────────────────────────
export type PostType =
  | "user"
  | "system"
  | "achievement"
  | "coach_broadcast"
  | "training_recap"
  | "birthday";
export type PostVisibility = "tenant" | "team" | "trainers" | "private";
export type PostMediaType = "image" | "video";
export type PostEmoji = "👍" | "❤️" | "👏" | "🔥" | "💪" | "🎉";

export interface SocialSettings {
  tenant_id: string;
  allow_posts: boolean;
  allow_comments: boolean;
  allow_likes: boolean;
  allow_media: boolean;
  allow_auto_posts: boolean;
  allow_mentions: boolean;
  minor_read_only: boolean;
  minor_team_feed_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  tenant_id: string;
  author_member_id: string | null;
  type: PostType | string;
  content: string | null;
  media_url: string | null;
  media_type: PostMediaType | string | null;
  visibility: PostVisibility | string;
  target_id: string | null;
  comments_enabled: boolean;
  is_pinned: boolean;
  is_hidden: boolean;
  coach_broadcast: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostLike {
  id: string;
  tenant_id: string;
  post_id: string;
  member_id: string;
  emoji: PostEmoji | string;
  created_at: string;
}

export interface Comment {
  id: string;
  tenant_id: string;
  post_id: string;
  parent_id: string | null;
  author_member_id: string | null;
  content: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialMute {
  id: string;
  tenant_id: string;
  member_id: string;
  muted_until: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PostMention {
  id: string;
  tenant_id: string;
  post_id: string | null;
  comment_id: string | null;
  mentioned_member_id: string;
  created_at: string;
}

// ── Sprint 20: Newsletters ──────────────────────────────

export type NewsletterStatus = "draft" | "sending" | "sent" | "failed";
export type NewsletterAudienceType = "all" | "groups";

export interface Newsletter {
  id: string;
  tenant_id: string;
  title: string;
  preheader: string | null;
  content_html: string;
  content_text: string | null;
  status: NewsletterStatus;
  audience_type: NewsletterAudienceType;
  audience_group_ids: string[];
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  last_error: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
