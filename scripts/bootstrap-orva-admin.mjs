#!/usr/bin/env node
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const require=createRequire(new URL('../apps/module/mod-crm/package.json',import.meta.url));
const {Pool}=require('pg'),scrypt=promisify(scryptCallback);
const pool=new Pool({host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'orva',user:process.env.PGUSER||'orva_app',password:process.env.PGPASSWORD_B64?Buffer.from(process.env.PGPASSWORD_B64,'base64').toString('utf8'):process.env.PGPASSWORD});
const rl=createInterface({input:stdin,output:stdout});
async function secret(prompt){stdout.write(prompt);stdin.setRawMode?.(true);let value='';for await(const chunk of stdin){for(const ch of chunk.toString()){if(ch==='\r'||ch==='\n'){stdin.setRawMode?.(false);stdout.write('\n');return value;}if(ch==='\u0003'){process.exit(130);}if(ch==='\u007f'||ch==='\b'){value=value.slice(0,-1);}else value+=ch;}}return value;}
try{
 const email=(await rl.question('Admin email: ')).trim().toLowerCase();
 const fullName=(await rl.question('Full name: ')).trim();
 const orgName=(await rl.question('Organization name [Febro Holdings]: ')).trim()||'Febro Holdings';
 const password=await secret('Password (minimum 14 characters): ');
 const confirm=await secret('Confirm password: ');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!fullName||fullName.length>160)throw new Error('Email atau nama tidak valid.');
 if(password.length<14||password!==confirm)throw new Error('Password minimal 14 karakter dan harus sama.');
 const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 const passwordHash='scrypt$16384$8$1$'+salt+'$'+Buffer.from(key).toString('hex');
 const slug=orgName.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)+'-'+createHash('sha256').update(email).digest('hex').slice(0,8);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const existing=await client.query('SELECT 1 FROM core.users WHERE email=$1',[email]);
  if(existing.rowCount)throw new Error('Email sudah terdaftar. Bootstrap dibatalkan tanpa mengubah akun.');
  const org=await client.query('INSERT INTO core.organizations(name,slug) VALUES($1,$2) RETURNING id',[orgName,slug]);
  const user=await client.query('INSERT INTO core.users(email,full_name,password_hash,is_platform_owner) VALUES($1,$2,$3,true) RETURNING id',[email,fullName,passwordHash]);
  await client.query("INSERT INTO core.memberships(user_id,organization_id,role) VALUES($1,$2,'platform_owner')",[user.rows[0].id,org.rows[0].id]);
  await client.query("INSERT INTO core.organization_modules(organization_id,module_key,enabled,granted_by) VALUES($1,'crm',true,$2)",[org.rows[0].id,user.rows[0].id]);
  await client.query('COMMIT');
  console.log('Bootstrap administrator berhasil dibuat. Simpan kredensial dengan aman.');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}catch(e){console.error('[ERROR]',e.message);process.exitCode=1;}finally{rl.close();await pool.end();}
