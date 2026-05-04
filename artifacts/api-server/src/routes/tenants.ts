import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tenantsTable, tenantUsersTable, activityEventsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  CreateTenantBody,
  UpdateTenantBody,
  GetTenantParams,
  UpdateTenantParams,
  DeleteTenantParams,
  ListTenantUsersParams,
  CreateTenantUserParams,
  CreateTenantUserBody,
  DeleteTenantUserParams,
  GetTenantActivityParams,
  GetTenantActivityQueryParams,
  GetTenantDashboardParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/tenants", async (req, res) => {
  const tenants = await db.select().from(tenantsTable).orderBy(desc(tenantsTable.createdAt));
  const result = await Promise.all(
    tenants.map(async (t) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tenantUsersTable)
        .where(eq(tenantUsersTable.tenantId, t.id));
      return { ...t, userCount: countResult?.count ?? 0 };
    })
  );
  res.json(result);
});

router.post("/tenants", async (req, res) => {
  const body = CreateTenantBody.parse(req.body);
  const [tenant] = await db
    .insert(tenantsTable)
    .values({ id: randomUUID(), ...body, updatedAt: new Date() })
    .returning();
  res.status(201).json({ ...tenant, userCount: 0 });
});

router.get("/tenants/:slug", async (req, res) => {
  const { slug } = GetTenantParams.parse(req.params);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.tenantId, tenant.id));
  res.json({ ...tenant, userCount: countResult?.count ?? 0 });
});

router.patch("/tenants/:slug", async (req, res) => {
  const { slug } = UpdateTenantParams.parse(req.params);
  const body = UpdateTenantBody.parse(req.body);
  const [existing] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!existing) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const [updated] = await db
    .update(tenantsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(tenantsTable.slug, slug))
    .returning();
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.tenantId, updated.id));
  res.json({ ...updated, userCount: countResult?.count ?? 0 });
});

router.delete("/tenants/:slug", async (req, res) => {
  const { slug } = DeleteTenantParams.parse(req.params);
  await db.delete(tenantsTable).where(eq(tenantsTable.slug, slug));
  res.status(204).send();
});

router.get("/tenants/:slug/users", async (req, res) => {
  const { slug } = ListTenantUsersParams.parse(req.params);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const users = await db
    .select()
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.tenantId, tenant.id))
    .orderBy(desc(tenantUsersTable.createdAt));
  res.json(users);
});

router.post("/tenants/:slug/users", async (req, res) => {
  const { slug } = CreateTenantUserParams.parse(req.params);
  const body = CreateTenantUserBody.parse(req.body);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const [user] = await db
    .insert(tenantUsersTable)
    .values({ id: randomUUID(), tenantId: tenant.id, ...body })
    .returning();

  await db.insert(activityEventsTable).values({
    id: randomUUID(),
    tenantId: tenant.id,
    userId: user.id,
    userName: user.name,
    action: "added",
    resource: "user",
    resourceId: user.id,
  });

  res.status(201).json(user);
});

router.delete("/tenants/:slug/users/:userId", async (req, res) => {
  const { slug, userId } = DeleteTenantUserParams.parse(req.params);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  await db
    .delete(tenantUsersTable)
    .where(eq(tenantUsersTable.id, userId));
  res.status(204).send();
});

router.get("/tenants/:slug/activity", async (req, res) => {
  const { slug } = GetTenantActivityParams.parse(req.params);
  const query = GetTenantActivityQueryParams.parse(req.query);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const events = await db
    .select()
    .from(activityEventsTable)
    .where(eq(activityEventsTable.tenantId, tenant.id))
    .orderBy(desc(activityEventsTable.createdAt))
    .limit(query.limit ?? 20);
  res.json(events);
});

router.get("/tenants/:slug/dashboard", async (req, res) => {
  const { slug } = GetTenantDashboardParams.parse(req.params);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const users = await db
    .select()
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.tenantId, tenant.id));

  const recentActivityResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityEventsTable)
    .where(eq(activityEventsTable.tenantId, tenant.id));

  const membersByRole: Record<string, number> = {};
  for (const u of users) {
    membersByRole[u.role] = (membersByRole[u.role] ?? 0) + 1;
  }

  const storageCapacityMb = tenant.plan === "enterprise" ? 100000 :
    tenant.plan === "pro" ? 10000 :
    tenant.plan === "starter" ? 1000 : 100;

  res.json({
    totalUsers: users.length,
    activeUsers: users.length,
    plan: tenant.plan,
    storageUsedMb: Math.round(Math.random() * storageCapacityMb * 0.4),
    storageCapacityMb,
    recentActivityCount: recentActivityResult[0]?.count ?? 0,
    membersByRole,
  });
});

export default router;
