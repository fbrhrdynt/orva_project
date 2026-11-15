import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import Link from "next/link";

type SampleRecord = { id: string; reference: string; owner: string; status: string; amount: string };

const rows: SampleRecord[] = [
  { id: "1", reference: "PO-2026-0041", owner: "Operations", status: "Pending review", amount: "12,450.00" },
  { id: "2", reference: "PO-2026-0040", owner: "Procurement", status: "Approved", amount: "8,920.00" },
  { id: "3", reference: "PO-2026-0039", owner: "Finance", status: "Draft", amount: "2,180.00" }
];

export default function DesignSystemPage() {
  return (
    <main className="design-system-shell">
      <header className="design-system-topbar">
        <Link href="/" className="wordmark" aria-label="orva home">orva<span>.</span></Link>
        <span>Internal component reference</span>
      </header>
      <div className="design-system-content">
        <PageHeader eyebrow="FOUNDATION / UI KIT" title="ORVA Design System" description="Reusable interface foundations for every ORVA application." actions={<Button variant="secondary">Version 0.1.0.2</Button>} />
        <section className="ds-section">
          <div className="ds-section-heading"><h2>Actions</h2><p>Buttons use clear hierarchy and restrained emphasis.</p></div>
          <div className="ds-row"><Button variant="primary">Create record</Button><Button variant="secondary">Save changes</Button><Button variant="ghost">Cancel</Button><Button variant="danger">Delete record</Button><Button size="sm">Small action</Button></div>
        </section>
        <section className="ds-section">
          <div className="ds-section-heading"><h2>Status</h2><p>Semantic status labels never rely on color alone.</p></div>
          <div className="ds-row"><Badge tone="neutral">Draft</Badge><Badge tone="info">In review</Badge><Badge tone="success">Approved</Badge><Badge tone="warning">Pending</Badge><Badge tone="danger">Rejected</Badge></div>
        </section>
        <section className="ds-section">
          <div className="ds-section-heading"><h2>Form controls</h2><p>Labels, hints and validation remain attached to each field.</p></div>
          <div className="ds-form-grid"><TextField label="Document reference" placeholder="e.g. PO-2026-0042" hint="Use your organization's reference format."/><SelectField label="Approval status" options={[{label:"Draft",value:"draft"},{label:"Pending review",value:"pending"},{label:"Approved",value:"approved"}]}/></div>
        </section>
        <section className="ds-section">
          <div className="ds-section-heading"><h2>Data table</h2><p>Compact transactional data with aligned numeric values.</p></div>
          <DataTable rows={rows} columns={[{key:"reference",header:"Reference"},{key:"owner",header:"Owner"},{key:"status",header:"Status"},{key:"amount",header:"Amount",align:"right"}]}/>
        </section>
        <footer className="ds-footer"><span>orva. / by LogiSource Digital</span><Link href="/">Return to workspace</Link></footer>
      </div>
    </main>
  );
}