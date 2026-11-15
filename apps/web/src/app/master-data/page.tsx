"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { DEMO_WORKSPACE, formatIDR } from "@/lib/demo-data";

type Tab = "Customers" | "Suppliers" | "Items" | "Warehouses";
type MasterRow = { code?: string; sku?: string; name?: string; city?: string; terms?: string; creditLimit?: number; category?: string; uom?: string; unitCost?: number; unit?: string };
export default function MasterDataPage() {
  const [tab, setTab] = useState<Tab>("Customers");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const source: readonly MasterRow[] = tab === "Customers" ? DEMO_WORKSPACE.customers : tab === "Suppliers" ? DEMO_WORKSPACE.suppliers : tab === "Items" ? DEMO_WORKSPACE.items : DEMO_WORKSPACE.warehouses;
    const term = query.trim().toLowerCase();
    return source.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(term)));
  }, [tab, query]);
  const columns = tab === "Customers" ? ["Code", "Customer", "City", "Payment terms", "Credit limit"] : tab === "Suppliers" ? ["Code", "Supplier", "Category", "City"] : tab === "Items" ? ["SKU", "Item", "Category", "UOM", "Standard cost"] : ["Code", "Warehouse", "Business unit"];
  return <main className="master-page">
    <header className="master-top"><Link href="/overview"><ArrowLeft size={15}/> Overview</Link><span>orva<span className="master-dot">.</span></span><small>DEMO ENVIRONMENT</small></header>
    <section className="master-content">
      <div className="master-breadcrumb">Workspace / Master data</div>
      <div className="master-heading"><div><h1>Master data</h1><p>Reference records used across business transactions</p></div><span>DEMO DATA</span></div>
      <div className="master-company"><strong>Nusantara Industrial Group</strong><span> · Consolidated demo workspace</span></div>
      <div className="master-tabs" role="tablist" aria-label="Master data type">{(["Customers","Suppliers","Items","Warehouses"] as Tab[]).map((name) => <button type="button" role="tab" aria-selected={tab === name} className={tab === name ? "selected" : ""} onClick={() => {setTab(name);setQuery("");}} key={name}>{name}<span>{name === "Customers" ? DEMO_WORKSPACE.customers.length : name === "Suppliers" ? DEMO_WORKSPACE.suppliers.length : name === "Items" ? DEMO_WORKSPACE.items.length : DEMO_WORKSPACE.warehouses.length}</span></button>)}</div>
      <div className="master-toolbar"><label><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${tab.toLowerCase()}...`} aria-label={`Search ${tab}`}/></label><span>{rows.length} records</span></div>
      <div className="master-table-wrap"><table className="master-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>
        {rows.map((row, index) => <tr key={index}>
          {tab === "Customers" && <><td className="master-code">{row.code}</td><td>{row.name}</td><td>{row.city}</td><td>{row.terms}</td><td className="master-number">{formatIDR(row.creditLimit ?? 0)}</td></>}
          {tab === "Suppliers" && <><td className="master-code">{row.code}</td><td>{row.name}</td><td>{row.category}</td><td>{row.city}</td></>}
          {tab === "Items" && <><td className="master-code">{row.sku}</td><td>{row.name}</td><td>{row.category}</td><td>{row.uom}</td><td className="master-number">{formatIDR(row.unitCost ?? 0)}</td></>}
          {tab === "Warehouses" && <><td className="master-code">{row.code}</td><td>{row.name}</td><td>{row.unit}</td></>}
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={columns.length} className="master-empty">No matching records</td></tr>}
      </tbody></table></div>
      <p className="master-footnote">Sample records only. Create, edit and import actions will be enabled after authentication and database provisioning are connected.</p>
    </section>
  </main>;
}
