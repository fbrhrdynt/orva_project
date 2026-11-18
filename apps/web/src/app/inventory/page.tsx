"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Boxes, RefreshCw, Warehouse, Package, Info } from "lucide-react";

type Workspace = { companies: Array<{ id: string; code: string; name: string }> };
type Item = { id: string; sku: string; name: string; uom: { code: string; name: string } };
type WarehouseRow = { id: string; code: string; name: string };
type Balance = { item?: Item; warehouse?: WarehouseRow; quantity: string };
type StockData = { items: Item[]; warehouses: WarehouseRow[]; balances: Balance[] };
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
  const [loading, setLoading] = useState(true);

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
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load inventory."); }).finally(() => { if (active) setLoading(false); });
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
      setMessage(action === "TRANSFER" ? "Transfer stok berhasil dicatat." : "Penyesuaian stok berhasil dicatat.");
      setQuantity(""); setNotes("");
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Inventory transaction failed."); }
    finally { setBusy(false); }
  }

  const totalBalances = data?.balances.length ?? 0;
  const itemCount = data?.items.length ?? 0;
  const warehouseCount = data?.warehouses.length ?? 0;

  return <main className="erp-shell inventory-shell">
    <section className="erp-main"><header className="erp-topbar"><div className="erp-breadcrumb"><Link href="/">Workspace</Link><span>/</span><strong>Inventory</strong></div><div className="erp-top-actions"><button type="button" onClick={() => void load(companyId)} aria-label="Refresh stock" disabled={loading}><RefreshCw size={16}/></button></div></header>
      <div className="erp-content inventory-content">
        <div className="inventory-heading"><div><div className="erp-kicker">SUPPLY CHAIN / INVENTORY CONTROL</div><h1>Inventory</h1><p>Kelola saldo stok, penyesuaian barang, dan perpindahan antar-gudang.</p></div>{workspace && <label className="inventory-company"><span>Perusahaan aktif</span><select value={companyId} onChange={e => { const id=e.target.value; setCompanyId(id); setData(null); setLoading(true); void load(id).catch(err => setError(err.message)).finally(()=>setLoading(false)); }}>{workspace.companies.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>}</div>
        {error && <div className="inventory-alert inventory-alert--error" role="alert">{error}</div>}{message && <div className="inventory-alert inventory-alert--success" role="status">{message}</div>}
        <section className="inventory-metrics">
          <article><span><Package size={16}/> Item terdaftar</span><strong>{loading ? "—" : itemCount}</strong><small>Master item aktif di perusahaan</small></article>
          <article><span><Warehouse size={16}/> Gudang</span><strong>{loading ? "—" : warehouseCount}</strong><small>Lokasi penyimpanan terdaftar</small></article>
          <article><span><Boxes size={16}/> Baris saldo stok</span><strong>{loading ? "—" : totalBalances}</strong><small>Kombinasi item dan gudang yang memiliki saldo</small></article>
        </section>
        <div className="inventory-columns">
          <section className="inventory-panel inventory-transaction">
            <div className="inventory-panel-head"><div><span className="inventory-step">STOCK OPERATIONS</span><h2>Catat transaksi stok</h2><p>Pilih jenis transaksi, item, lokasi, dan kuantitas.</p></div><ArrowLeftRight size={20}/></div>
            <form onSubmit={submit} className="inventory-form">
              <label>Jenis transaksi<select value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="ADJUSTMENT_IN">Stok masuk / opening balance</option><option value="ADJUSTMENT_OUT">Stok keluar / koreksi</option><option value="TRANSFER">Transfer antar-gudang</option></select></label>
              <label>Item<select required value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Pilih item</option>{data?.items.map(i => <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}</select></label>
              <label>{action === "TRANSFER" ? "Gudang asal" : "Gudang"}<select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">Pilih gudang</option>{data?.warehouses.map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
              {action === "TRANSFER" && <label>Gudang tujuan<select required value={toWarehouseId} onChange={e => setToWarehouseId(e.target.value)}><option value="">Pilih gudang tujuan</option>{data?.warehouses.filter(w => w.id !== warehouseId).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>}
              <label>Kuantitas<input required type="number" min="0.0001" step="0.0001" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Contoh: 10"/></label>
              <label>Catatan / referensi<input value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} placeholder="Alasan penyesuaian atau nomor dokumen"/></label>
              <button disabled={busy || loading || !data?.items.length || !data?.warehouses.length || !companyId} type="submit">{busy ? "Menyimpan transaksi…" : action === "TRANSFER" ? "Simpan transfer" : "Simpan transaksi stok"}</button>
              {(!itemCount || !warehouseCount) && !loading && <p className="inventory-hint">Untuk mencatat stok, daftarkan minimal satu item dan satu gudang di <Link href="/master-data">Master Data</Link>.</p>}
            </form>
          </section>
          <section className="inventory-panel inventory-guide"><div className="inventory-panel-head"><div><span className="inventory-step">HOW IT WORKS</span><h2>Alur inventory</h2><p>Saldo dihitung dari catatan transaksi, bukan diketik langsung.</p></div><Info size={19}/></div>
            <ol><li><b>Master Data</b><span>Daftarkan item, satuan, dan gudang.</span></li><li><b>Stok awal</b><span>Catat kuantitas awal melalui transaksi stok masuk.</span></li><li><b>Operasional</b><span>Catat penerimaan, pengeluaran, atau transfer sesuai aktivitas.</span></li><li><b>Kontrol saldo</b><span>Periksa jumlah per item dan lokasi pada tabel saldo.</span></li></ol>
            <Link href="/master-data" className="inventory-master-link">Buka Master Data <ArrowUpRight size={15}/></Link>
          </section>
        </div>
        <section className="inventory-panel inventory-balance"><div className="inventory-panel-head"><div><span className="inventory-step">STOCK VISIBILITY</span><h2>Saldo stok per gudang</h2><p>Jumlah stok yang tercatat untuk setiap item dan lokasi.</p></div><span className="inventory-record-count">{totalBalances} baris</span></div>
          <div className="table-scroll"><table className="erp-table"><thead><tr><th>SKU</th><th>Nama item</th><th>Gudang</th><th className="numeric">Saldo</th><th>Satuan</th></tr></thead><tbody>{data?.balances.map((b,i)=><tr key={i}><td className="record-code">{b.item?.sku ?? "—"}</td><td>{b.item?.name ?? "—"}</td><td>{b.warehouse?.code} · {b.warehouse?.name}</td><td className="numeric">{qty(b.quantity)}</td><td>{b.item?.uom.code ?? "—"}</td></tr>)}{!loading && data && data.balances.length===0 && <tr><td colSpan={5}><div className="inventory-empty"><Boxes size={24}/><b>Belum ada saldo stok</b><span>Setelah item dan gudang tersedia, catat stok awal melalui formulir transaksi di atas. Saldo akan muncul di sini.</span></div></td></tr>}{loading && <tr><td colSpan={5}>Memuat saldo stok…</td></tr>}</tbody></table></div>
        </section>
      </div>
    </section>
  </main>;
}
