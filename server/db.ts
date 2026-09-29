import { desc, eq } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertInspection, InsertUser, inspections, users, type UserPermissions } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
const configuredAdminEmails = () => new Set(ENV.adminEmails.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));

export function isConfiguredAdminEmail(email: string | null | undefined, configured = configuredAdminEmails()) {
  return email ? configured.has(email.trim().toLowerCase()) : false;
}

export const FULL_PERMISSIONS: UserPermissions = { createInspections: true, editInspections: true, viewAllInspections: true, exportReports: true, reviewInspections: true, approveInspections: true, manageUsers: true };
export const INSPECTOR_PERMISSIONS: UserPermissions = { createInspections: true, editInspections: true, viewAllInspections: false, exportReports: true, reviewInspections: false, approveInspections: false, manageUsers: false };
export function resolveUserPermissions(user: Pick<InsertUser, "role" | "permissions">): UserPermissions { return user.role === "admin" ? FULL_PERMISSIONS : { ...INSPECTOR_PERMISSIONS, ...(user.permissions ?? {}) }; }

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (isConfiguredAdminEmail(user.email) || user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0]; }
export async function getUserByEmail(email: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0]; }
export async function authenticateLocalUser(email: string, password: string) { const db = await getDb(); const user = await getUserByEmail(email); if (!db || !user?.passwordHash || !user.isActive || !(await compare(password, user.passwordHash))) return undefined; const lastSignedIn = new Date(); await db.update(users).set({ lastSignedIn }).where(eq(users.id, user.id)); return { ...user, lastSignedIn }; }
export async function createLocalUser(input: { name: string; email: string; password: string; role: "user" | "admin"; isActive?: boolean; permissions?: UserPermissions }) { const db = await getDb(); if (!db) throw new Error("Database not available"); const email = input.email.trim().toLowerCase(); if (await getUserByEmail(email)) throw new Error("E-mail já cadastrado"); await db.insert(users).values({ openId: `local_${randomUUID().replace(/-/g, "")}`, name: input.name.trim(), email, loginMethod: "local", role: input.role, passwordHash: await hash(input.password, 12), isActive: input.isActive ?? true, permissions: input.role === "admin" ? FULL_PERMISSIONS : input.permissions ?? INSPECTOR_PERMISSIONS, lastSignedIn: new Date() }); return getUserByEmail(email); }
export async function updateLocalUserAccess(id: number, input: { name?: string; role?: "user" | "admin"; isActive?: boolean; permissions?: UserPermissions }) { const db = await getDb(); if (!db) throw new Error("Database not available"); await db.update(users).set({ ...input, permissions: input.role === "admin" ? FULL_PERMISSIONS : input.permissions }).where(eq(users.id, id)); return getUserById(id); }
export async function resetLocalUserPassword(id: number, password: string) { const db = await getDb(); if (!db) throw new Error("Database not available"); await db.update(users).set({ passwordHash: await hash(password, 12), loginMethod: "local" }).where(eq(users.id, id)); return true; }

export async function getNextInspectionCode() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const latest = await db.select({ id: inspections.id }).from(inspections).orderBy(desc(inspections.id)).limit(1);
  const nextNumber = (latest[0]?.id ?? 0) + 1;
  return `VC-${new Date().getFullYear()}-${String(nextNumber).padStart(5, "0")}`;
}

export async function listInspections(ownerUserId?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(inspections).orderBy(desc(inspections.updatedAt));
  if (ownerUserId === undefined) return query;
  return query.where(eq(inspections.ownerUserId, ownerUserId));
}

export async function getInspection(id: number, ownerUserId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inspections).where(eq(inspections.id, id)).limit(1);
  if (!result[0] || (ownerUserId !== undefined && result[0].ownerUserId !== ownerUserId)) return undefined;
  return result[0];
}

export async function saveInspection(data: Omit<InsertInspection, "sequentialCode"> & { sequentialCode?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sequentialCode = data.sequentialCode ?? await getNextInspectionCode();
  const result = await db.insert(inspections).values({ ...data, sequentialCode });
  const [insertResult] = result as unknown as [{ insertId: number }];
  return { id: Number(insertResult?.insertId ?? 0), sequentialCode };
}

export async function updateInspection(id: number, ownerUserId: number | undefined, data: Partial<Pick<InsertInspection, "status" | "propertyAddress" | "propertyType" | "payload">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getInspection(id, ownerUserId);
  if (!existing) return undefined;
  await db.update(inspections).set(data).where(eq(inspections.id, id));
  return getInspection(id, ownerUserId);
}

export async function createPublicInspectionLink(id: number, ownerUserId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const inspection = await getInspection(id, ownerUserId);
  if (!inspection) return undefined;
  const publicToken = randomBytes(32).toString("hex");
  const publicTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.update(inspections).set({ publicToken, publicTokenExpiresAt }).where(eq(inspections.id, id));
  return { publicToken, publicTokenExpiresAt };
}

export async function createPublicDraft(ownerUserId: number) {
  return saveInspection({ ownerUserId, status: "Em elaboração", propertyAddress: "A preencher pelo convidado", propertyType: "Outro", payload: {} });
}

export async function revokePublicInspectionLink(id: number, ownerUserId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const inspection = await getInspection(id, ownerUserId);
  if (!inspection) return false;
  await db.update(inspections).set({ publicToken: null, publicTokenExpiresAt: null }).where(eq(inspections.id, id));
  return true;
}

export async function getInspectionByPublicToken(publicToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inspections).where(eq(inspections.publicToken, publicToken)).limit(1);
  const inspection = result[0];
  if (!inspection || !inspection.publicTokenExpiresAt || inspection.publicTokenExpiresAt.getTime() < Date.now()) return undefined;
  return inspection;
}

export async function submitPublicInspection(publicToken: string, payload: unknown, propertyAddress?: string, propertyType?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const inspection = await getInspectionByPublicToken(publicToken);
  if (!inspection) return undefined;
  await db.update(inspections).set({ payload, propertyAddress: propertyAddress || inspection.propertyAddress, propertyType: propertyType || inspection.propertyType, status: "Concluído" }).where(eq(inspections.id, inspection.id));
  return { id: inspection.id, sequentialCode: inspection.sequentialCode };
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, loginMethod: users.loginMethod, role: users.role, isActive: users.isActive, permissions: users.permissions, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt }).from(users).orderBy(desc(users.lastSignedIn));
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.id, id)).limit(1);
}
