"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Building2, RefreshCw, ShieldCheck, Users, Boxes } from "lucide-react";

type Plan = { id: string; key: string; name: string; maxUsers: number | null; maxCompanies: number | null; maxStorageMb: number | null; supportLevel: string; modules: { moduleKey: string }[] };
type Tenant = { id: string; name: string; slug: string; status: string; _count: { memberships: number; companies: number }; subscriptions: { id: string; status: string; deploymentMode: string; billingInterval: string; currency: string; unitPrice: string; currentPeriodEnd: string; plan: { key: string; name: string } }[] };
const inputClass = "platform-input";
const labelClass = "platform-label";

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
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError(""); setForbidden(false);
    try {
      const response = await fetch("/api/platform/subscriptions", { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (response.status === 403) { setForbidden(true); throw new Error(payload.error || "Akun ini belum memiliki akses Platform Operator."); }
      if (!response.ok) throw new Error(payload.error || "Unable to load platform data.");
      setTenants(payload.tenants ?? []); setPlans(payload.plans ?? []);
      if (!tenantId && payload.tenants?.[0]) setTenantId(payload.tenants[0].id);
      if (!planId && payload.plans?.[0]) setPlanId(payload.plans[0].id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load platform data."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function provision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, planId, deploymentMode, billingInterval, currency, unitPrice: Number(unitPrice), currentPeriodEnd: new Date(periodEnd + "T23:59:59.999+07:00").toISOString(), status }) });
      const payload = await response.json();
      if (response.status === 403) { setForbidden(true); throw new Error(payload.error || "Akun ini belum memiliki akses Platform Operator."); }
      if (!response.ok) throw new Error(payload.error || "Provisioning failed.");
      setNotice("Subscription berhasil diprovisikan. Modul aktif: " + (payload.effectiveModules?.join(", ") || "tidak ada"));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Provisioning failed."); }
    finally { setSaving(false); }
  }

  return <main className="platform-page">
    <header className="platform-heading"><div><span className="platform-eyebrow">ORVA / PLATFORM CONTROL</span><h1>Platform administration</h1><p>Kelola tenant pelanggan, paket produk, model deployment, dan provisioning subscription.</p></div><button className="platform-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></header>
    {forbidden ? <section className="platform-access"><span><ShieldCheck size={25}/></span><div><h2>Akses Platform Operator diperlukan</h2><p>Halaman ini khusus administrator internal ORVA. Akun yang sedang digunakan belum memiliki role Platform Operator. Ini bukan berarti data tenant kosong.</p><p>Minta administrator platform memberikan role yang sesuai. Setelah role diberikan, muat ulang halaman ini.</p></div></section> : <>
      {error && <div role="alert" className="platform-alert">{error}</div>}{notice && <div role="status" className="platform-notice">{notice}</div>}
      <section className="platform-metrics"><article><span><Building2 size={16}/> Customer tenants</span><strong>{loading ? "—" : tenants.length}</strong><small>Tenant terdaftar di platform</small></article><article><span><Boxes size={16}/> Product plans</span><strong>{loading ? "—" : plans.length}</strong><small>Paket produk yang tersedia</small></article><article><span><Users size={16}/> Deployment options</span><strong>3</strong><small>Shared · Dedicated · Self-hosted</small></article></section>
      <section className="platform-grid"><div className="platform-panel"><div className="platform-panel-head"><div><h2>Customer tenants</h2><p>Tenant dan subscription terakhir</p></div><span>{tenants.length} tenants</span></div>{loading ? <p className="platform-empty">Memuat data tenant…</p> : tenants.length ? tenants.map(t => { const sub=t.subscriptions[0]; return <button key={t.id} className={"platform-tenant"+(tenantId===t.id?" is-selected":"")} onClick={()=>setTenantId(t.id)}><span><b>{t.name}</b><small>{t.slug} · {t._count.memberships} users · {t._count.companies} companies</small></span><span><b>{sub?.plan.name ?? "No plan"}</b><small>{sub?.status ?? t.status}</small></span></button>; }) : <p className="platform-empty">Belum ada tenant pelanggan terdaftar.</p>}</div>
        <form onSubmit={provision} className="platform-panel platform-form"><div className="platform-panel-head"><div><h2>Provision subscription</h2><p>Menetapkan paket dan masa berlaku subscription tenant.</p></div></div>
          <label>Customer tenant<select required value={tenantId} onChange={e=>setTenantId(e.target.value)} className={inputClass}><option value="">Pilih tenant</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}</select></label>
          <label>Product plan<select required value={planId} onChange={e=>setPlanId(e.target.value)} className={inputClass}><option value="">Pilih paket</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name} · {p.maxUsers ?? "Unlimited"} users</option>)}</select></label>
          <label>Deployment model<select value={deploymentMode} onChange={e=>setDeploymentMode(e.target.value)} className={inputClass}><option value="SHARED_CLOUD">Shared Cloud</option><option value="DEDICATED_CLOUD">Dedicated Cloud</option><option value="SELF_HOSTED">Self-hosted Enterprise</option></select></label>
          <div className="platform-form-row"><label>Billing interval<select value={billingInterval} onChange={e=>setBillingInterval(e.target.value)} className={inputClass}><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option><option value="CUSTOM">Custom</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)} className={inputClass}><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="PAST_DUE">Past due</option><option value="SUSPENDED">Suspended</option><option value="EXPIRED">Expired</option></select></label></div>
          <div className="platform-form-row"><label>Currency<input required maxLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} className={inputClass}/></label><label>Unit price<input required min="0" step="0.01" type="number" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} className={inputClass}/></label></div>
          <label>Current period end<input required type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className={inputClass}/></label>
          <button disabled={saving || !tenantId || !planId || !periodEnd} className="platform-submit">{saving ? "Memproses…" : "Provision subscription"}</button>
        </form>
      </section>
    </>}
  </main>;
}
