"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, FileText, Search, SlidersHorizontal, X } from "lucide-react";
import { DEMO_WORKSPACE, formatIDR } from "@/lib/demo-data";

type PurchaseOrder = (typeof DEMO_WORKSPACE.purchaseOrders)[number];
type StatusFilter = "All statuses" | "Awaiting approval" | "Approved" | "Partially received";

const statusClass: Record<string, string> = {
  "Awaiting approval": "po-status po-status-pending",
  Approved: "po-status po-status-approved",
  "Partially received": "po-status po-status-progress",
};

export default function ProcurementPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All statuses");
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);

  const orders = useMemo(() => {
    const term = query.trim().toLowerCase();
    return DEMO_WORKSPACE.purchaseOrders.filter((order) => {
      const matchesQuery = !term || [order.number, order.supplier, order.status].some((value) => value.toLowerCase().includes(term));
      return matchesQuery && (status === "All statuses" || order.status === status);
    });
  }, [query, status]);

  const totalValue = DEMO_WORKSPACE.purchaseOrders.reduce((sum, order) => sum + order.amount, 0);
  const pendingCount = DEMO_WORKSPACE.purchaseOrders.filter((order) => order.status === "Awaiting approval").length;

  return (
    <main className="procurement-page">
      <header className="procurement-topbar">
        <Link href="/" className="procurement-brand">orva<span>.</span></Link>
        <span className="procurement-environment">DEMO ENVIRONMENT</span>
      </header>

      <section className="procurement-content">
        <Link href="/" className="procurement-back"><ArrowLeft size={14}/> Applications</Link>
        <div className="procurement-heading">
          <div><div className="procurement-eyebrow">CORE BUSINESS / PROCUREMENT</div><h1>Purchase orders</h1><p>Monitor purchasing commitments and supplier deliveries.</p></div>
          <span className="procurement-demo-label">SAMPLE DATA</span>
        </div>

        <div className="procurement-summary">
          <article><span>Purchase orders</span><strong>{DEMO_WORKSPACE.purchaseOrders.length.toString().padStart(2, "0")}</strong><small>In this sample workspace</small></article>
          <article><span>Awaiting approval</span><strong>{pendingCount.toString().padStart(2, "0")}</strong><small>Requires buyer or manager review</small></article>
          <article><span>Committed value</span><strong>{formatIDR(totalValue)}</strong><small>Value of listed documents</small></article>
        </div>

        <section className="procurement-panel">
          <div className="procurement-panel-heading"><div><h2>Purchase order register</h2><p>Purchase documents across the selected workspace</p></div><span>{orders.length} records</span></div>
          <div className="procurement-toolbar">
            <label className="procurement-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document or supplier" aria-label="Search purchase orders"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14}/></button>}</label>
            <label className="procurement-filter"><SlidersHorizontal size={14}/><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter by status"><option>All statuses</option><option>Awaiting approval</option><option>Approved</option><option>Partially received</option></select></label>
          </div>
          <div className="procurement-table-wrap">
            <table className="procurement-table"><thead><tr><th>Document</th><th>Supplier</th><th>Document date</th><th>Expected delivery</th><th className="po-amount">Net amount</th><th>Status</th><th></th></tr></thead>
              <tbody>{orders.map((order) => <tr key={order.number} onClick={() => setSelected(order)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelected(order); }}>
                <td><strong className="po-number">{order.number}</strong><small>Standard purchase order</small></td><td>{order.supplier}</td><td>{new Date(order.date + "T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td><td>{new Date(order.due + "T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td><td className="po-amount">{formatIDR(order.amount)}</td><td><span className={statusClass[order.status] ?? "po-status"}>{order.status}</span></td><td><ArrowUpRight size={15}/></td>
              </tr>)}
              {orders.length === 0 && <tr><td colSpan={7} className="po-empty">No purchase orders match the current filters.</td></tr>}</tbody>
            </table>
          </div>
          <div className="procurement-panel-foot"><FileText size={14}/> Demo records are read-only. Database-backed purchasing workflows are not enabled yet.</div>
        </section>
      </section>

      {selected && <div className="po-overlay" role="presentation" onClick={() => setSelected(null)}>
        <aside className="po-detail" role="dialog" aria-modal="true" aria-labelledby="po-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="po-detail-head"><div><span> PURCHASE ORDER</span><h2 id="po-detail-title">{selected.number}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close details"><X size={18}/></button></div>
          <div className="po-detail-status"><span className={statusClass[selected.status]}>{selected.status}</span></div>
          <dl><div><dt>Supplier</dt><dd>{selected.supplier}</dd></div><div><dt>Document date</dt><dd>{new Date(selected.date + "T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}</dd></div><div><dt>Expected delivery</dt><dd>{new Date(selected.due + "T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}</dd></div><div><dt>Document type</dt><dd>Standard purchase order</dd></div></dl>
          <div className="po-detail-total"><span>Document total</span><strong>{formatIDR(selected.amount)}</strong></div>
          <p className="po-detail-note">This is a sample document for interface review. Approval, receiving, and posting actions will be added after database and workflow services are connected.</p>
        </aside>
      </div>}
    </main>
  );
}
