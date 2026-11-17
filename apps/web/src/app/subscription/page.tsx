"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

type SubscriptionData = {
  tenant: { name: string; slug: string } | null;
  usage: { activeUsers: number; activeCompanies: number };
  subscription: null | {
    status: string; billingInterval: string; deploymentMode: string; currency: string;
    unitPrice: string; startsAt: string; currentPeriodStart: string; currentPeriodEnd: string;
    trialEndsAt: string | null; cancelAtPeriodEnd: boolean; cancelledAt: string | null;
    contractReference: string | null;
    plan: { key: string; name: string; maxUsers: number | null; maxCompanies: number | null; maxStorageMb: number | null; supportLevel: string; modules: string[] };
  };
};

const date = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value));
const limit = (value: number | null, used: number) => value == null ? `${used.toLocaleString("id-ID")} / Unlimited` : `${used.toLocaleString("id-ID")} / ${value.toLocaleString("id-ID")}`;

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/subscription", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Tidak dapat memuat informasi subscription.");
      return response.json();
    }).then((result) => { if (active) setData(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); });
    return () => { active = false; };
  }, []);

  return <main className="erp-shell">
    <section className="erp-main" style={{ marginLeft: 0, width: "100%" }}>
      <div className="erp-content" style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="erp-page-head">
          <div><div className="erp-kicker">Workspace settings</div><h1>Subscription & usage</h1><p>Plan, access period and resource usage for {data?.tenant?.name ?? "your workspace"}.</p></div>
          <Link className="erp-button erp-button--secondary" href="/overview"><ArrowLeft size={15}/> Back to workspace</Link>
        </div>
        {error && <div className="demo-notice">{error}</div>}
        {!data && !error && <div className="erp-panel">Loading subscription details…</div>}
        {data && !data.subscription && <section className="erp-panel">
          <h2>No subscription assigned</h2><p>This workspace does not currently have a subscription record. Contact your ORVA administrator to activate a plan.</p>
        </section>}
        {data?.subscription && <div className="erp-two-col">
          <section className="erp-panel">
            <div className="panel-head"><div><h2>{data.subscription.plan.name}</h2><p>{data.subscription.plan.key.toUpperCase()} plan</p></div><span className="status status--success">{data.subscription.status}</span></div>
            <div className="subscription-price"><strong>{data.subscription.currency} {Number(data.subscription.unitPrice).toLocaleString("id-ID")}</strong><span>/ {data.subscription.billingInterval.toLowerCase()}</span></div>
            <p>Deployment: {data.subscription.deploymentMode.replaceAll("_", " ").toLowerCase()}</p>
            <p>Current period: {date(data.subscription.currentPeriodStart)} – {date(data.subscription.currentPeriodEnd)}</p>
            {data.subscription.trialEndsAt && <p>Trial ends: {date(data.subscription.trialEndsAt)}</p>}
            {data.subscription.cancelAtPeriodEnd && <p className="status status--warning">Cancellation scheduled at the end of this period.</p>}
            {data.subscription.contractReference && <p>Contract: {data.subscription.contractReference}</p>}
          </section>
          <section className="erp-panel">
            <div className="panel-head"><div><h2>Resource usage</h2><p>Current active resources</p></div><ShieldCheck size={18}/></div>
            <div className="subscription-usage"><span>Users</span><strong>{limit(data.subscription.plan.maxUsers, data.usage.activeUsers)}</strong></div>
            <div className="subscription-usage"><span>Companies</span><strong>{limit(data.subscription.plan.maxCompanies, data.usage.activeCompanies)}</strong></div>
            <div className="subscription-usage"><span>Storage allowance</span><strong>{data.subscription.plan.maxStorageMb == null ? "Unlimited" : `${data.subscription.plan.maxStorageMb.toLocaleString("id-ID")} MB`}</strong></div>
            <div className="subscription-usage"><span>Support</span><strong>{data.subscription.plan.supportLevel}</strong></div>
          </section>
          <section className="erp-panel" style={{ gridColumn: "1 / -1" }}>
            <div className="panel-head"><div><h2>Included modules</h2><p>Modules included in this plan. Availability also depends on implementation and company configuration.</p></div><Clock3 size={18}/></div>
            <div className="module-chip-list">{data.subscription.plan.modules.length ? data.subscription.plan.modules.map((module) => <span className="module-chip" key={module}><CheckCircle2 size={13}/>{module.replaceAll("_", " ")}</span>) : <span>No modules assigned to this plan.</span>}</div>
          </section>
        </div>}
        <footer className="erp-footer"><span>orva. · Subscription management</span><span>Billing changes are managed by the ORVA platform team.</span></footer>
      </div>
    </section>
  </main>;
}
