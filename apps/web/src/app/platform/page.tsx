"use client";

import { useEffect, useState } from "react";

type Plan = { id: string; key: string; name: string; maxUsers: number | null; maxCompanies: number | null; maxStorageMb: number | null; supportLevel: string; modules: { moduleKey: string }[] };
type Tenant = { id: string; name: string; slug: string; status: string; _count: { memberships: number; companies: number }; subscriptions: { id: string; status: string; deploymentMode: string; billingInterval: string; currency: string; unitPrice: string; currentPeriodEnd: string; plan: { key: string; name: string } }[] };

const inputClass = "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]";

export default function PlatformAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [planId, setPlanId] = useState("");
  const [deploymentMode, setDeploymentMode] = useState("SHARED_CLOUD");
  const [billingInterval, setBillingInterval] = useState("MONTHLY");
  const [currency, setCurrency] = useState("IDR");
  const [unitPrice, setUnitPrice] = useState("0");
  const [periodEnd, setPeriodEnd] = useState("");
  const [status, setStatus] = useState("TRIAL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/platform/subscriptions", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load platform data.");
      setTenants(payload.tenants); setPlans(payload.plans);
      if (!tenantId && payload.tenants[0]) setTenantId(payload.tenants[0].id);
      if (!planId && payload.plans[0]) setPlanId(payload.plans[0].id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load platform data."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function provision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/subscriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, planId, deploymentMode, billingInterval, currency, unitPrice: Number(unitPrice), currentPeriodEnd: new Date(periodEnd).toISOString(), status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Provisioning failed.");
      setNotice("Subscription provisioned. Effective modules: " + (payload.effectiveModules.join(", ") || "none"));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Provisioning failed."); }
    finally { setSaving(false); }
  }

  return <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">ORVA / Platform</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">Platform administration</h1><p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">Manage customer tenants, product plans, deployment models and subscription provisioning.</p></div>
      <button onClick={() => void load()} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]">Refresh data</button>
    </header>

    {error && <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

    <section className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"><p className="text-sm text-[var(--muted-foreground)]">Customer tenants</p><p className="mt-2 text-3xl font-semibold">{tenants.length}</p></div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"><p className="text-sm text-[var(--muted-foreground)]">Active product plans</p><p className="mt-2 text-3xl font-semibold">{plans.length}</p></div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"><p className="text-sm text-[var(--muted-foreground)]">Deployment options</p><p className="mt-2 text-3xl font-semibold">3</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Shared · Dedicated · Self-hosted</p></div>
    </section>

    <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold">Customer tenants</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Latest 100 tenants and their most recent subscription.</p></div>
        {loading ? <p className="p-5 text-sm text-[var(--muted-foreground)]">Loading tenants…</p> : <div className="divide-y divide-[var(--border)]">{tenants.map((tenant) => {
          const sub = tenant.subscriptions[0];
          return <button key={tenant.id} onClick={() => setTenantId(tenant.id)} className={"flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[var(--muted)] " + (tenantId === tenant.id ? "bg-[var(--muted)]" : "")}>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{tenant.name}</span><span className="mt-1 block text-xs text-[var(--muted-foreground)]">{tenant.slug} · {tenant._count.memberships} users · {tenant._count.companies} companies</span></span>
            <span className="shrink-0 text-right"><span className="block text-xs font-medium">{sub?.plan.name ?? "No plan"}</span><span className="mt-1 block text-xs text-[var(--muted-foreground)]">{sub?.status ?? tenant.status}</span></span>
          </button>;
        })}{!tenants.length && <p className="p-5 text-sm text-[var(--muted-foreground)]">No customer tenants found.</p>}</div>}
      </div>

      <form onSubmit={provision} className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div><h2 className="font-semibold">Provision subscription</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Internal operator action. Replaces the tenant’s current effective subscription.</p></div>
        <div><label className={labelClass}>Customer tenant</label><select required value={tenantId} onChange={(e) => setTenantId(e.target.value)} className={inputClass}><option value="">Select tenant</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}</select></div>
        <div><label className={labelClass}>Product plan</label><select required value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}><option value="">Select plan</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.maxUsers ?? "Unlimited"} users</option>)}</select></div>
        <div><label className={labelClass}>Deployment model</label><select value={deploymentMode} onChange={(e) => setDeploymentMode(e.target.value)} className={inputClass}><option value="SHARED_CLOUD">Shared Cloud</option><option value="DEDICATED_CLOUD">Dedicated Cloud</option><option value="SELF_HOSTED">Self-hosted Enterprise</option></select></div>
        <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Billing interval</label><select value={billingInterval} onChange={(e) => setBillingInterval(e.target.value)} className={inputClass}><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option><option value="CUSTOM">Custom</option></select></div><div><label className={labelClass}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="PAST_DUE">Past due</option><option value="SUSPENDED">Suspended</option><option value="EXPIRED">Expired</option></select></div></div>
        <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Currency</label><input required maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputClass}/></div><div><label className={labelClass}>Unit price</label><input required min="0" step="0.01" type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={inputClass}/></div></div>
        <div><label className={labelClass}>Current period end</label><input required type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass}/></div>
        <button disabled={saving || !tenantId || !planId || !periodEnd} className="w-full rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Provisioning…" : "Provision subscription"}</button>
      </form>
    </section>
  </main>;
}
