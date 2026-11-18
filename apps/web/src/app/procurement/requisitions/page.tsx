"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, RefreshCw, Send } from "lucide-react";

type Company = { id: string; code: string; name: string };
type Requisition = { id: string; documentNumber: string; requestedAt: string; requiredAt: string | null; purpose: string | null; status: string; priority: string; currency: string; lines: { id: string; description: string; quantity: string; uomCode: string; estimatedPrice: string | null }[] };
const labels: Record<string,string> = { DRAFT:"Draft", SUBMITTED:"Awaiting approval", APPROVED:"Approved", REJECTED:"Rejected", PARTIALLY_RECEIVED:"Partially received", RECEIVED:"Received", CANCELLED:"Cancelled" };
const date = (v:string) => new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v));

export default function RequisitionsPage() {
  const router = useRouter();
  const [companies,setCompanies] = useState<Company[]>([]);
  const [companyId,setCompanyId] = useState("");
  const [items,setItems] = useState<Requisition[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [creating,setCreating] = useState(false);
  const [number,setNumber] = useState("");
  const [purpose,setPurpose] = useState("");
  const [description,setDescription] = useState("");
  const [quantity,setQuantity] = useState("1");
  const [uom,setUom] = useState("PCS");
  const [requiredAt,setRequiredAt] = useState("");

  useEffect(()=>{ let active=true; fetch("/api/workspace",{cache:"no-store"}).then(async r=>{if(r.status===401){router.replace("/login");return null;} const d=await r.json(); if(!r.ok) throw new Error(d.error); return d;}).then(d=>{if(active&&d){setCompanies(d.companies);setCompanyId(d.companies?.[0]?.id??"");}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);}); return ()=>{active=false;};},[router]);

  const load = useCallback(async()=>{ if(!companyId)return; setLoading(true); try{const r=await fetch(`/api/procurement/purchase-requisitions?companyId=${encodeURIComponent(companyId)}&take=100`,{cache:"no-store"}); const d=await r.json(); if(r.status===401){router.replace("/login");return;} if(!r.ok)throw new Error(d.error);setItems(d.items??[]);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load requisitions");}finally{setLoading(false);}},[companyId,router]);
  useEffect(()=>{void load();},[load]);

  async function create(event:FormEvent){event.preventDefault();setError("");try{const r=await fetch("/api/procurement/purchase-requisitions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId,documentNumber:number,purpose,requiredAt:requiredAt||undefined,lines:[{description,quantity,uomCode:uom}]})});const d=await r.json();if(!r.ok)throw new Error(d.error);setCreating(false);setNumber("");setPurpose("");setDescription("");setQuantity("1");setRequiredAt("");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to create requisition");}}
  async function submit(id:string){try{const r=await fetch("/api/procurement/purchase-requisitions/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId,requisitionId:id})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to submit requisition");}}

  return <main className="procurement-page"><header className="procurement-topbar"><Link href="/" className="procurement-brand">orva<span>.</span></Link><span className="procurement-environment">PROCUREMENT</span></header><section className="procurement-content"><Link href="/procurement" className="procurement-back"><ArrowLeft size={14}/> Purchase orders</Link><nav className="procurement-subnav"><Link href="/procurement">Purchase orders</Link><Link href="/procurement/requisitions">Purchase requisitions</Link><Link href="/procurement/receipts">Goods receipts</Link><Link href="/master-data">Master data</Link></nav><div className="procurement-heading"><div><div className="procurement-eyebrow">PROCUREMENT / DEMAND MANAGEMENT</div><h1>Purchase requisitions</h1><p>Request goods and services before purchasing commitments are created.</p></div><button className="procurement-primary" onClick={()=>setCreating(!creating)}><Plus size={15}/> New requisition</button></div>
  <label className="procurement-company-select"><select value={companyId} onChange={e=>setCompanyId(e.target.value)}>{companies.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>
  {error&&<div className="procurement-error" role="alert">{error}</div>}
  {creating&&<form className="procurement-form" onSubmit={create}><div className="procurement-form-head"><strong>New purchase requisition</strong><span>Creates a draft document</span></div><div className="procurement-form-grid"><label>Document number<input required value={number} onChange={e=>setNumber(e.target.value)} placeholder="PR-2026-0001"/></label><label>Required by<input type="date" value={requiredAt} onChange={e=>setRequiredAt(e.target.value)}/></label><label className="wide">Purpose<input value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="Reason for this purchase"/></label><label className="wide">Item description<input required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe goods or services"/></label><label>Quantity<input required type="number" min="0.0001" step="0.0001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Unit of measure<input required value={uom} onChange={e=>setUom(e.target.value.toUpperCase())}/></label></div><div className="procurement-form-actions"><button type="button" className="procurement-secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="procurement-primary" type="submit">Save draft</button></div></form>}
  <section className="procurement-panel"><div className="procurement-panel-heading"><div><h2>Requisition register</h2><p>Drafts, submitted requests and approval outcomes</p></div><button className="procurement-refresh" onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></div><div className="procurement-table-wrap"><table className="procurement-table"><thead><tr><th>Document</th><th>Purpose</th><th>Requested</th><th>Required by</th><th>Lines</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><strong className="po-number">{item.documentNumber}</strong><small>{item.priority} priority</small></td><td>{item.purpose||item.lines[0]?.description||"—"}</td><td>{date(item.requestedAt)}</td><td>{item.requiredAt?date(item.requiredAt):"—"}</td><td>{item.lines.length}</td><td><span className="po-status">{labels[item.status]??item.status}</span></td><td>{item.status==="DRAFT"?<button className="procurement-inline-action" onClick={()=>void submit(item.id)}><Send size={13}/> Submit</button>:"—"}</td></tr>)}{!loading&&items.length===0&&<tr><td colSpan={7} className="po-empty">No purchase requisitions yet.</td></tr>}{loading&&<tr><td colSpan={7} className="po-empty">Loading requisitions...</td></tr>}</tbody></table></div><div className="procurement-panel-foot">Requests are tenant and company scoped. Submission records an audit event.</div></section></section></main>;
}
