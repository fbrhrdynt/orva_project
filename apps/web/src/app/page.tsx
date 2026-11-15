import {
  Activity,
  ArrowUpRight,
  Boxes,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleHelp,
  Command,
  FileText,
  LayoutGrid,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet
} from "lucide-react";

const applications = [
  { name: "Finance", description: "Accounting and financial control", icon: Wallet, group: "Core business" },
  { name: "Sales", description: "Customers, quotations and orders", icon: ShoppingCart, group: "Core business" },
  { name: "Procurement", description: "Sourcing and purchasing", icon: Boxes, group: "Core business" },
  { name: "Inventory", description: "Stock and warehouse operations", icon: Building2, group: "Core business" },
  { name: "People", description: "Workforce and organization", icon: Users, group: "People & operations" },
  { name: "Projects", description: "Projects, resources and delivery", icon: BriefcaseBusiness, group: "People & operations" },
  { name: "Operations", description: "Operational planning and control", icon: Activity, group: "People & operations" },
  { name: "Documents", description: "Business records and files", icon: FileText, group: "Platform" }
];

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="wordmark" href="#" aria-label="orva home">orva<span>.</span></a>
        <div className="workspace-switcher">
          <div className="workspace-mark">L</div>
          <div className="workspace-copy">
            <strong>LogiSource Digital</strong>
            <span>Workspace</span>
          </div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#"><LayoutGrid size={17}/><span>Applications</span></a>
          <a className="nav-item" href="#"><Activity size={17}/><span>My activity</span></a>
          <a className="nav-item" href="#"><FileText size={17}/><span>My tasks</span><span className="nav-count">0</span></a>
        </nav>

        <div className="sidebar-bottom">
          <a className="nav-item" href="#"><Settings2 size={17}/><span>Preferences</span></a>
          <a className="nav-item" href="#"><CircleHelp size={17}/><span>Help & support</span></a>
          <div className="profile">
            <div className="avatar">FH</div>
            <div className="profile-copy"><strong>Workspace admin</strong><span>Administrator</span></div>
            <ChevronDown size={15}/>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>Applications</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Security status"><ShieldCheck size={17}/></button>
            <button className="icon-button" aria-label="Command menu"><Command size={17}/></button>
            <div className="topbar-divider"/>
            <span className="environment">Development</span>
          </div>
        </header>

        <div className="page">
          <section className="page-heading">
            <div>
              <div className="eyebrow">YOUR BUSINESS WORKSPACE</div>
              <h1>Applications</h1>
              <p>Everything your organization works with, in one place.</p>
            </div>
            <button className="text-action">Manage applications <ArrowUpRight size={15}/></button>
          </section>

          <div className="search-row">
            <label className="search-box">
              <Search size={17}/>
              <input aria-label="Search applications" placeholder="Find an application..." />
              <kbd>⌘ K</kbd>
            </label>
            <button className="filter-button">All applications <ChevronDown size={15}/></button>
          </div>

          <section className="application-section">
            <div className="section-heading">
              <div><h2>Core business</h2><span>Essential business functions</span></div>
              <span className="section-count">04</span>
            </div>
            <div className="application-grid">
              {applications.filter(app => app.group === "Core business").map(({name,description,icon:Icon}) => (
                <article className="application-item" key={name}>
                  <div className="application-icon"><Icon size={20} strokeWidth={1.7}/></div>
                  <div className="application-copy"><h3>{name}</h3><p>{description}</p></div>
                  <ArrowUpRight className="application-arrow" size={15}/>
                </article>
              ))}
            </div>
          </section>

          <section className="application-section">
            <div className="section-heading">
              <div><h2>People & operations</h2><span>Plan and manage daily work</span></div>
              <span className="section-count">03</span>
            </div>
            <div className="application-grid">
              {applications.filter(app => app.group === "People & operations").map(({name,description,icon:Icon}) => (
                <article className="application-item" key={name}>
                  <div className="application-icon"><Icon size={20} strokeWidth={1.7}/></div>
                  <div className="application-copy"><h3>{name}</h3><p>{description}</p></div>
                  <ArrowUpRight className="application-arrow" size={15}/>
                </article>
              ))}
            </div>
          </section>

          <section className="application-section">
            <div className="section-heading">
              <div><h2>Platform</h2><span>Shared tools and services</span></div>
              <span className="section-count">01</span>
            </div>
            <div className="application-grid">
              {applications.filter(app => app.group === "Platform").map(({name,description,icon:Icon}) => (
                <article className="application-item" key={name}>
                  <div className="application-icon"><Icon size={20} strokeWidth={1.7}/></div>
                  <div className="application-copy"><h3>{name}</h3><p>{description}</p></div>
                  <ArrowUpRight className="application-arrow" size={15}/>
                </article>
              ))}
            </div>
          </section>

          <footer className="page-footer"><span>orva. <span className="footer-separator">/</span> by LogiSource Digital</span><span>Platform foundation · 0.1.0.0</span></footer>
        </div>
      </section>
    </main>
  );
}
