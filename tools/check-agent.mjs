import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplication} from '../server/app.mjs';
import {hashPassword} from '../server/security.mjs';
import {id,now} from '../server/database.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(fs.existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
if(!process.env.LLM_API_KEY || !process.env.LLM_MODEL || !process.env.LLM_BASE_URL)throw new Error('Configure the server LLM environment first.');
const dir=await fsp.mkdtemp(path.join(root,'data','agent-check-'));
const app=createApplication({root,dataDir:dir,llmBase:process.env.LLM_BASE_URL,llmKey:process.env.LLM_API_KEY,llmModel:process.env.LLM_MODEL});
try {
  const password='agent-check-'+id();
  app.db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(id(),'agent_check','Isolated agent check',await hashPassword(password),'visitor',1,now());
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Songgai-Request':'1'},body:JSON.stringify({username:'agent_check',password})});
  if(!login.ok)throw new Error(`Login check failed (${login.status})`);
  const cookie=login.headers.get('set-cookie').split(';')[0],start=Date.now();
  const response=await fetch(base+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json','X-Songgai-Request':'1',Cookie:cookie},body:JSON.stringify({question:'油纸伞有哪些制作步骤？请说明资料来源。'})});
  const answer=await response.json();
  console.log(JSON.stringify({httpStatus:response.status,configuredModel:process.env.LLM_MODEL,mode:answer.mode,elapsedMs:Date.now()-start,answer:answer.answer,sources:answer.sources?.map(s=>({label:s.label,title:s.title,url:s.url})),warning:answer.warning},null,2));
  if(!response.ok || answer.mode!=='rag' || !answer.sources?.length)process.exitCode=1;
} finally {await app.close();await fsp.rm(dir,{recursive:true,force:true});}
