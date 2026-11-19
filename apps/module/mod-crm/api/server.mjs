import { Pool } from 'pg';
import { verifyAccessToken } from './auth.mjs';

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'orva', user: process.env.PGUSER || 'orva_app',
  password: process.env.PGPASSWORD_B64 ? Buffer.from(process.env.PGPASSWORD_B64,'base64').toString('utf8') : process.env.PGPASSWORD,
  max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, application_name: 'orva-crm-api'
});
const TYPES = new Set(['leads','customers','contacts','opportunities','activities','lead_sources','pipeline_stages','activity_types','lost_reasons','sales_teams','activity_plans','opportunity_tags','lead_mining_requests']);
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
async function body(req){let n=0,chunks=[];for await(const c of req){n+=c.length;if(n>65536)throw Object.assign(new Error('Payload too large'),{status:413});chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}}
function token(req){const b=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];const c=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('orva_session='));return b||(c?decodeURIComponent(c.slice(13)):null);}
async function session(req){const t=token(req);if(!t)return null;let claims;try{claims=verifyAccessToken(t,process.env.ORVA_AUTH_SECRET);}catch{return null;}const q=await pool.query("SELECT u.id,u.is_platform_owner,u.status user_status,m.organization_id,m.status membership_status,o.status organization_status FROM core.users u JOIN core.memberships m ON m.user_id=u.id JOIN core.organizations o ON o.id=m.organization_id WHERE u.id=$1 AND m.organization_id=$2 LIMIT 1",[claims.sub,claims.organization_id]);const s=q.rows[0];if(!s||s.user_status!=='active'||s.membership_status!=='active'||s.organization_status!=='active')return null;const access=await pool.query("SELECT 1 FROM core.organization_modules om LEFT JOIN core.user_module_access a ON a.organization_id=om.organization_id AND a.module_key=om.module_key AND a.user_id=$2 WHERE om.organization_id=$1 AND om.module_key='crm' AND om.enabled=true AND ($3=true OR COALESCE(a.can_access,false)=true)",[s.organization_id,s.id,s.is_platform_owner]);return access.rowCount?{...s,claims}:null;}
async function readOptions(req,res,s,url){
 const kind=(url.searchParams.get('kind')||'').trim(),q=(url.searchParams.get('q')||'').trim().slice(0,80),limit=Math.min(20,Math.max(5,Number.parseInt(url.searchParams.get('limit')||'20',10)||20));
 let rows=[];
 if(kind==='users'){
  const r=await pool.query("SELECT u.id,u.full_name AS label,u.email FROM core.users u JOIN core.memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND u.status='active' AND m.status='active' AND ($2='' OR u.full_name ILIKE '%'||$2||'%' OR u.email ILIKE '%'||$2||'%') ORDER BY u.full_name LIMIT $3",[s.organization_id,q,limit]);
  rows=r.rows.map(x=>({...x,label:x.email?x.label+' · '+x.email:x.label}));
 }else{
  const types=kind==='related'?['leads','customers','contacts','opportunities']:[kind];
  if(!types.every(t=>TYPES.has(t)))return send(res,400,{error:'Invalid lookup type'});
  const r=await pool.query("SELECT id,record_type,COALESCE(data->>'name',data->>'subject') AS label FROM crm.records WHERE organization_id=$1 AND record_type=ANY($2::text[]) AND COALESCE(data->>'name',data->>'subject','') ILIKE '%'||$3||'%' ORDER BY label LIMIT $4",[s.organization_id,types,q,limit]);
  rows=r.rows.map(x=>({id:x.id,type:x.record_type,label:(kind==='related'?x.record_type.replace(/s$/,'')+' · ':'')+x.label}));
 }
 send(res,200,{data:rows});
}
async function validateLookups(type,data,organizationId){
 const recordRelations={source_id:['lead_sources'],company_id:['customers'],customer_id:['customers'],stage_id:['pipeline_stages'],type_id:['activity_types'],lost_reason_id:['lost_reasons']};
 for(const [field,types] of Object.entries(recordRelations)){
  const id=data[field];if(!id)continue;
  const q=await pool.query('SELECT 1 FROM crm.records WHERE id=$1 AND organization_id=$2 AND record_type=ANY($3::text[])',[id,organizationId,types]);
  if(!q.rowCount)throw Object.assign(new Error('Relasi '+field+' tidak valid atau bukan milik organisasi ini.'),{status:422});
 }
 for(const field of ['owner_id','manager_id']){
  const id=data[field];if(!id)continue;
  const q=await pool.query("SELECT 1 FROM core.users u JOIN core.memberships m ON m.user_id=u.id WHERE u.id=$1 AND m.organization_id=$2 AND u.status='active' AND m.status='active'",[id,organizationId]);
  if(!q.rowCount)throw Object.assign(new Error('User yang dipilih tidak valid.'),{status:422});
 }
 if(data.related_to_id){
  const allowed={leads:['leads'],customers:['customers'],contacts:['contacts'],opportunities:['opportunities']};
  const types=allowed[data.related_to_type];
  if(!types)throw Object.assign(new Error('Tipe record terkait tidak valid.'),{status:422});
  const q=await pool.query('SELECT 1 FROM crm.records WHERE id=$1 AND organization_id=$2 AND record_type=ANY($3::text[])',[data.related_to_id,organizationId,types]);
  if(!q.rowCount)throw Object.assign(new Error('Record terkait tidak valid atau bukan milik organisasi ini.'),{status:422});
 }
}
async function readRecords(req,res,s,url){
 const type=url.searchParams.get('entity');
 if(!TYPES.has(type))return send(res,400,{error:'Invalid CRM entity'});
 const q=(url.searchParams.get('q')||'').trim().slice(0,120);
 const limit=Math.min(100,Math.max(10,Number.parseInt(url.searchParams.get('limit')||'25',10)||25));
 const page=Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1);
 const offset=(page-1)*limit;
 const filters=[];
 const values=[s.organization_id,type];
 const add=(sql,value)=>{values.push(value);filters.push(sql.replace('?', '$'+values.length));};
 const status=url.searchParams.get('status'); if(status)add("data->>'status' = ?",status);
 const stage=url.searchParams.get('stage'); if(stage)add("data->>'stage' = ?",stage);
 const owner=url.searchParams.get('owner'); if(owner==='Unassigned'){filters.push("((data->>'owner_id' IS NULL OR data->>'owner_id'='') AND (data->>'owner' IS NULL OR data->>'owner'='' OR data->>'owner'='Unassigned'))");}else if(owner){values.push(owner);filters.push("(data->>'owner_id' = $"+values.length+" OR (data->>'owner_id' IS NULL AND data->>'owner' = $"+values.length+"))");}
 const activityType=url.searchParams.get('activity_type'); if(activityType)add("data->>'type' = ?",activityType);
 if(q)add("search_vector @@ plainto_tsquery('simple', ?)",q);
 const where=filters.length?' AND '+filters.join(' AND '):'';
 const count=await pool.query('SELECT count(*)::int AS total FROM crm.records WHERE organization_id=$1 AND record_type=$2'+where,values);
 const sortMap={created_at:'created_at',updated_at:'updated_at',name:"(data->>'name')",subject:"(data->>'subject')",company:"(data->>'company')",email:"(data->>'email')",phone:"(data->>'phone')",customer:"(data->>'customer')",stage:"(data->>'stage')",status:"(data->>'status')",owner:"(data->>'owner')",value:"NULLIF(data->>'value','')::numeric"};
 const sort=sortMap[url.searchParams.get('sort')]||'created_at';
 const direction=url.searchParams.get('direction')==='asc'?'ASC':'DESC';
 const rows=await pool.query('SELECT id,record_type,data,created_at,updated_at FROM crm.records WHERE organization_id=$1 AND record_type=$2'+where+' ORDER BY '+sort+' '+direction+' NULLS LAST LIMIT $'+(values.length+1)+' OFFSET $'+(values.length+2),[...values,limit,offset]);
 const total=count.rows[0].total;
 send(res,200,{data:rows.rows,pagination:{page,limit,total,total_pages:Math.ceil(total/limit)}});
}
async function logEvent(db,{organizationId,recordId,recordType,eventType,summary,payload={},actorId}){
 await db.query('INSERT INTO crm.activity_events(organization_id,record_id,record_type,event_type,summary,payload,actor_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)',[organizationId,recordId,recordType,eventType,summary,JSON.stringify(payload),actorId||null]);
}
function validateActivityPlan(data){
 if(String(data.active||'Yes').toLowerCase()!=='no'){
  if(!Array.isArray(data.steps)||data.steps.length<1||data.steps.length>20)throw Object.assign(new Error('Activity Plan aktif wajib memiliki 1–20 langkah follow-up.'),{status:422});
  for(const [i,step] of data.steps.entries()){
   if(!step||typeof step!=='object'||!String(step.subject||'').trim()||String(step.subject).length>200)throw Object.assign(new Error('Subject langkah ke-'+(i+1)+' wajib diisi (maksimal 200 karakter).'),{status:422});
   const delay=Number(step.delay_days);if(!Number.isInteger(delay)||delay<0||delay>365)throw Object.assign(new Error('Delay langkah ke-'+(i+1)+' harus 0–365 hari.'),{status:422});
   if(!['Call','Meeting','Email','Task'].includes(String(step.type||'Call')))throw Object.assign(new Error('Tipe aktivitas langkah ke-'+(i+1)+' tidak valid.'),{status:422});
  }
 }
}
async function executeActivityPlans(client,{organizationId,sourceId,sourceType,triggerKey,sourceData,actorId}){
 const plans=await client.query("SELECT id,data FROM crm.records WHERE organization_id=$1 AND record_type='activity_plans' AND lower(COALESCE(data->>'active','yes')) IN ('yes','true','1') AND data->>'trigger'=$2",[organizationId,triggerKey]);
 let created=0;
 for(const plan of plans.rows){
  const steps=Array.isArray(plan.data?.steps)?plan.data.steps:[];
  if(!steps.length)continue;
  const run=await client.query("INSERT INTO crm.activity_plan_runs(organization_id,plan_id,source_record_id,trigger_key) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",[organizationId,plan.id,sourceId,triggerKey]);
  if(!run.rowCount)continue;
  for(let i=0;i<steps.length;i++){
   const step=steps[i],delay=Math.max(0,Math.min(365,Number(step.delay_days)||0));
   const due=new Date();due.setUTCDate(due.getUTCDate()+delay);
   const dueDate=due.toISOString().slice(0,10);
   const subject=String(step.subject||'').trim();
   if(!subject)continue;
   const activityData={subject,type:String(step.type||'Call'),description:String(step.description||''),related_to:String(sourceData.name||sourceData.company||sourceData.subject||sourceType),related_to_id:sourceId,related_to_type:sourceType,source_plan_id:plan.id,plan_run_id:run.rows[0].id,plan_step_index:i,due_date:dueDate,status:'Planned',owner:sourceData.owner||'',owner_id:sourceData.owner_id||''};
   const activity=await client.query("INSERT INTO crm.records(organization_id,record_type,data,created_by,updated_by) VALUES($1,'activities',$2::jsonb,$3,$3) RETURNING id",[organizationId,JSON.stringify(activityData),actorId]);
   await logEvent(client,{organizationId,recordId:activity.rows[0].id,recordType:'activities',eventType:'planned',summary:'Follow-up dibuat dari Activity Plan: '+subject,payload:{plan_id:plan.id,source_record_id:sourceId,trigger:triggerKey,due_date:dueDate},actorId});
   created++;
  }
 }
 if(created)await logEvent(client,{organizationId,recordId:sourceId,recordType:sourceType,eventType:'follow_ups_generated',summary:created+' follow-up dibuat otomatis dari Activity Plan',payload:{trigger:triggerKey,count:created},actorId});
 return created;
}
async function validateOpportunityLifecycle(client,data,organizationId){
 const stage=String(data.stage||'').trim();
 if(stage==='Lost'&&!data.lost_reason_id)throw Object.assign(new Error('Lost Reason wajib dipilih saat Opportunity berstatus Lost.'),{status:422});
 if(stage==='Won')data.probability=100;
 else if(stage==='Lost')data.probability=0;
 else if(data.probability!==undefined&&(!Number.isFinite(Number(data.probability))||Number(data.probability)<0||Number(data.probability)>100))throw Object.assign(new Error('Probability harus berada di antara 0 sampai 100.'),{status:422});
 if(data.stage_id){
  const q=await client.query("SELECT data->>'name' AS name,data->>'probability' AS probability FROM crm.records WHERE id=$1 AND organization_id=$2 AND record_type='pipeline_stages'",[data.stage_id,organizationId]);
  if(!q.rowCount)throw Object.assign(new Error('Pipeline Stage tidak valid.'),{status:422});
  if(stage&&q.rows[0].name!==stage)throw Object.assign(new Error('Stage dan Pipeline Stage ID tidak sesuai.'),{status:422});
  if(!['Won','Lost'].includes(stage)&&q.rows[0].probability!==null)data.probability=Number(q.rows[0].probability)||0;
 }
}
async function readTimeline(req,res,s,url){
 const id=url.searchParams.get('record_id')||'';
 if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:'record_id tidak valid.'});
 // Events remain tenant-scoped and readable even after the source record is deleted.
 const r=await pool.query('SELECT e.id,e.record_type,e.event_type,e.summary,e.payload,e.created_at,u.full_name AS actor_name FROM crm.activity_events e LEFT JOIN core.users u ON u.id=e.actor_id WHERE e.organization_id=$1 AND e.record_id=$2 ORDER BY e.created_at DESC LIMIT 100',[s.organization_id,id]);
 send(res,200,{data:r.rows});
}
async function convertLead(req,res,s,leadId){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const leadResult=await client.query("SELECT id,data FROM crm.records WHERE id=$1 AND organization_id=$2 AND record_type='leads' FOR UPDATE",[leadId,s.organization_id]);
  if(!leadResult.rowCount){await client.query('ROLLBACK');return send(res,404,{error:'Lead tidak ditemukan.'});}
  const lead=leadResult.rows[0],data=lead.data||{};
  if(data.status==='Converted'||data.converted_customer_id){await client.query('ROLLBACK');return send(res,409,{error:'Lead sudah pernah dikonversi.'});}
  const customerName=String(data.company||data.name||'').trim();
  if(!customerName){await client.query('ROLLBACK');return send(res,422,{error:'Nama perusahaan atau lead wajib tersedia.'});}
  const normalizedEmail=String(data.email||'').trim().toLowerCase();
  if(normalizedEmail){
   const duplicate=await client.query(\"SELECT id,data->>'name' AS name FROM crm.records WHERE organization_id=$1 AND record_type='customers' AND lower(btrim(data->>'email'))= $2 ORDER BY created_at ASC LIMIT 1\",[s.organization_id,normalizedEmail]);
   if(duplicate.rowCount){await client.query('ROLLBACK');return send(res,409,{error:'Customer dengan email yang sama sudah terdaftar. Periksa Customer tersebut sebelum melanjutkan konversi.',existing_customer:{id:duplicate.rows[0].id,name:duplicate.rows[0].name||'Unnamed Customer'}});}
  }
  const customerData={name:customerName,type:'Company',email:data.email||'',phone:data.phone||'',category:'',group:'',website:''};
  const customer=await client.query("INSERT INTO crm.records(organization_id,record_type,data,created_by,updated_by) VALUES($1,'customers',$2::jsonb,$3,$3) RETURNING id,data",[s.organization_id,JSON.stringify(customerData),s.id]);
  let contact=null;
  if(data.name||data.email||data.phone){
   const contactData={name:String(data.name||customerName).trim(),company:customerName,company_id:customer.rows[0].id,job_title:'',email:data.email||'',phone:data.phone||'',owner:data.owner||'',owner_id:data.owner_id||''};
   contact=await client.query("INSERT INTO crm.records(organization_id,record_type,data,created_by,updated_by) VALUES($1,'contacts',$2::jsonb,$3,$3) RETURNING id,data",[s.organization_id,JSON.stringify(contactData),s.id]);
  }
  const converted={...data,status:'Converted',converted_customer_id:customer.rows[0].id,converted_contact_id:contact?.rows[0]?.id||null,converted_at:new Date().toISOString(),converted_by:s.id};
  await client.query("UPDATE crm.records SET data=$1::jsonb,updated_by=$2,updated_at=now() WHERE id=$3 AND organization_id=$4",[JSON.stringify(converted),s.id,leadId,s.organization_id]);
  await logEvent(client,{organizationId:s.organization_id,recordId:leadId,recordType:'leads',eventType:'converted',summary:'Lead dikonversi menjadi Customer dan Contact',payload:{customer_id:customer.rows[0].id,contact_id:contact?.rows[0]?.id||null},actorId:s.id});
  await logEvent(client,{organizationId:s.organization_id,recordId:customer.rows[0].id,recordType:'customers',eventType:'created_from_lead',summary:'Customer dibuat dari Lead',payload:{lead_id:leadId},actorId:s.id});
  if(contact)await logEvent(client,{organizationId:s.organization_id,recordId:contact.rows[0].id,recordType:'contacts',eventType:'created_from_lead',summary:'Contact dibuat dari Lead',payload:{lead_id:leadId},actorId:s.id});
  await client.query('COMMIT');
  return send(res,200,{data:{lead_id:leadId,customer_id:customer.rows[0].id,contact_id:contact?.rows[0]?.id||null}});
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
export async function handleCrmApi(req,res,pathname){
 if(!pathname.startsWith('/api/crm/'))return false;
 const url=new URL(req.url,'http://orva.local');
 if(pathname==='/api/crm/health'&&req.method==='GET'){try{await pool.query('SELECT 1');send(res,200,{status:'ok',module:'crm',database:'connected'});}catch{send(res,503,{error:'Database unavailable'});}return true;}
 const conversion=pathname.match(/^\/api\/crm\/leads\/([0-9a-f-]{36})\/convert$/i);
 if(conversion&&req.method==='POST'){const s=await session(req);if(!s){send(res,401,{error:'Authentication required'});return true;}try{await convertLead(req,res,s,conversion[1]);}catch(e){console.error('CRM lead conversion:',e);send(res,500,{error:'Lead conversion failed'});}return true;}
 if(pathname==='/api/crm/timeline'&&req.method==='GET'){const s=await session(req);if(!s){send(res,401,{error:'Authentication required'});return true;}try{await readTimeline(req,res,s,url);}catch(e){console.error('CRM timeline API:',e);send(res,500,{error:'Unable to load activity timeline'});}return true;}
 if(pathname==='/api/crm/options'&&req.method==='GET'){const s=await session(req);if(!s){send(res,401,{error:'Authentication required'});return true;}try{await readOptions(req,res,s,url);}catch(e){console.error('CRM options API:',e);send(res,500,{error:'Unable to load lookup options'});}return true;}
 if(pathname==='/api/crm/records'){
  const s=await session(req);if(!s){send(res,401,{error:'Authentication required'});return true;}
  try{
   if(req.method==='GET'){await readRecords(req,res,s,url);return true;}
   if(req.method==='POST'){
    const b=await body(req),type=b.entity,data=b.data;
    if(!TYPES.has(type)||!data||typeof data!=='object'||Array.isArray(data))return send(res,422,{error:'Invalid record'});
    const name=String(data.name||data.subject||'').trim();if(!name||name.length>200)return send(res,422,{error:'Name/subject is required (max 200)'});
    if(type==='activity_plans')validateActivityPlan(data);
    await validateLookups(type,data,s.organization_id);
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     if(type==='opportunities')await validateOpportunityLifecycle(client,data,s.organization_id);
     const r=await client.query('INSERT INTO crm.records(organization_id,record_type,data,created_by,updated_by) VALUES($1,$2,$3::jsonb,$4,$4) RETURNING id,record_type,data,created_at,updated_at',[s.organization_id,type,JSON.stringify(data),s.id]);
     await logEvent(client,{organizationId:s.organization_id,recordId:r.rows[0].id,recordType:type,eventType:'created',summary:(type==='activities'?'Aktivitas dibuat: ':'Record dibuat: ')+name,payload:{},actorId:s.id});
     if(type==='leads')await executeActivityPlans(client,{organizationId:s.organization_id,sourceId:r.rows[0].id,sourceType:'leads',triggerKey:'Lead Created',sourceData:data,actorId:s.id});
     if(type==='opportunities')await executeActivityPlans(client,{organizationId:s.organization_id,sourceId:r.rows[0].id,sourceType:'opportunities',triggerKey:'Opportunity Created',sourceData:data,actorId:s.id});
     await client.query('COMMIT');send(res,201,{data:r.rows[0]});return true;
    }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
   }
  }catch(e){send(res,e.status||500,{error:e.status?e.message:'CRM request failed'});if(!e.status)console.error('CRM records API:',e);return true;}
 }
 const m=pathname.match(/^\/api\/crm\/records\/([0-9a-f-]{36})$/i);
 if(m&&['PUT','DELETE'].includes(req.method)){
  const s=await session(req);if(!s){send(res,401,{error:'Authentication required'});return true;}
  try{if(req.method==='DELETE'){const r=await pool.query('DELETE FROM crm.records WHERE id=$1 AND organization_id=$2 RETURNING id,record_type,data');if(!r.rowCount)return send(res,404,{error:'Record not found'});await logEvent(pool,{organizationId:s.organization_id,recordId:r.rows[0].id,recordType:r.rows[0].record_type,eventType:'deleted',summary:'Record dihapus: '+String(r.rows[0].data?.name||r.rows[0].data?.subject||r.rows[0].record_type),payload:{},actorId:s.id}).catch(e=>console.error('CRM audit event write failed:',e));send(res,200,{ok:true});return true;}
   const b=await body(req),data=b.data;if(!data||typeof data!=='object'||Array.isArray(data))return send(res,422,{error:'Invalid record'});
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const before=await client.query('SELECT record_type,data FROM crm.records WHERE id=$1 AND organization_id=$2 FOR UPDATE',[m[1],s.organization_id]);
    if(!before.rowCount){await client.query('ROLLBACK');return send(res,404,{error:'Record not found'});}
    const type=before.rows[0].record_type,name=String(data.name||data.subject||'').trim();if(!name||name.length>200)throw Object.assign(new Error('Name/subject is required (max 200)'),{status:422});
    if(type==='activity_plans')validateActivityPlan(data);
    await validateLookups(type,data,s.organization_id);
    if(type==='opportunities')await validateOpportunityLifecycle(client,data,s.organization_id);
    const r=await client.query('UPDATE crm.records SET data=$1::jsonb,updated_by=$2,updated_at=now() WHERE id=$3 AND organization_id=$4 RETURNING id,record_type,data,created_at,updated_at',[JSON.stringify(data),s.id,m[1],s.organization_id]);
    await logEvent(client,{organizationId:s.organization_id,recordId:r.rows[0].id,recordType:type,eventType:'updated',summary:'Record diperbarui: '+String(data.name||data.subject||type),payload:{},actorId:s.id});
    const oldData=before.rows[0].data||{};
    if(type==='leads'&&oldData.status!=='Qualified'&&data.status==='Qualified')await executeActivityPlans(client,{organizationId:s.organization_id,sourceId:m[1],sourceType:'leads',triggerKey:'Lead Qualified',sourceData:data,actorId:s.id});
    if(type==='opportunities'&&oldData.stage!==data.stage)await executeActivityPlans(client,{organizationId:s.organization_id,sourceId:m[1],sourceType:'opportunities',triggerKey:'Stage Changed',sourceData:data,actorId:s.id});
    await client.query('COMMIT');send(res,200,{data:r.rows[0]});return true;
   }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
  }catch(e){send(res,e.status||500,{error:e.status?e.message:'CRM request failed'});if(!e.status)console.error('CRM records API:',e);return true;}
 }
 if(pathname==='/api/crm/leads'&&['GET','POST'].includes(req.method)){send(res,410,{error:'Use /api/crm/records?entity=leads'});return true;}
 send(res,404,{error:'Endpoint not found'});return true;
}
export async function closeCrmPool(){await pool.end();}
