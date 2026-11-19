import { createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { verifyAccessToken } from './auth.mjs';
const scrypt=promisify(scryptCallback), COOKIE='orva_session';
const pool=new Pool({host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'orva',user:process.env.PGUSER||'orva_app',password:process.env.PGPASSWORD_B64?Buffer.from(process.env.PGPASSWORD_B64,'base64').toString('utf8'):process.env.PGPASSWORD,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000,application_name:'orva-identity'});
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x.length===2).map(([k,v])=>[k,decodeURIComponent(v)]));}
function tokenFrom(req){return (req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1]||cookies(req)[COOKIE];}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>16384)throw Object.assign(new Error('Payload too large'),{status:413});}try{return JSON.parse(s);}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}}
async function verifyPassword(password,encoded){const [kind,n,r,p,salt,hash]=String(encoded).split('$');if(kind!=='scrypt'||!salt||!hash)return false;const key=await scrypt(password,salt,64,{N:Number(n),r:Number(r),p:Number(p),maxmem:64*1024*1024});const a=Buffer.from(hash,'hex'),b=Buffer.from(key);return a.length===b.length&&timingSafeEqual(a,b);}
function issueToken(claims){const secret=process.env.ORVA_AUTH_SECRET;if(!secret)throw new Error('Missing auth secret');const now=Math.floor(Date.now()/1000),h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({...claims,iat:now,exp:now+28800,iss:'orva'})).toString('base64url'),sig=createHmac('sha256',secret).update(h+'.'+p).digest('base64url');return h+'.'+p+'.'+sig;}
function setCookie(res,value){res.setHeader('Set-Cookie',COOKIE+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800');}
function clearCookie(res){res.setHeader('Set-Cookie',COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');}
const attempts=new Map();
function limited(req){const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim(),now=Date.now(),v=attempts.get(ip)||{count:0,until:now+60000};if(now>v.until){v.count=0;v.until=now+60000;}v.count++;attempts.set(ip,v);if(attempts.size>3000)for(const [k,x] of attempts)if(now>x.until)attempts.delete(k);return v.count>10;}
export async function handleIdentityApi(req,res,pathname){
 if(!pathname.startsWith('/api/auth/'))return false;
 try{
  if(pathname==='/api/auth/login'&&req.method==='POST'){
   if(limited(req)){send(res,429,{error:'Terlalu banyak percobaan login. Coba lagi satu menit.'});return true;}
   const b=await body(req),email=typeof b.email==='string'?b.email.trim().toLowerCase():'',password=typeof b.password==='string'?b.password:'';
   if(!email||email.length>254||!password||password.length>1024){send(res,422,{error:'Email dan password wajib diisi.'});return true;}
   const q=await pool.query(`SELECT u.id,u.email,u.full_name,u.password_hash,u.status AS user_status,u.is_platform_owner,m.organization_id,m.role,o.name AS organization_name,o.status AS organization_status FROM core.users u JOIN core.memberships m ON m.user_id=u.id JOIN core.organizations o ON o.id=m.organization_id WHERE u.email=$1 AND m.status='active' AND o.status='active' LIMIT 1`,[email]);
   const u=q.rows[0],ok=!!u&&u.user_status==='active'&&await verifyPassword(password,u.password_hash);
   if(!ok){send(res,401,{error:'Email atau password tidak valid.'});return true;}
   const access=await pool.query(\`SELECT mod.module_key FROM core.modules mod JOIN core.organization_modules om ON om.module_key=mod.module_key AND om.organization_id=$1 AND om.enabled=true LEFT JOIN core.user_module_access a ON a.module_key=mod.module_key AND a.organization_id=$1 AND a.user_id=$2 WHERE mod.status='available' AND ($3=true OR COALESCE(a.can_access,false)=true)\`,[u.organization_id,u.id,u.is_platform_owner]);\n   const permissions=u.is_platform_owner?['orva:owner','*']:['workspace:read',...access.rows.filter(x=>x.module_key==='crm').map(()=> 'crm:*')];\n   setCookie(res,issueToken({sub:u.id,organization_id:u.organization_id,permissions,role:u.role,is_platform_owner:u.is_platform_owner}));
   send(res,200,{user:{id:u.id,email:u.email,full_name:u.full_name,role:u.role,is_platform_owner:u.is_platform_owner},organization:{id:u.organization_id,name:u.organization_name}});return true;
  }
  if(pathname==='/api/auth/logout'&&req.method==='POST'){clearCookie(res);send(res,200,{ok:true});return true;}
  if(pathname==='/api/auth/me'&&req.method==='GET'){
   const t=tokenFrom(req);if(!t){send(res,401,{error:'Authentication required'});return true;}
   let c;try{c=verifyAccessToken(t,process.env.ORVA_AUTH_SECRET);}catch{clearCookie(res);send(res,401,{error:'Session expired'});return true;}
   const q=await pool.query(`SELECT u.id,u.email,u.full_name,u.is_platform_owner,m.role,m.organization_id,o.name AS organization_name FROM core.users u JOIN core.memberships m ON m.user_id=u.id JOIN core.organizations o ON o.id=m.organization_id WHERE u.id=$1 AND m.organization_id=$2 AND u.status='active' AND m.status='active' AND o.status='active' LIMIT 1`,[c.sub,c.organization_id]);
   if(!q.rowCount){clearCookie(res);send(res,401,{error:'Account inactive'});return true;}
   const u=q.rows[0],mods=await pool.query(`SELECT x.module_key,x.name,x.description,x.route,x.status FROM core.modules x JOIN core.organization_modules om ON om.module_key=x.module_key AND om.organization_id=$1 AND om.enabled=true LEFT JOIN core.user_module_access a ON a.module_key=x.module_key AND a.organization_id=$1 AND a.user_id=$2 WHERE x.status='available' AND ($3=true OR COALESCE(a.can_access,false)=true) ORDER BY x.name`,[u.organization_id,u.id,u.is_platform_owner]);
   send(res,200,{user:{id:u.id,email:u.email,full_name:u.full_name,role:u.role,is_platform_owner:u.is_platform_owner},organization:{id:u.organization_id,name:u.organization_name},modules:mods.rows});return true;
  }
  send(res,404,{error:'Endpoint not found'});return true;
 }catch(e){if(e.status){send(res,e.status,{error:e.message});return true;}console.error('ORVA Identity API error:',e);send(res,500,{error:'Internal server error'});return true;}
}
