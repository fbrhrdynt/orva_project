import { Pool } from 'pg';
import { verifyAccessToken } from './auth.mjs';

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'orva', user: process.env.PGUSER || 'orva_app',
  password: process.env.PGPASSWORD_B64 ? Buffer.from(process.env.PGPASSWORD_B64,'base64').toString('utf8') : process.env.PGPASSWORD,
  max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, application_name: 'orva-crm-api'
});
const TYPES = new Set(['leads','customers','contacts','opportunities','activities','lead_sources','pipeline_stages','activity_types','lost_reasons','sales_teams']);
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
 const recordRelations={source_id:['lead_sources'],company_id:['customers'],customer_id:['customers'],stage_id:['pipeline_stages'],type_id:['activity_types']};
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
export async function handleCrmApi(req,res,pathname){
 if(!pathname.startsWith('/api/crm/'))return false;
 const url=new URL(req.url,'http://orva.local');
 if(pathname==='/api/crm/health'&&req.method==='GET'){try{await pool.query('SELECT 1');send(res,200,{status:'ok',module:'crm',database:'connected'});}catch{send(res,503,{error:'Database unavailable'});}return true;}
 if(pathname==='/api/crm/options'&&req.method==='GET'){const s=await session(req);if(!s){send(res,401,{error:'Authentication required'});return true;}try{await readOptions(req,res,s,url);}catch(e){console.error('CRM options API:',e);send(res,500,{error:'Unable to load lookup options'});}return true;}
 if(pathname==='/api/crm/records'){
  const s=await session(req);if(!s){send(res,401,{error:'Authentication required'});return true;}
  try{
   if(req.method==='GET'){await readRecords(req,res,s,url);return true;}
   if(req.method==='POST'){const b=await body(req),type=b.entity,data=b.data;if(!TYPES.has(type)||!data||typeof data!=='object'||Array.isArray(data))return send(res,422,{error:'Invalid record'});const name=String(data.name||data.subject||'').trim();if(!name||name.length>200)return send(res,422,{error:'Name/subject is required (max 200)'});await validateLookups(type,data,s.organization_id);const r=await pool.query('INSERT INTO crm.records(organization_id,record_type,data,created_by,updated_by) VALUES($1,$2,$3::jsonb,$4,$4) RETURNING id,record_type,data,created_at,updated_at',[s.organization_id,type,JSON.stringify(data),s.id]);send(res,201,{data:r.rows[0]});return true;}
  }catch(e){send(res,e.status||500,{error:e.status?e.message:'CRM request failed'});if(!e.status)console.error('CRM records API:',e);return true;}
 }
 const m=pathname.match(/^\/api\/crm\/records\/([0-9a-f-]{36})$/i);
 if(m&&['PUT','DELETE'].includes(req.method)){
  const s=await session(req);if(!s){send(res,401,{error:'Authentication required'});return true;}
  try{if(req.method==='DELETE'){const r=await pool.query('DELETE FROM crm.records WHERE id=$1 AND organization_id=$2 RETURNING id',[m[1],s.organization_id]);if(!r.rowCount)return send(res,404,{error:'Record not found'});send(res,200,{ok:true});return true;}
   const b=await body(req),data=b.data;if(!data||typeof data!=='object'||Array.isArray(data))return send(res,422,{error:'Invalid record'});const name=String(data.name||data.subject||'').trim();if(!name||name.length>200)return send(res,422,{error:'Name/subject is required (max 200)'});await validateLookups((await pool.query('SELECT record_type FROM crm.records WHERE id=$1 AND organization_id=$2',[m[1],s.organization_id])).rows[0]?.record_type,data,s.organization_id);const r=await pool.query('UPDATE crm.records SET data=$1::jsonb,updated_by=$2,updated_at=now() WHERE id=$3 AND organization_id=$4 RETURNING id,record_type,data,created_at,updated_at',[JSON.stringify(data),s.id,m[1],s.organization_id]);if(!r.rowCount)return send(res,404,{error:'Record not found'});send(res,200,{data:r.rows[0]});return true;
  }catch(e){send(res,e.status||500,{error:e.status?e.message:'CRM request failed'});if(!e.status)console.error('CRM records API:',e);return true;}
 }
 if(pathname==='/api/crm/leads'&&['GET','POST'].includes(req.method)){send(res,410,{error:'Use /api/crm/records?entity=leads'});return true;}
 send(res,404,{error:'Endpoint not found'});return true;
}
export async function closeCrmPool(){await pool.end();}
