"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, Boxes, Building2, ChevronRight, Grid2X2, Menu, Settings2,
  ShieldCheck, ShoppingCart, Wallet, X, UserRound, CircleHelp
} from "lucide-react";

const links = [
  { label: "App launcher", href: "/", icon: Grid2X2 },
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

type SessionUser = { name?: string | null; email?: string | null };

export default function WorkspaceNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [user, setUser] = useState<SessionUser>({});
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
          setUser(data.user ?? {});
          setAuthenticated(true);
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setSessionChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  if (pathname === "/login" || !sessionChecked || !authenticated) return null;

  const displayName = user.name || user.email || "Workspace user";
  const initials = displayName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "OR";
  const nav = (items: typeof links) => items.map(({ label, href, icon: Icon }) => {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link key={href} href={href} className={"orva-global-link" + (active ? " is-active" : "")} aria-current={active ? "page" : undefined}>
        <Icon size={17}/><span>{label}</span>{active && <ChevronRight className="orva-nav-chevron" size={14}/>}
      </Link>
    );
  });

  const navigation = <>
    <div className="orva-global-label">WORKSPACE</div>
    <nav aria-label="Workspace navigation">{nav(links)}</nav>
    <div className="orva-global-label orva-global-label--admin">MANAGE</div>
    <nav aria-label="Administration navigation">{nav(admin)}</nav>
  </>;

  return <>
    <header className="orva-mobile-bar">
      <Link href="/" className="orva-global-brand" aria-label="ORVA app launcher">orva<span>.</span></Link>
      <span className="orva-mobile-context">{links.find(x => x.href === pathname)?.label || (pathname.startsWith("/procurement") ? "Procurement" : pathname.split("/").filter(Boolean).pop()?.replaceAll("-", " ") || "Workspace")}</span>
      <button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(value => !value)}>{open ? <X size={21}/> : <Menu size={21}/>}</button>
    </header>

    <aside className="orva-global-sidebar">
      <Link href="/" className="orva-global-brand">orva<span>.</span></Link>
      <div className="orva-global-workspace">
        <span className="orva-global-mark">O</span>
        <span><strong>{workspaceName}</strong><small>Connected workspace</small></span>
      </div>
      {navigation}
      <div className="orva-global-sidebar-bottom">
        <Link href="/company-settings" className="orva-global-help"><CircleHelp size={16}/> Help & workspace settings</Link>
        <div className="orva-global-profile">
          <span className="orva-global-avatar">{initials}</span>
          <span className="orva-global-profile-copy"><strong>{displayName}</strong><small>{user.email || "Signed-in user"}</small></span>
          <UserRound size={15}/>
        </div>
        <div className="orva-global-foot">ORVA Enterprise <span>·</span> by LogiSource Digital</div>
      </div>
    </aside>

    {open && <>
      <button className="orva-global-backdrop" onClick={() => setOpen(false)} aria-label="Close navigation"/>
      <aside className="orva-global-drawer">
        <div className="orva-drawer-head"><Link href="/" className="orva-global-brand">orva<span>.</span></Link><button onClick={() => setOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
        <div className="orva-global-workspace"><span className="orva-global-mark">O</span><span><strong>{workspaceName}</strong><small>Connected workspace</small></span></div>
        {navigation}
        <div className="orva-global-sidebar-bottom">
          <div className="orva-global-profile"><span className="orva-global-avatar">{initials}</span><span className="orva-global-profile-copy"><strong>{displayName}</strong><small>{user.email || "Signed-in user"}</small></span></div>
          <div className="orva-global-foot">ORVA Enterprise <span>·</span> by LogiSource Digital</div>
        </div>
      </aside>
    </>}
  </>;
}
