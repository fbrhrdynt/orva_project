'use strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'public');
const host=process.env.HOST||'127.0.0.1';
const port=Number.parseInt(process.env.PORT||'3100',10);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end('Method Not Allowed')}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end('Bad Request')}
 if(pathname!=='/'){res.writeHead(404);return res.end('Not Found')}
 const file=path.join(root,'index.html');fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not Found')}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache'});
 if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res)});
});
server.listen(port,host,()=>console.log('ORVA Platform listening on '+host+':'+port));
server.on('error',e=>{console.error('[FATAL]',e);process.exitCode=1});
