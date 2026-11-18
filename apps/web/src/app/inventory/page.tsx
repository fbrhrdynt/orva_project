"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Boxes, RefreshCw } from "lucide-react";

type Workspace = { companies: Array<{ id: string; code: string; name: string }> };
type Item = { id: string; sku: string; name: string; uom: { code: string; name: string } };
type Warehouse = { id: string; code: string; name: string };
type Balance = { item?: Item; warehouse?: Warehouse; quantity: string };
type StockData = { items: Item[]; warehouses: Warehouse[]; balances: Balance[] };
const qty = (value: string) => Number(value).toLocaleString("id-ID", { maximumFractionDigits: 4 });

export default function InventoryPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<StockData | null>(null);
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [action, setAction] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER">("ADJUSTMENT_IN");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setError("");
    const response = await fetch("/api/inventory/stock?companyId=" + encodeURIComponent(id), { cache: "no-store" });
    const payload = await response.json();
    if (response.status === 401) { router.replace("/login"); return; }
    if (!response.ok) throw new Error(payload.error || "Unable to load stock.");
    setData(payload);
    setItemId(current => current || payload.items?.[0]?.id || "");
    setWarehouseId(current => current || payload.warehouses?.[0]?.id || "");
    setToWarehouseId(current => current || payload.warehouses?.[1]?.id || "");
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" }).then(async r => {
      if (r.status === 401) { router.replace("/login"); throw new Error("Authentication required."); }
      const p = await r.json(); if (!r.ok) throw new Error(p.error || "Unable to load workspace."); return p;
    }).then(async p => {
      if (!active) return;
      setWorkspace(p);
      const id = p.selectedCompanyId || p.companies?.[0]?.id || "";
      setCompanyId(id);
      if (id) await load(id);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load inventory."); });
    return () => { active = false; };
  }, [router, load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const body: Record<string, string> = { action, companyId, itemId, quantity, notes, idempotencyKey: crypto.randomUUID() };
      if (action === "TRANSFER") { body.fromWarehouseId = warehouseId; body.toWarehouseId = toWarehouseId; }
      else body.warehouseId = warehouseId;
      const response = await fetch("/api/inventory/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Inventory transaction failed.");
      setMessage(action === "TRANSFER" ? "Warehouse transfer posted." : "Stock adjustment posted.");
      setQuantity(""); setNotes("");
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Inventory transaction failed."); }
    finally { setBusy(false); }
  }

  return <main className="erp-shell">
    <aside className="erp-sidebar"><Link href="/" className="erp-wordmark">orva<span>.</span></Link><div className="erp-nav-label">OPERATIONS</div><nav className="erp-nav"><Link href="/overview" className="erp-nav-link">Overview</Link><Link href="/procurement" className="erp-nav-link">Procurement</Link><Link href="/master-data" className="erp-nav-link">Master data</Link><Link href="/inventory" className="erp-nav-link active">Inventory</Link><Link href="/subscription" className="erp-nav-link">Subscription</Link></nav></aside>
    <section className="erp-main"><header className="erp-topbar"><div className="erp-breadcrumb"><Link href="/overview">Workspace</Link><span>/</span><strong>Inventory</strong></div><button type="button" onClick={() => void load(companyId)} aria-label="Refresh stock"><RefreshCw size={16}/></button></header>
      <div className="erp-content"><div className="erp-page-head"><div><div className="erp-kicker">SUPPLY CHAIN / INVENTORY</div><h1>Stock management</h1><p>Stock balances are calculated from immutable inventory ledger entries.</p></div><Link href="/master-data" className="erp-button erp-button--secondary"><ArrowLeft size={14}/> Master data</Link></div>
        {workspace && <label className="erp-field">Company<select value={companyId} onChange={e => { setCompanyId(e.target.value); setData(null); void load(e.target.value).catch(err => setError(err.message)); }} className="erp-input">{workspace.companies.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>}
        {error && <div className="demo-notice" role="alert">{error}</div>}{message && <div className="demo-notice" role="status">{message}</div>}
        <section className="erp-panel"><div className="panel-head"><div><h2>Stock transaction</h2><p>Adjust on-hand quantity or transfer stock between warehouses.</p></div><ArrowLeftRight size={18}/></div>
          <form onSubmit={submit} className="erp-form-grid">
            <label>Transaction<select value={action} onChange={e => setAction(e.target.value as typeof action)} className="erp-input"><option value="ADJUSTMENT_IN">Adjustment in</option><option value="ADJUSTMENT_OUT">Adjustment out</option><option value="TRANSFER">Warehouse transfer</option></select></label>
            <label>Item<select required value={itemId} onChange={e => setItemId(e.target.value)} className="erp-input"><option value="">Select item</option>{data?.items.map(i => <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}</select></label>
            <label>{action === "TRANSFER" ? "From warehouse" : "Warehouse"}<select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="erp-input"><option value="">Select warehouse</option>{data?.warehouses.map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            {action === "TRANSFER" && <label>To warehouse<select required value={toWarehouseId} onChange={e => setToWarehouseId(e.target.value)} className="erp-input"><option value="">Select destination</option>{data?.warehouses.filter(w => w.id !== warehouseId).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>}
            <label>Quantity<input required type="number" min="0.0001" step="0.0001" value={quantity} onChange={e => setQuantity(e.target.value)} className="erp-input" placeholder="0.0000"/></label>
            <label>Notes<input value={notes} onChange={e => setNotes(e.target.value)} className="erp-input" maxLength={500} placeholder="Reason / reference"/></label>
            <button disabled={busy || !data?.items.length || !data?.warehouses.length} className="erp-button erp-button--primary" type="submit">{busy ? "Posting…" : action === "TRANSFER" ? "Post transfer" : "Post adjustment"}</button>
          </form>
        </section>
        <section className="erp-panel"><div className="panel-head"><div><h2>On-hand stock</h2><p>{data?.items.length ?? 0} stock items · {data?.warehouses.length ?? 0} active warehouses</p></div><Boxes size={18}/></div>
          <div className="table-scroll"><table className="erp-table"><thead><tr><th>SKU</th><th>Item</th><th>Warehouse</th><th>On hand</th><th>UOM</th></tr></thead><tbody>{data?.balances.map((b,i)=><tr key={i}><td className="record-code">{b.item?.sku}</td><td>{b.item?.name}</td><td>{b.warehouse?.code} · {b.warehouse?.name}</td><td className="numeric">{qty(b.quantity)}</td><td>{b.item?.uom.code}</td></tr>)}{data && data.balances.length===0 && <tr><td colSpan={5}>No stock ledger entries yet. Receive a purchase order or post an opening adjustment.</td></tr>}</tbody></table></div>
        </section>
      </div>
    </section>
  </main>;
}
