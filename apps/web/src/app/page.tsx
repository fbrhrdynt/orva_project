"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLATFORM_VERSION } from "@/lib/version";
import {
  Activity, ArrowDownUp, ArrowUpRight, Boxes, BriefcaseBusiness, Building2,
  ChevronDown, CircleHelp, Command, FileText, LayoutGrid, Menu, Search,
  Settings2, ShieldCheck, ShoppingCart, Users, Wallet, X, Warehouse, SlidersHorizontal
} from "lucide-react";

type Application = {
  name: string;
  description: string;
  group: string;
  icon: typeof Wallet;
  status: "Available" | "Planned" | "Locked";
  href: string;
};

const applications: Application[] = [
  { name: "Business overview", description: "Live KPIs, purchasing workload and recent activity", icon: Activity, group: "Workspace", status: "Available", href: "/overview" },
  { name: "Procurement", description: "Purchase requisitions, purchase orders, approvals and receiving", icon: ShoppingCart, group: "Core business", status: "Available", href: "/procurement" },
  { name: "Inventory", description: "Stock balances, adjustments and warehouse transfers", icon: Boxes, group: "Core business", status: "Available", href: "/inventory" },
  { name: "Master data", description: "Manage customers, suppliers, items and warehouses", icon: Building2, group: "Core business", status: "Available", href: "/master-data" },
  { name: "Company settings", description: "Legal entity, localization and module configuration", icon: SlidersHorizontal, group: "Administration", status: "Available", href: "/company-settings" },
  { name: "Subscription", description: "Plan, module entitlements and usage information", icon: Wallet, group: "Administration", status: "Available", href: "/subscription" },
  { name: "Platform administration", description: "Platform-level tenant and subscription operations", icon: Settings2, group: "Administration", status: "Available", href: "/platform" },
  { name: "Sales & CRM", description: "Leads, opportunities, quotations and customer orders", icon: Users, group: "Coming next", status: "Planned", href: "#" },
  { name: "Finance", description: "General ledger, payables, receivables and financial reports", icon: Wallet, group: "Coming next", status: "Planned", href: "#" },
  { name: "People & projects", description: "Employee records, project delivery and timesheets", icon: BriefcaseBusiness, group: "Coming next", status: "Planned", href: "#" },
  { name: "Asset maintenance", description: "Equipment register, preventive maintenance and work orders", icon: Warehouse, group: "Coming next", status: "Planned", href: "#" },
  { name: "Documents & workflow", description: "Controlled records, approvals and document retention", icon: FileText, group: "Coming next", status: "Planned", href: "#" }
];

const groups = [
  { name: "Workspace", description: "Your operational pulse at a glance" },
  { name: "Core business", description: "Daily business transactions and shared records" },
  { name: "Administration", description: "Company and platform configuration" },
  { name: "Coming next", description: "Planned modules — not yet enabled for business use" }
];

