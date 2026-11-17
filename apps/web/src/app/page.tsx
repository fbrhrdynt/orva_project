"use client";

import { useEffect, useMemo, useState } from "react";\nimport { useRouter } from "next/navigation";
import Link from "next/link";
import { PLATFORM_VERSION } from "@/lib/version";
import {
  Activity, ArrowDownUp, ArrowUpRight, Boxes, BriefcaseBusiness, Building2,
  ChevronDown, CircleHelp, Command, FileText, LayoutGrid, Menu, Search,
  Settings2, ShieldCheck, ShoppingCart, Users, Wallet, X
} from "lucide-react";

type Application = {
  name: string;
  description: string;
  group: string;
  icon: typeof Wallet;
  status: "Available" | "Planned";
};

const applications: Application[] = [
  { name: "Finance", description: "Accounting, reporting and financial control", icon: Wallet, group: "Core business", status: "Planned" },
  { name: "Sales", description: "Customers, quotations and order management", icon: ShoppingCart, group: "Core business", status: "Planned" },
  { name: "Procurement", description: "Sourcing, purchasing and supplier relations", icon: Boxes, group: "Core business", status: "Available" },
  { name: "Inventory", description: "Stock control and warehouse operations", icon: Building2, group: "Core business", status: "Planned" },
  { name: "People", description: "Workforce and organizational management", icon: Users, group: "People & operations", status: "Planned" },
  { name: "Projects", description: "Projects, resources and delivery", icon: BriefcaseBusiness, group: "People & operations", status: "Planned" },
  { name: "Operations", description: "Operational planning and execution", icon: Activity, group: "People & operations", status: "Planned" },
  { name: "Documents", description: "Business records and document control", icon: FileText, group: "Platform", status: "Planned" }
];

