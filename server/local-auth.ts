import type { Request } from "express";
import { parse } from "cookie";
import { jwtVerify, SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getUserById } from "./db";
const issuer = "vistoria-cautelar-local";
function secret() { if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required"); return new TextEncoder().encode(ENV.cookieSecret); }
function requestToken(req: Request) { const auth = req.headers.authorization; if (auth?.startsWith("Bearer ")) return auth.slice(7).trim(); return parse(req.headers.cookie || "")[COOKIE_NAME] || null; }
export async function createLocalSessionToken(userId: number) { return new SignJWT({ userId, authType: "local" }).setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setIssuedAt().setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000)).sign(secret()); }
export async function authenticateAnyRequest(req: Request) { const token = requestToken(req); if (token) { try { const { payload } = await jwtVerify(token, secret(), { issuer }); const user = await getUserById(Number(payload.userId)); if (user?.isActive) return user; } catch {} } return sdk.authenticateRequest(req); }
