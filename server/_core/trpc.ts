import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { isConfiguredAdminEmail, resolveUserPermissions } from "../db";
import type { UserPermissions } from "../../drizzle/schema";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.user.isActive) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const protectedProcedure = t.procedure.use(requireUser);
export function hasUserPermission(user: NonNullable<TrpcContext["user"]>, permission: keyof UserPermissions) { return user.role === "admin" || isConfiguredAdminEmail(user.email) || resolveUserPermissions(user)[permission]; }
export const manageUsersProcedure = protectedProcedure.use(t.middleware(async ({ ctx, next }) => { if (!ctx.user || !hasUserPermission(ctx.user, "manageUsers")) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG }); return next({ ctx }); }));
export const adminProcedure = t.procedure.use(t.middleware(async ({ ctx, next }) => { if (!ctx.user || !ctx.user.isActive || (ctx.user.role !== "admin" && !isConfiguredAdminEmail(ctx.user.email))) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG }); return next({ ctx: { ...ctx, user: ctx.user } }); }));