const groups = [
  { name: "Core business", description: "Essential business functions" },
  { name: "People & operations", description: "Plan and manage daily work" },
  { name: "Platform", description: "Shared tools and services" }
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("All applications");
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();\n\n  useEffect(() => {\n    let active = true;\n    fetch("/api/workspace", { cache: "no-store" }).then(async (response) => {\n      if (response.status === 401) { router.replace("/login"); return null; }\n      const data = await response.json();\n      if (!response.ok) throw new Error(data.error || "Unable to load workspace.");\n      return data;\n    }).then((data) => { if (active && data) { setCompanies(data.companies ?? []); setCompanyId(data.selectedCompanyId ?? data.companies?.[0]?.id ?? ""); setEnabledModules(data.enabledModules ?? []); } }).catch(() => { if (active) setEnabledModules([]); });\n    return () => { active = false; };\n  }, [router]);\n\n  async function changeCompany(nextCompanyId: string) {\n    setCompanyId(nextCompanyId);\n    try { const response = await fetch("/api/workspace?companyId=" + encodeURIComponent(nextCompanyId), { cache: "no-store" }); const data = await response.json(); if (response.ok) setEnabledModules(data.enabledModules ?? []); } catch { setEnabledModules([]); }\n  }

  const filtered = useMemo(() => applications.filter((app) => {
    const matchesQuery = !normalizedQuery || [app.name, app.description, app.group].some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesGroup = groupFilter === "All applications" || app.group === groupFilter;
    return matchesQuery && matchesGroup;
  }), [normalizedQuery, groupFilter, enabledModules]);

  const visibleGroups = groups.map((group) => ({
    ...group,
    items: filtered.filter((app) => app.group === group.name)
  })).filter((group) => group.items.length > 0);

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <Link className="wordmark" href="/" aria-label="orva home">orva<span>.</span></Link>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18}/></button>
        </div>
        <button className="workspace-switcher" type="button">
          <span className="workspace-mark">L</span>
          <span className="workspace-copy"><strong>LogiSource Digital</strong><span>Workspace</span></span>
          <ChevronDown size={15}/>
        </button>

        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <Link className="nav-item active" href="/" aria-current="page"><LayoutGrid size={17}/><span>Applications</span></Link>
          <a className="nav-item" href="#activity"><Activity size={17}/><span>My activity</span></a>
          <a className="nav-item" href="#tasks"><FileText size={17}/><span>My tasks</span><span className="nav-count">0</span></a>
        </nav>

        <div className="sidebar-bottom">
          <Link className="nav-item" href="/company-settings"><Settings2 size={17}/><span>Company configuration</span></Link>
          <a className="nav-item" href="#preferences"><Settings2 size={17}/><span>Preferences</span></a>
          <a className="nav-item" href="#help"><CircleHelp size={17}/><span>Help & support</span></a>
          <div className="profile">
            <div className="avatar">OR</div>
            <div className="profile-copy"><strong>Workspace administrator</strong><span>Preview environment</span></div>
            <ChevronDown size={15}/>
          </div>
        </div>
      </aside>

      {menuOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}

      <section className="content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19}/></button>
            <div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>Applications</strong></div>
          </div>
          <div className="topbar-actions">
            <span className="environment"><span className="environment-dot"/>Workspace</span>\n            {companies.length > 1 && <select className="workspace-company-select" value={companyId} onChange={(event) => void changeCompany(event.target.value)} aria-label="Switch company">{companies.map((company) => <option key={company.id} value={company.id}>{company.code} · {company.name}</option>)}</select>}
            <div className="topbar-divider"/>
            <button className="icon-button" aria-label="Security information" title="Security information"><ShieldCheck size={17}/></button>
            <button className="icon-button command-button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts"><Command size={17}/></button>
          </div>
        </header>

        <div className="page">
          <section className="page-heading">
            <div>
              <div className="eyebrow">WORKSPACE</div>
              <h1>Applications</h1>
              <p>Access the tools your organization uses to run its business.</p>
            </div>
            <div className="heading-meta"><span className="meta-label">PLATFORM RELEASE</span><strong>{PLATFORM_VERSION}</strong></div>
          </section>

          <div className="search-row">
            <label className="search-box">
              <Search size={17} aria-hidden="true"/>
              <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search applications" placeholder="Search applications..." />
              {query ? <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14}/></button> : <kbd>⌘ K</kbd>}
            </label>
            <label className="filter-control">
              <span className="filter-label">Category</span>
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                <option>All applications</option>
                {groups.map((group) => <option key={group.name}>{group.name}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true"/>
            </label>
          </div>

          <div className="results-line"><span>{filtered.length} applications</span><span><ArrowDownUp size={13}/> Organized by category</span></div>

          {visibleGroups.length > 0 ? visibleGroups.map((group) => (
            <section className="application-section" key={group.name}>
              <div className="section-heading">
                <div><h2>{group.name}</h2><span>{group.description}</span></div>
                <span className="section-count">{String(group.items.length).padStart(2, "0")}</span>
              </div>
              <div className="application-grid">
                {group.items.map(({ name, description, icon: Icon, status }) => (
                  <Link href={name === "Procurement" ? "/procurement" : "#"} className="application-item" key={name}>
                    <div className="application-icon"><Icon size={19} strokeWidth={1.7}/></div>
                    <div className="application-copy"><h3>{name}</h3><p>{description}</p></div>
                    <span className="application-status">{status}</span>
                    <ArrowUpRight className="application-arrow" size={15}/>
                  </Link>
                ))}
              </div>
            </section>
          )) : (
            <div className="empty-state"><Search size={21}/><strong>No applications found</strong><span>Try a different search term or category.</span><button type="button" onClick={() => { setQuery(""); setGroupFilter("All applications"); }}>Clear filters</button></div>
          )}

          <footer className="page-footer"><span><strong>orva.</strong><span className="footer-separator">/</span> by LogiSource Digital</span><span>Platform foundation · {PLATFORM_VERSION}</span></footer>
        </div>
      </section>
    </main>
  );
}
