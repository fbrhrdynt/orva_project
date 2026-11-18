import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

function throttleKey(email: string, ip: string): string {
  return createHash("sha256").update(`${email}| ${ip}`).digest("hex");
}

async function isBlocked(key: string): Promise<boolean> {
  const now = new Date();
  const row = await db.authThrottle.findUnique({ where: { key } });
  if (!row) return false;
  if (row.blockedUntil && row.blockedUntil > now) return true;
  if (now.getTime() - row.windowStartedAt.getTime() >= WINDOW_MS) {
    await db.authThrottle.update({
      where: { key },
      data: { attempts: 0, windowStartedAt: now, blockedUntil: null },
    });
    return false;
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.authThrottle.update({
      where: { key },
      data: { blockedUntil: new Date(now.getTime() + BLOCK_MS) },
    });
    return true;
  }
  return false;
}

async function recordFailure(key: string): Promise<void> {
  const now = new Date();
  const row = await db.authThrottle.findUnique({ where: { key } });
  if (!row) {
    await db.authThrottle.create({ data: { key, attempts: 1, windowStartedAt: now } }).catch(async () => {
      await db.authThrottle.update({ where: { key }, data: { attempts: { increment: 1 } } });
    });
    return;
  }
  if (now.getTime() - row.windowStartedAt.getTime() >= WINDOW_MS) {
    await db.authThrottle.update({
      where: { key },
      data: { attempts: 1, windowStartedAt: now, blockedUntil: null },
    });
    return;
  }
  const updated = await db.authThrottle.update({
    where: { key },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });
  if (updated.attempts >= MAX_ATTEMPTS) {
    await db.authThrottle.update({
      where: { key },
      data: { blockedUntil: new Date(now.getTime() + BLOCK_MS) },
    });
  }
}

async function clearFailures(key: string): Promise<void> {
  await db.authThrottle.updateMany({
    where: { key },
    data: { attempts: 0, blockedUntil: null, windowStartedAt: new Date() },
  });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Cross-origin login requests are not allowed." }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const tenantSlug = typeof input.tenantSlug === "string" ? input.tenantSlug.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 256 || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(tenantSlug)) {
      return NextResponse.json({ error: "Email, password, or workspace is invalid." }, { status: 400 });
    }

    const ip = request.headers.get("x-real-ip")?.trim() || "unknown";
    const key = throttleKey(email, ip);
    if (await isBlocked(key)) {
      return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, {
        status: 429,
        headers: { "Retry-After": "900", "Cache-Control": "no-store" },
      });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        status: true,
        memberships: {
          where: {
            status: "ACTIVE",
            tenant: { slug: tenantSlug, status: "ACTIVE" },
          },
          select: { tenantId: true, tenant: { select: { id: true, slug: true, name: true } } },
          take: 1,
        },
      },
    });

    const validPassword = await verifyPassword(password, user?.passwordHash ?? null);
    const membership = user?.memberships[0];
    if (!user || user.status !== "ACTIVE" || !validPassword || !membership) {
      await recordFailure(key);
      return NextResponse.json({ error: "Invalid email, password, or workspace." }, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const session = await createSession(user.id, membership.tenantId);
    await clearFailures(key);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
      tenant: membership.tenant,
      expiresAt: session.expiresAt.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
