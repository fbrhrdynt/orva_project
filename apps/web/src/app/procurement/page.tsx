"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, FileText, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";

type Company = { id: string; code: string; name: string; currency: string };
type Workspace = {
  user: { id: string; name: string | null; email: string } | null;
  tenant: { id: string; name: string; slug: string } | null;
  companies: Company[];
  permissions: string[];
};
type PurchaseOrder = {
  id: string;
  documentNumber: string;
  documentDate: string;
  expectedAt: string | null;
  currency: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  priority: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  supplierReference: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  supplier: { id: string; code: string; name: string };
  _count: { lines: number; goodsReceipts: number };
};
type ApiError = { error?: string };

const statusLabels: Record<PurchaseOrder["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};
const statusClass: Record<PurchaseOrder["status"], string> = {
  DRAFT: "po-status",
  SUBMITTED: "po-status po-status-pending",
  APPROVED: "po-status po-status-approved",
  REJECTED: "po-status po-status-rejected",
  PARTIALLY_RECEIVED: "po-status po-status-progress",
  RECEIVED: "po-status po-status-approved",
  CANCELLED: "po-status",
};
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}
function formatMoney(value: string, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default function ProcurementPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState("");

  const company = useMemo(() => workspace?.companies.find((item) => item.id === companyId) ?? null, [workspace, companyId]);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        if (response.status === 401) { router.replace("/login"); return; }
        const payload = await response.json() as Workspace & ApiError;
        if (!response.ok) throw new Error(payload.error || "Unable to load workspace.");
        if (!active) return;
        setWorkspace(payload);
        if (payload.companies.length) setCompanyId(payload.companies[0].id);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load workspace.");
      } finally {
        if (active) setLoadingWorkspace(false);
      }
    }
    void loadWorkspace();
    return () => { active = false; };
  }, [router]);

  const loadOrders = useCallback(async () => {
    if (!companyId) { setOrders([]); setTotal(0); return; }
    setLoadingOrders(true);
    setError("");
    try {
      const params = new URLSearchParams({ companyId, take: "100" });
      if (query.trim()) params.set("search", query.trim());
      if (status !== "ALL") params.set("status", status);
      const response = await fetch(`/api/procurement/purchase-orders?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json() as { items?: PurchaseOrder[]; total?: number; error?: string };
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(payload.error || "Unable to load purchase orders.");
      setOrders(payload.items ?? []);
      setTotal(payload.total ?? 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load purchase orders.");
      setOrders([]);
      setTotal(0);
    } finally {
      setLoadingOrders(false);
    }
  }, [companyId, query, status, router]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const currency = company?.currency ?? "IDR";
  const committed = orders.filter((order) => !["DRAFT", "REJECTED", "CANCELLED"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
  const awaiting = orders.filter((order) => order.status === "SUBMITTED").length;
  const approved = orders.filter((order) => ["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)).length;

  return (
    <main className="procurement-page">
      <header className="procurement-topbar">
        <Link href="/" className="procurement-brand">orva<span>.</span></Link>
        <div className="procurement-topbar-right">
          <span className="procurement-environment">{workspace?.tenant?.name ?? "WORKSPACE"}</span>
          <span className="procurement-user">{workspace?.user?.name || workspace?.user?.email || ""}</span>
          <button type="button" className="procurement-logout" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }}>Sign out</button>
        </div>
      </header>

      <section className="procurement-content">
        <Link href="/" className="procurement-back"><ArrowLeft size={14}/> Applications</Link><nav className="procurement-subnav"><Link href="/procurement">Purchase orders</Link><Link href="/procurement/requisitions">Purchase requisitions</Link><Link href="/procurement/receipts">Goods receipts</Link><Link href="/master-data">Master data</Link></nav>
        <div className="procurement-heading">
          <div><div className="procurement-eyebrow">CORE BUSINESS / PROCUREMENT</div><h1>Purchase orders</h1><p>Monitor purchasing commitments and supplier deliveries.</p></div><Link href="/procurement/new" className="procurement-primary">+ New purchase order</Link>
          {workspace && workspace.companies.length > 0 && <label className="procurement-company-select"><Building2 size={14}/><select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setSelected(null); }} aria-label="Select company">{workspace.companies.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>}
        </div>

        {loadingWorkspace ? <div className="procurement-state"><RefreshCw size={18} className="procurement-spin"/>Loading workspace...</div> : !workspace?.companies.length ? <div className="procurement-state"><Building2 size={20}/><strong>No company access</strong><span>Your account is not assigned to an active company. Ask your workspace administrator to grant company access.</span></div> : <>
          <div className="procurement-summary">
            <article><span>Purchase orders</span><strong>{total.toString().padStart(2, "0")}</strong><small>Matching records in this company</small></article>
            <article><span>Awaiting approval</span><strong>{awaiting.toString().padStart(2, "0")}</strong><small>Submitted and pending review</small></article>
            <article><span>Committed value</span><strong>{formatMoney(String(committed), currency)}</strong><small>{approved} approved or in progress</small></article>
          </div>

          <section className="procurement-panel">
            <div className="procurement-panel-heading"><div><h2>Purchase order register</h2><p>Live purchasing documents from your workspace database</p></div><span>{total} records</span></div>
            <div className="procurement-toolbar">
              <label className="procurement-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document or supplier" aria-label="Search purchase orders"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14}/></button>}</label>
              <label className="procurement-filter"><SlidersHorizontal size={14}/><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Awaiting approval</option><option value="APPROVED">Approved</option><option value="PARTIALLY_RECEIVED">Partially received</option><option value="RECEIVED">Received</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option></select></label>
              <button type="button" className="procurement-refresh" onClick={() => void loadOrders()} disabled={loadingOrders}><RefreshCw size={14} className={loadingOrders ? "procurement-spin" : ""}/>Refresh</button>
            </div>
            {error && <div className="procurement-error" role="alert">{error}</div>}
            <div className="procurement-table-wrap">
              <table className="procurement-table"><thead><tr><th>Document</th><th>Supplier</th><th>Document date</th><th>Expected delivery</th><th className="po-amount">Net amount</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {orders.map((order) => <tr key={order.id} onClick={() => setSelected(order)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelected(order); }}>
                    <td><strong className="po-number">{order.documentNumber}</strong><small>{order._count.lines} line items · {order.priority.toLowerCase()} priority</small></td>
                    <td><strong className="po-supplier">{order.supplier.name}</strong><small>{order.supplier.code}</small></td>
                    <td>{formatDate(order.documentDate)}</td><td>{formatDate(order.expectedAt)}</td>
                    <td className="po-amount">{formatMoney(order.grandTotal, order.currency)}</td>
                    <td><span className={statusClass[order.status]}>{statusLabels[order.status]}</span></td><td><ArrowUpRight size={15}/></td>
                  </tr>)}
                  {!loadingOrders && orders.length === 0 && <tr><td colSpan={7} className="po-empty">{error ? "Purchase orders could not be loaded." : "No purchase orders found for this company and filter."}</td></tr>}
                  {loadingOrders && <tr><td colSpan={7} className="po-empty">Loading purchase orders...</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="procurement-panel-foot"><FileText size={14}/> Live database records · Access is restricted by tenant, company and procurement permissions.</div>
          </section>
        </>}
      </section>

      {selected && <div className="po-overlay" role="presentation" onClick={() => setSelected(null)}>
        <aside className="po-detail" role="dialog" aria-modal="true" aria-labelledby="po-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="po-detail-head"><div><span>PURCHASE ORDER</span><h2 id="po-detail-title">{selected.documentNumber}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close details"><X size={18}/></button></div>
          <div className="po-detail-status"><span className={statusClass[selected.status]}>{statusLabels[selected.status]}</span></div>
          <dl>
            <div><dt>Supplier</dt><dd>{selected.supplier.name} ({selected.supplier.code})</dd></div>
            <div><dt>Document date</dt><dd>{formatDate(selected.documentDate)}</dd></div>
            <div><dt>Expected delivery</dt><dd>{formatDate(selected.expectedAt)}</dd></div>
            <div><dt>Supplier reference</dt><dd>{selected.supplierReference || "—"}</dd></div>
            <div><dt>Line items</dt><dd>{selected._count.lines}</dd></div>
            <div><dt>Goods receipts</dt><dd>{selected._count.goodsReceipts}</dd></div>
            <div><dt>Priority</dt><dd>{selected.priority}</dd></div>
            <div><dt>Delivery address</dt><dd>{selected.deliveryAddress || "—"}</dd></div>
            <div><dt>Notes</dt><dd>{selected.notes || "—"}</dd></div>
          </dl>
          <div className="po-detail-total"><span>Document total</span><strong>{formatMoney(selected.grandTotal, selected.currency)}</strong></div>
          <p className="po-detail-note">This document is loaded from the active tenant database. Changes are recorded through the procurement service and audit log.</p>
        </aside>
      </div>}
    </main>
  );
}
