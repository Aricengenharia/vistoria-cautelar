import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export type UserPermissions = { createInspections: boolean; editInspections: boolean; viewAllInspections: boolean; exportReports: boolean; reviewInspections: boolean; approveInspections: boolean; manageUsers: boolean };

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  permissions: json("permissions").$type<UserPermissions>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const inspections = mysqlTable("inspections", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  sequentialCode: varchar("sequentialCode", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["Em elaboração", "Concluído", "Conferido", "Aprovado"]).default("Em elaboração").notNull(),
  propertyAddress: varchar("propertyAddress", { length: 500 }).notNull(),
  propertyType: varchar("propertyType", { length: 120 }),
  payload: json("payload").notNull(),
  publicToken: varchar("publicToken", { length: 96 }).unique(),
  publicTokenExpiresAt: timestamp("publicTokenExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;
