import { pgTable, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planEnum = pgEnum("plan", ["free", "starter", "pro", "enterprise"]);
export const roleEnum = pgEnum("role", ["owner", "admin", "member", "viewer"]);

export const tenantsTable = pgTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  plan: planEnum("plan").notNull().default("free"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tenantUsersTable = pgTable("tenant_users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("member"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityEventsTable = pgTable("activity_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userAvatarUrl: text("user_avatar_url"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertTenantUserSchema = createInsertSchema(tenantUsersTable).omit({
  createdAt: true,
});

export const insertActivityEventSchema = createInsertSchema(activityEventsTable).omit({
  createdAt: true,
});

export type Tenant = typeof tenantsTable.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type TenantUser = typeof tenantUsersTable.$inferSelect;
export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
export type ActivityEvent = typeof activityEventsTable.$inferSelect;
export type InsertActivityEvent = z.infer<typeof insertActivityEventSchema>;
