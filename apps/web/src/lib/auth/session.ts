import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant/resolve-context";
import type { VerifiedTenantContext } from "@/lib/tenant/access";

export const ORVA_SESSION_COOKIE = "orva_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, tenantId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const session = await db.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      tenantId,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
  const cookieStore = await cookies();
  cookieStore.set(ORVA_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return session;
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ORVA_SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: { select: { id: true, email: true, name: true, status: true } },
      tenant: { select: { id: true, slug: true, name: true, status: true } },
    },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE" ||
    session.tenant.status !== "ACTIVE"
  ) return null;

  return session;
}

export async function getVerifiedTenantContext(): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;
  context: VerifiedTenantContext;
} | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const context = await resolveTenantContext(session.userId, session.tenant.slug);
  return context ? { session, context } : null;
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ORVA_SESSION_COOKIE)?.value;
  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.set(ORVA_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
