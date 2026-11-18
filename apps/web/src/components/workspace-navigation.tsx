"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Boxes, Building2, ChevronRight, Grid2X2, Menu, Settings2, ShieldCheck, ShoppingCart, Wallet, X } from "lucide-react";

const links = [
  { label: "Applications", href: "/", icon: Grid2X2 },
  { label: "Business overview", href: "/overview", icon: Activity },
  { label: "Procurement", href: "/procurement", icon: ShoppingCart },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Master data", href: "/master-data", icon: Building2 },
];
const admin = [
  { label: "Company configuration", href: "/company-settings", icon: Settings2 },
  { label: "Subscription & usage", href: "/subscription", icon: Wallet },
  { label: "Platform administration", href: "/platform", icon: ShieldCheck },
];

export default function WorkspaceNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (!active) return;
        if (data?.authenticated && data?.tenant?.name) {
          setWorkspaceName(data.tenant.name);
          setAuthenticated(true);
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setSessionChecked(true); });
    return () => { active = false; };
  }, []);
  if (pathname === "/login" || !sessionChecked || !authenticated) return null;
  const nav = (items: typeof links) => items.map(({ label, href, icon: Icon }) => {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
    return <Link key={href} href={href} onClick={() => setOpen(false)} className={"orva-global-link" + (active ? " is-active" : "")} aria-current={active ? "page" : undefined}><Icon size={17}/><span>{label}</span>{active && <ChevronRight className="orva-nav-chevron" size={14}/>}</Link>;
  });
  return <>
    <header className="orva-mobile-bar"><Link href="/" className="orva-global-brand">orva<span>.</span></Link><span className="orva-mobile-context">{links.find(x => x.href === pathname)?.label || (pathname.startsWith("/procurement") ? "Procurement" : pathname.split("/").filter(Boolean).pop()?.replaceAll("-", " ") || "Workspace")}</span><button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(v => !v)}><Menu size={21}/></button></header>
    <aside className="orva-global-sidebar">
      <Link href="/" className="orva-global-brand">orva<span>.</span></Link>
      <div className="orva-global-workspace"><span className="orva-global-mark">O</span><span><strong>{workspaceName}</strong><small>ORVA workspace</small></span></div>
      <div className="orva-global-label">WORKSPACE</div><nav>{nav(links)}</nav>
      <div className="orva-global-label orva-global-label--admin">ADMINISTRATION</div><nav>{nav(admin)}</nav>
      <div className="orva-global-foot">by LogiSource Digital</div>
    </aside>
    {open && <><button className="orva-global-backdrop" onClick={() => setOpen(false)} aria-label="Close navigation"/><aside className="orva-global-drawer"><div className="orva-drawer-head"><Link href="/" className="orva-global-brand" onClick={() => setOpen(false)}>orva<span>.</span></Link><button onClick={() => setOpen(false)} aria-label="Close menu"><X size={20}/></button></div><div className="orva-global-label">WORKSPACE</div><nav>{nav(links)}</nav><div className="orva-global-label orva-global-label--admin">ADMINISTRATION</div><nav>{nav(admin)}</nav><div className="orva-global-foot">by LogiSource Digital</div></aside></>}
  </>;
}