export default function Home() {
  const router = useRouter();
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [companies, setCompanies] = useState<{id:string;code:string;name:string}[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("All applications");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userLabel, setUserLabel] = useState("Workspace user");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("orva-app-search")?.focus();
      }
      if (event.key === "Escape" && document.activeElement?.id === "orva-app-search") {
        setQuery("");
        (document.activeElement as HTMLElement | null)?.blur();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.replace("/login"); return null; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load workspace.");
      return data;
    }).then((data) => {
      if (active && data) {
        setCompanies(data.companies ?? []);
        setCompanyId(data.selectedCompanyId ?? data.companies?.[0]?.id ?? "");
        setEnabledModules(data.enabledModules ?? []);
        setUserLabel(data.user?.name || data.user?.email || "Workspace user");
      }
    }).catch(() => { if (active) setEnabledModules([]); });
    return () => { active = false; };
  }, [router]);

  async function changeCompany(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    try {
      const response = await fetch("/api/workspace?companyId=" + encodeURIComponent(nextCompanyId), { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setEnabledModules(data.enabledModules ?? []);
    } catch { setEnabledModules([]); }
  }

  const filtered = useMemo(() => applications
    .map((app) => {
      const entitlementKey = app.name === "Procurement" ? "procurement" : app.name === "Inventory" ? "inventory" : null;
      const entitled = !entitlementKey || enabledModules.includes(entitlementKey);
      return { ...app, status: app.status === "Available" && !entitled ? "Locked" as const : app.status };
    })
    .filter((app) => {
      const matchesQuery = !normalizedQuery || [app.name, app.description, app.group].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesGroup = groupFilter === "All applications" || app.group === groupFilter;
      return matchesQuery && matchesGroup;
    }), [normalizedQuery, groupFilter, enabledModules]);

  const visibleGroups = groups.map((group) => ({ ...group, items: filtered.filter((app) => app.group === group.name) })).filter((group) => group.items.length > 0);
  const availableCount = filtered.filter(app => app.status === "Available").length;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head"><Link className="wordmark" href="/" aria-label="orva home">orva<span>.</span></Link><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
        <button className="workspace-switcher" type="button" onClick={() => companies.length > 1 && document.getElementById("company-switcher")?.focus()}>
          <span className="workspace-mark">O</span><span className="workspace-copy"><strong>{companies.find(c => c.id === companyId)?.name || "ORVA Workspace"}</strong><span>{companies.length} accessible {companies.length === 1 ? "company" : "companies"}</span></span><ChevronDown size={15}/>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <Link className="nav-item active" href="/" aria-current="page"><LayoutGrid size={17}/><span>Applications</span></Link>
          <Link className="nav-item" href="/overview"><Activity size={17}/><span>Business overview</span></Link>
          <Link className="nav-item" href="/procurement"><ShoppingCart size={17}/><span>Procurement</span></Link>
          <Link className="nav-item" href="/inventory"><Boxes size={17}/><span>Inventory</span></Link>
          <Link className="nav-item" href="/master-data"><Building2 size={17}/><span>Master data</span></Link>
        </nav>
        <div className="sidebar-bottom">
          <Link className="nav-item" href="/company-settings"><Settings2 size={17}/><span>Company configuration</span></Link>
          <Link className="nav-item" href="/subscription"><Wallet size={17}/><span>Subscription & usage</span></Link>
          <Link className="nav-item" href="/platform"><ShieldCheck size={17}/><span>Platform administration</span></Link>
          <a className="nav-item" href="#help"><CircleHelp size={17}/><span>Help & support</span></a>
          <div className="profile"><div className="avatar">{userLabel.slice(0,2).toUpperCase()}</div><div className="profile-copy"><strong>{userLabel}</strong><span>Signed-in workspace user</span></div><ChevronDown size={15}/></div>
        </div>
      </aside>
      {menuOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
      <section className="content">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19}/></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>Applications</strong></div></div>
          <div className="topbar-actions">
            <span className="environment"><span className="environment-dot"/>Live workspace</span>
            {companies.length > 1 && <select id="company-switcher" className="workspace-company-select" value={companyId} onChange={(event) => void changeCompany(event.target.value)} aria-label="Switch company">{companies.map((company) => <option key={company.id} value={company.id}>{company.code} · {company.name}</option>)}</select>}
            <div className="topbar-divider"/><button className="icon-button" aria-label="Security information" title="Security information"><ShieldCheck size={17}/></button><button className="icon-button command-button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts"><Command size={17}/></button>
          </div>
        </header>
        <div className="page">
          <section className="page-heading"><div><div className="eyebrow">YOUR BUSINESS, CONNECTED</div><h1>Good to see you, {userLabel.split(" ")[0]}.</h1><p>Choose an application to continue your daily operations.</p></div><div className="heading-meta"><span className="meta-label">PLATFORM RELEASE</span><strong>{PLATFORM_VERSION}</strong></div></section>
          <section className="workspace-welcome"><div><span className="welcome-kicker">WORKSPACE AT A GLANCE</span><strong>{companies.find(c => c.id === companyId)?.name || "Your organization"}</strong><span>One place to manage purchasing, stock and company records.</span></div><div className="welcome-stat"><strong>{availableCount}</strong><span>Available workspaces</span></div></section>
          <div className="search-row"><label className="search-box"><Search size={17} aria-hidden="true"/><input id="orva-app-search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search applications" placeholder="Search applications, tasks or settings..." />{query ? <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14}/></button> : <kbd>⌘ K</kbd>}</label><label className="filter-control"><span className="filter-label">Category</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option>All applications</option>{groups.map((group) => <option key={group.name}>{group.name}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></label></div>
          <div className="results-line"><span>{filtered.length} workspaces and modules</span><span><ArrowDownUp size={13}/> Organized by workflow</span></div>
          {visibleGroups.length > 0 ? visibleGroups.map((group, groupIndex) => (
            <section className={`application-section application-section--${groupIndex % 4}`} key={group.name}>
              <div className="section-heading"><div><h2>{group.name}</h2><span>{group.description}</span></div><span className="section-count">{String(group.items.length).padStart(2, "0")}</span></div>
              <div className="application-grid">{group.items.map(({ name, description, icon: Icon, status, href }, index) => (
                <Link href={href} aria-disabled={status !== "Available"} onClick={event => { if (status !== "Available") event.preventDefault(); }} className={`application-item application-item--tone-${index % 6} ${status !== "Available" ? "application-item--planned" : ""}`} key={name}>
                  <div className="application-icon"><Icon size={19} strokeWidth={1.8}/></div><div className="application-copy"><h3>{name}</h3><p>{description}</p></div><span className={`application-status ${status === "Available" ? "is-available" : status === "Locked" ? "is-locked" : "is-planned"}`}>{status === "Locked" ? "Plan required" : status}</span><ArrowUpRight className="application-arrow" size={15}/>
                </Link>
              ))}</div>
            </section>
          )) : <div className="empty-state"><Search size={21}/><strong>No applications found</strong><span>Try a different search term or category.</span><button type="button" onClick={() => { setQuery(""); setGroupFilter("All applications"); }}>Clear filters</button></div>}
          <footer className="page-footer"><span><strong>orva.</strong><span className="footer-separator">/</span> by LogiSource Digital</span><span>Business workspace · {PLATFORM_VERSION}</span></footer>
        </div>
      </section>
    </main>
  );
}
