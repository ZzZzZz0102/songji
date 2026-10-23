import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplication} from '../server/app.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const trustCloudflare of [false,true])test(`forwarded client IP is ${trustCloudflare?'accepted from explicit loopback proxy':'ignored by default'}`,async()=>{
  const dir=await fs.mkdtemp(path.join(root,'data','proxy-test-')),app=createApplication({root,dataDir:dir,trustCloudflare});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const login=ip=>fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Songgai-Request':'1','CF-Connecting-IP':ip},body:JSON.stringify({username:'nonexistent_test',password:'invalid-password-for-test'})});
  try {
    for(let i=0;i<20;i++){const r=await login('203.0.113.10');assert.equal(r.status,401);await r.arrayBuffer();}
    const blocked=await login('203.0.113.10');assert.equal(blocked.status,429);await blocked.arrayBuffer();
    const other=await login('198.51.100.11');assert.equal(other.status,trustCloudflare?401:429);await other.arrayBuffer();
  } finally {await app.close();await fs.rm(dir,{recursive:true,force:true});}
});
