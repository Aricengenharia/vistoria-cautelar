import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { hasUserPermission, manageUsersProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";
import { canAdvanceInspectionStatus, stampWorkflowActor, WORKFLOW_STATUSES, type InspectionStatus } from "../shared/inspection-workflow";

const permissionsSchema = z.object({ createInspections: z.boolean(), editInspections: z.boolean(), viewAllInspections: z.boolean(), exportReports: z.boolean(), reviewInspections: z.boolean(), approveInspections: z.boolean(), manageUsers: z.boolean() });
const inspectionStatusSchema = z.enum(WORKFLOW_STATUSES);
function requirePermission(user: Parameters<typeof hasUserPermission>[0], permission: Parameters<typeof hasUserPermission>[1]) { if (!hasUserPermission(user, permission)) throw new TRPCError({ code: "FORBIDDEN", message: "Permissão não liberada para este usuário" }); }

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  inspections: router({
    nextCode: protectedProcedure.query(() => db.getNextInspectionCode()),
    list: protectedProcedure.query(({ ctx }) => db.listInspections(hasUserPermission(ctx.user, "viewAllInspections") ? undefined : ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => db.getInspection(input.id, hasUserPermission(ctx.user, "viewAllInspections") ? undefined : ctx.user.id)),
    create: protectedProcedure.input(z.object({ status: inspectionStatusSchema.default("Em elaboração"), propertyAddress: z.string().min(1).max(500), propertyType: z.string().max(120).optional(), payload: z.unknown() })).mutation(({ ctx, input }) => { requirePermission(ctx.user, "createInspections"); if (input.status !== "Em elaboração") requirePermission(ctx.user, "editInspections"); return db.saveInspection({ ownerUserId: ctx.user.id, status: input.status, propertyAddress: input.propertyAddress, propertyType: input.propertyType, payload: input.payload }); }),
    update: protectedProcedure.input(z.object({ id: z.number(), status: inspectionStatusSchema.optional(), propertyAddress: z.string().min(1).max(500).optional(), propertyType: z.string().max(120).optional(), payload: z.unknown().optional() })).mutation(async ({ ctx, input }) => {
      const current = await db.getInspection(input.id, hasUserPermission(ctx.user, "viewAllInspections") ? undefined : ctx.user.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Vistoria não encontrada ou sem acesso" });
      const nextStatus = input.status as InspectionStatus | undefined;
      const statusChanged = nextStatus && nextStatus !== current.status;
      if (statusChanged && !canAdvanceInspectionStatus(current.status as InspectionStatus, nextStatus)) throw new TRPCError({ code: "BAD_REQUEST", message: "O relatório deve seguir a sequência: Em elaboração → Concluído → Conferido → Aprovado" });
      const review = nextStatus === "Conferido";
      const approve = nextStatus === "Aprovado";
      if (review) requirePermission(ctx.user, "reviewInspections"); else if (approve) requirePermission(ctx.user, "approveInspections"); else requirePermission(ctx.user, "editInspections");
      const unrestricted = hasUserPermission(ctx.user, "viewAllInspections") || review || approve;
      let payload = input.payload;
      if (statusChanged && nextStatus) {
        const currentPayload = current.payload && typeof current.payload === "object" && !Array.isArray(current.payload) ? current.payload as Record<string, unknown> : {};
        const incomingPayload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload as Record<string, unknown> : {};
        const actorName = ctx.user.name?.trim() || ctx.user.email || "Usuário não identificado";
        payload = stampWorkflowActor({ ...currentPayload, ...incomingPayload }, nextStatus, actorName);
      }
      return db.updateInspection(input.id, unrestricted ? undefined : ctx.user.id, { status: input.status, propertyAddress: input.propertyAddress, propertyType: input.propertyType, payload });
    }),
    uploadMedia: protectedProcedure.input(z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().min(3).max(100), base64: z.string().min(1).max(30_000_000) })).mutation(async ({ ctx, input }) => { requirePermission(ctx.user, "editInspections"); const safePath = input.fileName.split("/").filter(Boolean).filter((segment) => segment !== "." && segment !== "..").map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "-")).filter(Boolean).join("/"); if (!safePath) throw new TRPCError({ code: "BAD_REQUEST", message: "Nome de arquivo inválido" }); return storagePut(`inspections/${ctx.user.id}/${safePath}`, Buffer.from(input.base64, "base64"), input.mimeType); }),
    createPublicLink: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => { requirePermission(ctx.user, "exportReports"); return db.createPublicInspectionLink(input.id, hasUserPermission(ctx.user, "viewAllInspections") ? undefined : ctx.user.id); }),
    createPublicDraft: protectedProcedure.mutation(async ({ ctx }) => { requirePermission(ctx.user, "createInspections"); const draft = await db.createPublicDraft(ctx.user.id); const link = await db.createPublicInspectionLink(draft.id, ctx.user.id); return { ...draft, ...link }; }),
    revokePublicLink: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => { requirePermission(ctx.user, "exportReports"); return db.revokePublicInspectionLink(input.id, hasUserPermission(ctx.user, "viewAllInspections") ? undefined : ctx.user.id); }),
  }),
  publicInspections: router({
    getByToken: publicProcedure.input(z.object({ token: z.string().min(32).max(96) })).query(({ input }) => db.getInspectionByPublicToken(input.token)),
    submit: publicProcedure.input(z.object({ token: z.string().min(32).max(96), payload: z.unknown(), propertyAddress: z.string().min(1).max(500), propertyType: z.string().max(120).optional() })).mutation(({ input }) => db.submitPublicInspection(input.token, input.payload, input.propertyAddress, input.propertyType)),
  }),
  admin: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => { const canSeeAll = hasUserPermission(ctx.user, "viewAllInspections"); const [users, inspections] = await Promise.all([canSeeAll || hasUserPermission(ctx.user, "manageUsers") ? db.listUsers() : Promise.resolve([]), db.listInspections(canSeeAll ? undefined : ctx.user.id)]); return { users, inspections, totals: { users: users.length, inspections: inspections.length, elaborating: inspections.filter((item) => item.status === "Em elaboração").length, concluded: inspections.filter((item) => item.status === "Concluído").length, reviewed: inspections.filter((item) => item.status === "Conferido").length, approved: inspections.filter((item) => item.status === "Aprovado").length } }; }),
    users: manageUsersProcedure.query(() => db.listUsers()),
    createUser: manageUsersProcedure.input(z.object({ name: z.string().min(2).max(160), email: z.string().email().max(320), password: z.string().min(8).max(128), role: z.enum(["user", "admin"]), permissions: permissionsSchema })).mutation(({ input }) => db.createLocalUser(input)),
    updateUser: manageUsersProcedure.input(z.object({ id: z.number(), name: z.string().min(2).max(160), role: z.enum(["user", "admin"]), isActive: z.boolean(), permissions: permissionsSchema })).mutation(({ ctx, input }) => { if (input.id === ctx.user!.id && (!input.isActive || input.role !== "admin")) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível remover o próprio acesso administrativo" }); return db.updateLocalUserAccess(input.id, input); }),
    resetPassword: manageUsersProcedure.input(z.object({ id: z.number(), password: z.string().min(8).max(128) })).mutation(({ input }) => db.resetLocalUserPassword(input.id, input.password)),
  }),
});
export type AppRouter = typeof appRouter;
