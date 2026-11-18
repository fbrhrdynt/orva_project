import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlatformOperator } from "@/lib/platform/access";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const operator = await getPlatformOperator(["OWNER", "ADMIN"]);
  if (!operator) return NextResponse.json({ error: "Platform Owner or Admin access required." }, { status: 403, headers: { "Cache-Control": "no-store" } });

  const { tenantId } = await context.params;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const action = input && typeof input === "object" && "action" in input ? (input as { action?: unknown }).action : null;
  if (action !== "ARCHIVE" && action !== "RESTORE") return NextResponse.json({ error: "Action must be ARCHIVE or RESTORE." }, { status: 400 });

  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true, status: true } });
  if (!tenant) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  if (tenant.slug === "febroherdyanto-admin") return NextResponse.json({ error: "The ORVA Platform Owner workspace cannot be archived." }, { status: 409 });

  const nextStatus = action === "ARCHIVE" ? "ARCHIVED" : "ACTIVE";
  if (tenant.status === nextStatus) return NextResponse.json({ ok: true, status: nextStatus, unchanged: true });

  await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenant.id }, data: { status: nextStatus } });
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId: operator.userId,
        action: action === "ARCHIVE" ? "platform.tenant.archived" : "platform.tenant.restored",
        entityType: "Tenant",
        entityId: tenant.id,
        severity: action === "ARCHIVE" ? "WARNING" : "INFO",
        metadata: { workspaceId: tenant.slug, action, performedBy: operator.role },
      },
    });
  });

  return NextResponse.json({ ok: true, status: nextStatus }, { headers: { "Cache-Control": "no-store" } });
}
