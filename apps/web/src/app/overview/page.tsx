"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowUpRight, Bell, Building2, ChevronDown, ClipboardCheck, FileText, Package, Search, ShoppingCart, Wallet } from "lucide-react";
import { DEMO_WORKSPACE, formatCompactIDR, formatIDR } from "@/lib/demo-data";

const statusClass = (value: string) => value === "Approved" || value === "Confirmed" || value === "Delivered" ? "status status--success" : value === "Overdue" ? "status status--danger" : value === "Awaiting approval" || value === "Pending payment" ? "status status--warning" : "status status--neutral";

export default function OverviewPage() {
  const [period, setPeriod] = useState("This month");
  const data = DEMO_WORKSPACE;
  const max = Math.max(...data.monthlyRevenue.map((item) => item.value));
  return <main className="erp-shell">
    <aside className="erp-sidebar">
      <Link href="/" className="erp-wordmark">orva<span>.</span></Link>
      <div className="erp-company"><span className="company-monogram">N</span><span><strong>{data.tenant.name}</strong><small>Enterprise workspace</small></span><ChevronDown size={15}/></div>
      <div className="erp-nav-label">Workspace</div>
      <nav className="erp-nav">
        <Link className="erp-nav-link active" href="/overview"><Activity size={16}/>Overview</Link>
        <a className="erp-nav-link" href="#sales"><ShoppingCart size={16}/>Sales</a>
        <a className="erp-nav-link" href="#procurement"><ClipboardCheck size={16}/>Procurement</a>
        <a className="erp-nav-link" href="#inventory"><Package size={16}/>Inventory</a>
        <a className="erp-nav-link" href="#finance"><Wallet size={16}/>Finance</a>
        <a className="erp-nav-link" href="#organization"><Building2 size={16}/>Organization</a>
        <a className="erp-nav-link" href="#activity"><FileText size={16}/>Activity log</a>
      </nav>
      <div className="erp-sidebar-bottom"><span className="erp-avatar">AP</span><span><strong>Aditya Pranata</strong><small>Finance Manager</small></span><ChevronDown size={14}/></div>
    </aside>
    <section className="erp-main">
      <header className="erp-topbar"><div className="erp-breadcrumb"><span>Workspace</span><span>/</span><strong>Overview</strong></div><div className="erp-top-actions"><span className="demo-flag"><i/>Demo environment</span><button aria-label="Notifications"><Bell size={17}/></button><button aria-label="Search"><Search size={17}/></button></div></header>
      <div className="erp-content">
        <div className="erp-page-head"><div><div className="erp-kicker">Monday, 16 November 2026 · Jakarta time</div><h1>Business overview</h1><p>Operational and financial position across your organization</p></div><label className="period-select"><span>Period</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>This month</option><option>Last month</option><option>This quarter</option></select></label></div>
        <div className="demo-notice"><span>DEMO DATA</span> Illustrative records for Nusantara Industrial Group. No live company data is connected.</div>
        <section className="metric-grid">
          <article className="metric"><span>Revenue · November</span><strong>{formatCompactIDR(586000000)}</strong><small className="positive">↗ 7.0% <em>vs October</em></small></article>
          <article className="metric"><span>Open sales orders</span><strong>12</strong><small>Rp 428.6m order value</small></article>
          <article className="metric"><span>Purchase orders pending</span><strong>4</strong><small>Rp 236.4m awaiting approval</small></article>
          <article className="metric"><span>Receivables overdue</span><strong>{formatCompactIDR(187500000)}</strong><small className="negative">3 invoices <em>past due</em></small></article>
        </section>
        <div className="erp-two-col">
          <section className="erp-panel"><div className="panel-head"><div><h2>Revenue trend</h2><p>Posted sales invoices · IDR millions</p></div><span className="panel-period">{period}</span></div><div className="chart-area"><div className="chart-y"><span>600m</span><span>400m</span><span>200m</span><span>0</span></div><div className="bar-chart">{data.monthlyRevenue.map((item) => <div className="bar-column" key={item.month}><div className="bar-track"><div className={item.month === "Nov" ? "bar-fill current" : "bar-fill"} style={{height: item.value / max * 100 + "%"}} title={formatIDR(item.value * 1000000)}/></div><span>{item.month}</span></div>)}</div></div></section>
          <section className="erp-panel"><div className="panel-head"><div><h2>Needs attention</h2><p>Items requiring a decision</p></div><span className="count-label">4 items</span></div><div className="attention-list">
            <a href="#procurement"><i className="attention-mark warning"/><span><strong>PO-2026-00418</strong><small>Purchase order approval · Nadia Putri</small></span><b>Review</b></a>
            <a href="#finance"><i className="attention-mark danger"/><span><strong>INV-AR-2026-0112</strong><small>Receivable overdue · Rp 187.5m</small></span><b>Open</b></a>
            <a href="#inventory"><i className="attention-mark warning"/><span><strong>RM-STEEL-PLT-06</strong><small>Below reorder point · 18 sheets</small></span><b>Review</b></a>
            <a href="#sales"><i className="attention-mark neutral"/><span><strong>SO-2026-00284</strong><small>Awaiting warehouse fulfilment</small></span><b>Open</b></a>
          </div></section>
        </div>
        <div className="erp-two-col lower-panels">
          <section className="erp-panel" id="sales"><div className="panel-head"><div><h2>Recent sales orders</h2><p>Customer orders across business units</p></div><a href="#sales">View all <ArrowUpRight size={13}/></a></div><div className="table-scroll"><table className="erp-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th className="align-right">Amount</th><th>Status</th></tr></thead><tbody>{data.salesOrders.map((row) => <tr key={row.number}><td className="record-code">{row.number}</td><td>{row.customer}</td><td>{row.date}</td><td className="align-right numeric">{formatIDR(row.amount)}</td><td><span className={statusClass(row.status)}>{row.status}</span></td></tr>)}</tbody></table></div></section>
          <section className="erp-panel" id="procurement"><div className="panel-head"><div><h2>Purchase orders</h2><p>Supplier commitments</p></div><a href="#procurement">View all <ArrowUpRight size={13}/></a></div><div className="table-scroll"><table className="erp-table"><thead><tr><th>Order</th><th>Supplier</th><th>Due date</th><th className="align-right">Amount</th><th>Status</th></tr></thead><tbody>{data.purchaseOrders.map((row) => <tr key={row.number}><td className="record-code">{row.number}</td><td>{row.supplier}</td><td>{row.due}</td><td className="align-right numeric">{formatIDR(row.amount)}</td><td><span className={statusClass(row.status)}>{row.status}</span></td></tr>)}</tbody></table></div></section>
        </div>
        <div className="erp-two-col lower-panels">
          <section className="erp-panel" id="finance"><div className="panel-head"><div><h2>Outstanding invoices</h2><p>Receivables and payables</p></div><a href="#finance">View ledger <ArrowUpRight size={13}/></a></div><div className="invoice-list">{data.invoices.map((row) => <div className="invoice-row" key={row.number}><span><strong>{row.number}</strong><small>{row.party} · Due {row.due}</small></span><span className="invoice-amount">{formatIDR(row.amount)}<small className={statusClass(row.status)}>{row.status}</small></span></div>)}</div></section>
          <section className="erp-panel" id="activity"><div className="panel-head"><div><h2>Recent activity</h2><p>Latest recorded workspace actions</p></div><a href="#activity">Audit log <ArrowUpRight size={13}/></a></div><div className="activity-list">{data.activity.map((row) => <div className="activity-row" key={row.reference}><time>{row.time}</time><span><strong>{row.action}</strong><small>{row.actor} · {row.detail}</small></span><b>{row.reference}</b></div>)}</div></section>
        </div>
        <section className="erp-panel org-panel" id="organization"><div className="panel-head"><div><h2>Organization</h2><p>Companies and operating units in this workspace</p></div><span className="count-label">{data.companies.length} companies · {data.businessUnits.length} units</span></div><div className="org-grid">{data.companies.map((company) => <article key={company.code}><span className="org-code">{company.code}</span><strong>{company.name}</strong><small>{company.city}, {company.country}</small><div>{data.businessUnits.filter((unit) => unit.company === company.code).map((unit) => <span key={unit.code}>{unit.name} <small>({unit.code})</small></span>)}</div></article>)}</div></section>
        <footer className="erp-footer"><span>orva. · Enterprise workspace</span><span>Sample records · Release 0.1.0.3</span></footer>
      </div>
    </section>
  </main>;
}
