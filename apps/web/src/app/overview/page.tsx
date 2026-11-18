"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowUpRight, ClipboardList, Package, RefreshCw, ShoppingCart, Truck, Warehouse } from "lucide-react";

type Overview = {
  company: { id: string; code: string; name: string; currency: string };
  metrics: { purchaseOrders: number; pendingApproval: number; committedPurchaseValue: number; pendingPurchaseValue: number; requisitions: number; goodsReceipts: number; suppliers: number; customers: number; items: number; warehouses: number };
  purchaseOrders: Array<{ id: string; documentNumber: string; documentDate: string; status: string; currency: string; grandTotal: string; supplier: { name: string } }>;
  activity: Array<{ id: string; action: string; entityType: string; entityId: string | null; severity: string; occurredAt: string; actorUserId: string | null }>;
};
const money = (value: number, currency: string) => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());

export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    try {
      const workspaceResponse = await fetch("/api/workspace", { cache: "no-store" });
      if (workspaceResponse.status === 401) { router.replace("/login"); return; }
      const workspace = await workspaceResponse.json();
      if (!workspaceResponse.ok) throw new Error(workspace.error || "Unable to load workspace.");
      const companyId = workspace.selectedCompanyId || workspace.companies?.[0]?.id;
      if (!companyId) throw new Error("No active company is assigned to this account.");
      const response = await fetch("/api/overview?companyId=" + encodeURIComponent(companyId), { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(payload.error || "Unable to load overview.");
      setData(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load overview."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const cards = data ? [
    { title: "Purchase orders", value: data.metrics.purchaseOrders, note: "All recorded documents", icon: ShoppingCart },
    { title: "Awaiting approval", value: data.metrics.pendingApproval, note: "Purchase orders and requisitions", icon: ClipboardList },
    { title: "Committed purchasing", value: money(data.metrics.committedPurchaseValue, data.company.currency), note: "Total purchase order value", icon: Truck },
    { title: "Goods receipts", value: data.metrics.goodsReceipts, note: "Recorded receiving documents", icon: Package },
  ] : [];
  return <main className="erp-shell">
    <aside className="erp-sidebar">
      <Link href="/" className="erp-wordmark">orva<span>.</span></Link>
      <div className="erp-company"><span className="company-monogram">{data?.company.code.slice(0,1) || "O"}</span><span><strong>{data?.company.name || "Workspace"}</strong><small>Business workspace</small></span></div>
      <div className="erp-nav-label">Workspace</div>
      <nav className="erp-nav">
        <Link className="erp-nav-link active" href="/overview"><Activity size={16}/>Overview</Link>
        <Link className="erp-nav-link" href="/procurement"><ShoppingCart size={16}/>Procurement</Link>
        <Link className="erp-nav-link" href="/master-data"><Package size={16}/>Master data</Link>
        <Link className="erp-nav-link" href="/subscription"><Warehouse size={16}/>Subscription</Link>
      </nav>
      <div className="erp-sidebar-bottom"><span className="erp-avatar">OR</span><span><strong>ORVA Workspace</strong><small>Authorized user</small></span></div>
    </aside>
    <section className="erp-main">
      <header className="erp-topbar"><div className="erp-breadcrumb"><span>Workspace</span><span>/</span><strong>Overview</strong></div><div className="erp-top-actions"><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh"><RefreshCw size={17}/></button></div></header>
      <div className="erp-content">
        <div className="erp-page-head"><div><div className="erp-kicker">BUSINESS OPERATIONS</div><h1>Business overview</h1><p>{data?.company.name || "Your company"} · Live workspace records</p></div><Link className="erp-button erp-button--secondary" href="/procurement">Open procurement <ArrowUpRight size={14}/></Link></div>
        {error && <div className="demo-notice">{error}</div>}
        {loading && !data && <section className="erp-panel">Loading live company data…</section>}
        {data && <>
          <section className="metric-grid">{cards.map(card => { const Icon=card.icon; return <article className="metric" key={card.title}><span>{card.title}</span><strong>{card.value}</strong><small>{card.note}</small><Icon size={17}/></article>; })}</section>
          <div className="erp-two-col">
            <section className="erp-panel"><div className="panel-head"><div><h2>Master data</h2><p>Active records for this company</p></div></div><div className="subscription-usage"><span>Suppliers</span><strong>{data.metrics.suppliers}</strong></div><div className="subscription-usage"><span>Customers</span><strong>{data.metrics.customers}</strong></div><div className="subscription-usage"><span>Items</span><strong>{data.metrics.items}</strong></div><div className="subscription-usage"><span>Warehouses</span><strong>{data.metrics.warehouses}</strong></div></section>
            <section className="erp-panel"><div className="panel-head"><div><h2>Procurement snapshot</h2><p>Current purchasing workload</p></div></div><div className="subscription-usage"><span>Purchase requisitions</span><strong>{data.metrics.requisitions}</strong></div><div className="subscription-usage"><span>Awaiting approval value</span><strong>{money(data.metrics.pendingPurchaseValue,data.company.currency)}</strong></div><div className="subscription-usage"><span>Total committed value</span><strong>{money(data.metrics.committedPurchaseValue,data.company.currency)}</strong></div></section>
          </div>
          <section className="erp-panel"><div className="panel-head"><div><h2>Recent purchase orders</h2><p>Latest purchasing documents for {data.company.code}</p></div><Link href="/procurement">View register <ArrowUpRight size={14}/></Link></div><div className="table-scroll"><table className="erp-table"><thead><tr><th>Document</th><th>Supplier</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.purchaseOrders.map(row=><tr key={row.id}><td className="record-code">{row.documentNumber}</td><td>{row.supplier.name}</td><td>{date(row.documentDate)}</td><td className="numeric">{money(Number(row.grandTotal),row.currency)}</td><td><span className="status status--neutral">{label(row.status)}</span></td></tr>)}{data.purchaseOrders.length===0&&<tr><td colSpan={5}>No purchase orders recorded yet.</td></tr>}</tbody></table></div></section>
          <section className="erp-panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Audited events in the current month</p></div></div>{data.activity.length ? data.activity.map(row=><div className="activity-row" key={row.id}><time>{new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jakarta"}).format(new Date(row.occurredAt))}</time><span><strong>{label(row.action)}</strong><small>{row.entityType} · {row.entityId || "—"}</small></span><b>{row.severity}</b></div>) : <p>No recent audit events.</p>}</section>
        </>}
        <footer className="erp-footer"><span>orva. · SME business platform</span><span>Live data · IDR · Asia/Jakarta</span></footer>
      </div>
    </section>
  </main>;
}
