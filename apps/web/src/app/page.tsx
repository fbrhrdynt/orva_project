"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, LayoutDashboard, ShoppingCart, Boxes, Users, Wallet, Calculator, BriefcaseBusiness, Truck, Wrench, FileText, Settings2, ShieldCheck, Grid2X2, ArrowUpRight, Star, Clock3, ChevronRight, Command, Sparkles } from "lucide-react";

const groups = [
  { title: "My workspace", subtitle: "Your daily starting point", apps: [
    { name: "Executive dashboard", desc: "Business performance and operational insights", category: "Workspace", href: "/overview", icon: LayoutDashboard, tag: "Overview" },
    { name: "My activities", desc: "Tasks, approvals and items requiring attention", category: "Workspace", href: "/overview", icon: Clock3, tag: "Workspace" },
  ]},
  { title: "Business management", subtitle: "Core applications to run your business", apps: [
    { name: "Sales", desc: "Quotes, sales orders, delivery and invoicing", category: "Business", href: "/sales", icon: ShoppingCart, tag: "Commercial" },
    { name: "CRM", desc: "Customers, leads, opportunities and pipeline", category: "Business", href: "/crm", icon: Users, tag: "Commercial" },
    { name: "Procurement", desc: "Requisitions, purchase orders and receiving", category: "Business", href: "/procurement", icon: Truck, tag: "Supply chain" },
    { name: "Inventory", desc: "Items, stock levels, warehouses and movements", category: "Business", href: "/inventory", icon: Boxes, tag: "Supply chain" },
    { name: "Finance", desc: "General ledger, payables, receivables and cash", category: "Business", href: "/finance", icon: Calculator, tag: "Financials" },
    { name: "Projects", desc: "Project planning, costs, resources and delivery", category: "Business", href: "/projects", icon: BriefcaseBusiness, tag: "Operations" },
    { name: "Asset management", desc: "Equipment register and maintenance activities", category: "Business", href: "/assets", icon: Wrench, tag: "Operations" },
    { name: "People", desc: "People directory, organization and workforce", category: "Business", href: "/people", icon: Users, tag: "People" },
  ]},
  { title: "Insights & administration", subtitle: "Manage information and your ORVA environment", apps: [
    { name: "Reports & analytics", desc: "Operational reports and business intelligence", category: "Manage", href: "/reports", icon: FileText, tag: "Insights" },
    { name: "Company settings", desc: "Company profile, preferences and configuration", category: "Manage", href: "/company-settings", icon: Settings2, tag: "Administration" },
    { name: "Platform administration", desc: "Platform, tenants and service configuration", category: "Manage", href: "/platform", icon: ShieldCheck, tag: "Administration" },
  ]}
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All applications");
  const [favorites, setFavorites] = useState<string[]>(["Executive dashboard", "Procurement"]);
  const [showFavorites, setShowFavorites] = useState(false);
  const apps = groups.flatMap(g => g.apps);
  const filteredGroups = useMemo(() => groups.map(g => ({...g, apps:g.apps.filter(a => {
    const matches = !query || (a.name+" "+a.desc+" "+a.tag).toLowerCase().includes(query.toLowerCase());
    const categoryMatch = category === "All applications" || a.category === category;
    const favoriteMatch = !showFavorites || favorites.includes(a.name);
    return matches && categoryMatch && favoriteMatch;
  })})).filter(g => g.apps.length), [query, category, showFavorites, favorites]);
  const toggleFavorite = (name:string) => setFavorites(current => current.includes(name) ? current.filter(x=>x!==name) : [...current,name]);
  return <main className="orva-launcher">
    <header className="orva-header">
      <Link href="/" className="orva-brand">orva<span>.</span></Link>
      <div className="orva-header-divider"/>
      <div className="orva-header-context"><span className="orva-context-mark">O</span><span><b>ORVA Workspace</b><small>Enterprise business platform</small></span></div>
      <div className="orva-header-spacer"/>
      <button className="orva-header-icon" aria-label="Help"><span>?</span></button>
      <div className="orva-user"><span className="orva-user-avatar">OR</span><span><b>Workspace</b><small>Guest preview</small></span></div>
    </header>
    <div className="orva-launcher-layout">
      <aside className="orva-rail">
        <div className="orva-rail-section">WORKSPACE</div>
        <Link href="/" className="orva-rail-link active"><Grid2X2 size={18}/><span>Applications</span></Link>
        <Link href="/overview" className="orva-rail-link"><LayoutDashboard size={18}/><span>Dashboard</span></Link>
        <div className="orva-rail-section rail-gap">FAVORITES</div>
        {favorites.map(name => <button className="orva-rail-link" key={name} onClick={()=>{setQuery(name);setShowFavorites(false)}}><Star size={16}/><span>{name}</span></button>)}
        <div className="orva-rail-bottom"><div className="orva-rail-help"><Sparkles size={17}/><span><b>ORVA Preview</b><small>Explore the workspace</small></span></div><small>ORVA · by LogiSource Digital</small></div>
      </aside>
      <section className="orva-launcher-main">
        <div className="orva-breadcrumb"><span>Workspace</span><ChevronRight size={13}/><b>Applications</b></div>
        <div className="orva-launcher-title-row"><div><div className="orva-overline">APPLICATION CENTER</div><h1>Good morning.</h1><p>Everything you need to manage your business, in one place.</p></div><div className="orva-date-chip"><Clock3 size={15}/> Your workspace</div></div>
        <div className="orva-launcher-tools">
          <label className="orva-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search applications..." aria-label="Search applications"/><kbd><Command size={12}/> K</kbd></label>
          <div className="orva-filter-tabs">{["All applications","Workspace","Business","Manage"].map(x=><button key={x} className={category===x?"selected":""} onClick={()=>setCategory(x)}>{x}</button>)}</div>
          <button className={"orva-favorites-toggle "+(showFavorites?"selected":"")} onClick={()=>setShowFavorites(v=>!v)}><Star size={15}/> Favorites</button>
        </div>
        <div className="orva-app-summary"><span><b>{filteredGroups.reduce((n,g)=>n+g.apps.length,0)}</b> applications</span><span>Choose an application to get started <ArrowUpRight size={14}/></span></div>
        {filteredGroups.length ? filteredGroups.map(group=><section className="orva-app-group" key={group.title}><div className="orva-group-heading"><div><h2>{group.title}</h2><p>{group.subtitle}</p></div><span>{String(group.apps.length).padStart(2,"0")}</span></div><div className="orva-app-grid">{group.apps.map(app=>{const Icon=app.icon;return <article className="orva-app-card" key={app.name}><Link href={app.href} className="orva-app-open"><span className="orva-app-icon"><Icon size={22} strokeWidth={1.7}/></span><span className="orva-app-card-copy"><b>{app.name}</b><small>{app.desc}</small><em>{app.tag}</em></span><ArrowUpRight className="orva-app-arrow" size={17}/></Link><button className={"orva-app-star "+(favorites.includes(app.name)?"is-favorite":"")} onClick={()=>toggleFavorite(app.name)} aria-label={"Toggle "+app.name+" favorite"}><Star size={15} fill={favorites.includes(app.name)?"currentColor":"none"}/></button></article>})}</div></section>) : <div className="orva-empty"><Search size={25}/><b>No applications found</b><span>Try another search or category.</span><button onClick={()=>{setQuery("");setCategory("All applications");setShowFavorites(false)}}>Clear filters</button></div>}
        <footer className="orva-launcher-footer"><span><b>orva.</b> Enterprise platform</span><span>One workspace. Connected business.</span></footer>
      </section>
    </div>
  </main>;
}
