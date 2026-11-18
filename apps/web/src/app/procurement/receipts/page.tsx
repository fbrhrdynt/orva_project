"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Plus, X, PackageCheck } from "lucide-react";

type Company = { id: string; code: string; name: string };
type Warehouse = { id: string; code: string; name: string };
type Receipt = { id: string; documentNumber: string; receivedAt: string; supplierDeliveryNote: string | null; purchaseOrder: { documentNumber: string; supplier: { code: string; name: string } }; warehouse: { code: string; name: string }; _count: { lines: number } };
type OrderLine = { id: string; lineNumber: number; description: string; quantity: string; receivedQty: string; remainingQty: string; uomCode: string; item: { sku: string; name: string } | null };
type Order = { id: string; documentNumber: string; supplier: { code: string; name: string }; lines: OrderLine[] };
type Options = { warehouses: Warehouse[]; orders: Order[] };
type ReceiptLineInput = { purchaseOrderLineId: string; quantity: string };
const numberFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<Receipt[]>([]);
  const [options, setOptions] = useState<Options>({ warehouses: [], orders: [] });
  const [warehouseId, setWarehouseId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedOrder = useMemo(() => options.orders.find(order => order.id === purchaseOrderId) ?? null, [options.orders, purchaseOrderId]);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setError("");
    const [receiptResponse, optionsResponse] = await Promise.all([
      fetch(`/api/procurement/goods-receipts?companyId=${encodeURIComponent(id)}&take=100`, { cache: "no-store" }),
      fetch(`/api/procurement/goods-receipts/options?companyId=${encodeURIComponent(id)}`, { cache: "no-store" }),
    ]);
    if (receiptResponse.status === 401 || optionsResponse.status === 401) { router.replace("/login"); return; }
    const [receiptData, optionsData] = await Promise.all([receiptResponse.json(), optionsResponse.json()]);
    if (!receiptResponse.ok) throw new Error(receiptData.error || "Unable to load goods receipts.");
    if (!optionsResponse.ok) throw new Error(optionsData.error || "Unable to load receiving options.");
    setItems(receiptData.items ?? []);
    setOptions(optionsData);
    setWarehouseId(current => optionsData.warehouses.some((w: Warehouse) => w.id === current) ? current : optionsData.warehouses[0]?.id ?? "");
    setPurchaseOrderId(current => optionsData.orders.some((o: Order) => o.id === current) ? current : optionsData.orders[0]?.id ?? "");
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" }).then(async r => {
      if (r.status === 401) { router.replace("/login"); return null; }
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to load workspace."); return d;
    }).then(async d => {
      if (!active || !d) return;
      setCompanies(d.companies ?? []);
      const id = d.selectedCompanyId || d.companies?.[0]?.id || "";
      setCompanyId(id);
      if (id) await load(id);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router, load]);

  useEffect(() => {
    if (!selectedOrder) { setQuantities({}); return; }
    setQuantities(Object.fromEntries(selectedOrder.lines.map(line => [line.id, line.remainingQty])));
  }, [selectedOrder]);

  function startNewReceipt() {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    setDocumentNumber(`GR-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
    setDeliveryNote("");
    setMessage("");
    setError("");
    setShowForm(true);
  }

  async function submitReceipt(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedOrder) return;
    const lines: ReceiptLineInput[] = selectedOrder.lines
      .filter(line => Number(quantities[line.id] || 0) > 0)
      .map(line => ({ purchaseOrderLineId: line.id, quantity: quantities[line.id] }));
    if (!lines.length) { setError("Enter a received quantity for at least one purchase order line."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/procurement/goods-receipts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, purchaseOrderId, documentNumber, warehouseId, supplierDeliveryNote: deliveryNote, lines }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to post goods receipt.");
      setMessage(`Goods receipt ${payload.documentNumber} posted successfully.`);
      setShowForm(false);
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to post goods receipt."); }
    finally { setSaving(false); }
  }

  return <main className="procurement-page">
    <header className="procurement-topbar"><Link href="/" className="procurement-brand">orva<span>.</span></Link><span className="procurement-environment">PROCUREMENT</span></header>
    <section className="procurement-content">
      <Link href="/procurement" className="procurement-back"><ArrowLeft size={14}/> Purchase orders</Link>
      <nav className="procurement-subnav"><Link href="/procurement">Purchase orders</Link><Link href="/procurement/requisitions">Purchase requisitions</Link><Link href="/procurement/receipts">Goods receipts</Link><Link href="/master-data">Master data</Link></nav>
      <div className="procurement-heading"><div><div className="procurement-eyebrow">PROCUREMENT / RECEIVING</div><h1>Goods receipts</h1><p>Receive supplier deliveries against approved purchase orders and post stock automatically.</p></div><button className="procurement-primary" type="button" onClick={startNewReceipt} disabled={!options.orders.length || !options.warehouses.length}><Plus size={15}/> New goods receipt</button></div>
      <label className="procurement-company-select"><select value={companyId} onChange={e => { setCompanyId(e.target.value); setItems([]); setLoading(true); void load(e.target.value).catch(err => setError(err.message)).finally(() => setLoading(false)); }}>{companies.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>
      {error && <div className="procurement-error" role="alert">{error}</div>}
      {message && <div className="procurement-panel-foot" role="status">{message}</div>}
      {showForm && <section className="procurement-panel">
        <div className="procurement-panel-heading"><div><h2>Receive purchase order</h2><p>Only approved orders with outstanding quantities are available.</p></div><button type="button" className="procurement-refresh" onClick={() => setShowForm(false)}><X size={14}/> Close</button></div>
        <form onSubmit={submitReceipt} className="procurement-form">
          <div className="procurement-form-grid">
            <label>Goods receipt number<input required maxLength={40} value={documentNumber} onChange={e=>setDocumentNumber(e.target.value)} /></label>
            <label>Purchase order<select required value={purchaseOrderId} onChange={e=>setPurchaseOrderId(e.target.value)}>{options.orders.map(o=><option key={o.id} value={o.id}>{o.documentNumber} · {o.supplier.name}</option>)}</select></label>
            <label>Receiving warehouse<select required value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}>{options.warehouses.map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            <label>Supplier delivery note<input maxLength={100} value={deliveryNote} onChange={e=>setDeliveryNote(e.target.value)} placeholder="Supplier document reference" /></label>
          </div>
          <div className="procurement-table-wrap"><table className="procurement-table"><thead><tr><th>Item / description</th><th>Ordered</th><th>Received</th><th>Outstanding</th><th>Receive now</th></tr></thead><tbody>
            {selectedOrder?.lines.map(line=><tr key={line.id}><td><strong>{line.item?.sku ?? "—"}</strong><small>{line.description}</small></td><td>{numberFormat.format(Number(line.quantity))} {line.uomCode}</td><td>{numberFormat.format(Number(line.receivedQty))}</td><td>{numberFormat.format(Number(line.remainingQty))}</td><td><input aria-label={`Receive quantity for line ${line.lineNumber}`} type="number" min="0" max={line.remainingQty} step="0.0001" value={quantities[line.id] ?? ""} onChange={e=>setQuantities(prev=>({...prev,[line.id]:e.target.value}))} /></td></tr>)}
            {!selectedOrder && <tr><td colSpan={5} className="po-empty">No eligible purchase order selected.</td></tr>}
          </tbody></table></div>
          <div className="procurement-form-actions"><button type="button" className="procurement-refresh" onClick={()=>setShowForm(false)}>Cancel</button><button type="submit" className="procurement-primary" disabled={saving || !selectedOrder || !warehouseId}>{saving ? "Posting receipt…" : "Post goods receipt"}</button></div>
        </form>
      </section>}
      <section className="procurement-panel"><div className="procurement-panel-heading"><div><h2>Goods receipt register</h2><p>Posted receipts and receiving warehouse</p></div><button className="procurement-refresh" onClick={()=>void load(companyId).catch(e=>setError(e.message))} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
        <div className="procurement-table-wrap"><table className="procurement-table"><thead><tr><th>Receipt</th><th>Purchase order</th><th>Supplier</th><th>Received date</th><th>Warehouse</th><th>Lines</th><th>Delivery note</th></tr></thead><tbody>
          {items.map(r=><tr key={r.id}><td><strong className="po-number">{r.documentNumber}</strong></td><td>{r.purchaseOrder.documentNumber}</td><td>{r.purchaseOrder.supplier.name}</td><td>{new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(r.receivedAt))}</td><td>{r.warehouse.name} ({r.warehouse.code})</td><td>{r._count.lines}</td><td>{r.supplierDeliveryNote||"—"}</td></tr>)}
          {!loading&&items.length===0&&<tr><td colSpan={7} className="po-empty">No goods receipts recorded.</td></tr>}{loading&&<tr><td colSpan={7} className="po-empty">Loading receipts...</td></tr>}
        </tbody></table></div><div className="procurement-panel-foot"><PackageCheck size={14}/> Posted receipts update purchase order quantities and the inventory ledger in one database transaction.</div>
      </section>
    </section>
  </main>;
}
