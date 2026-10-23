import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const file=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(file),'..');
const data=path.join(root,'data'),stateFile=path.join(data,'public-demo.json');
await fsp.mkdir(data,{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const readState=async()=>{try{return JSON.parse(await fsp.readFile(stateFile,'utf8'));}catch{return null;}};
async function control(state,action='status') {
  if(!state?.controlPort || !state?.controlToken)return null;
  try {const response=await fetch(`http://127.0.0.1:${state.controlPort}/${action}`,{method:action==='stop'?'POST':'GET',headers:{'X-Demo-Control':state.controlToken},signal:AbortSignal.timeout(2500)});return response.ok?await response.json():null;}catch{return null;}
}
async function freePort() {
  const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
async function run() {
  const linuxBinary=path.join(root,'tools/cloudflared/cloudflared');
  const binary=fs.existsSync(linuxBinary)?linuxBinary:path.join(root,'tools/bin/cloudflared.exe');
  if(!fs.existsSync(binary))throw new Error('Run tools/fetch-cloudflared.py first.');
  if(fs.existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
  const port=await freePort(),controlToken=randomBytes(32).toString('hex');
  let state={status:'starting',url:null,port,controllerPid:process.pid,controlPort:null,controlToken,startedAt:new Date().toISOString()};
  let tunnel,backend,stopping=false;
  const save=()=>fsp.writeFile(stateFile,JSON.stringify(state,null,2));
  async function shutdown(reason='stopped',failed=false) {
    if(stopping)return;stopping=true;
    state={...state,status:failed?'error':'stopped',reason,stoppedAt:new Date().toISOString()};await save();
    tunnel?.kill();backend?.kill();
    controlServer.close(()=>process.exit(failed?1:0));
    setTimeout(()=>process.exit(failed?1:0),2500).unref();
  }
  const controlServer=http.createServer((req,res)=>{
    const given=Buffer.from(String(req.headers['x-demo-control'] || '')),expected=Buffer.from(controlToken);
    if(given.length!==expected.length || !timingSafeEqual(given,expected)){res.writeHead(403);res.end();return;}
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(req.method==='POST' && req.url==='/stop'){res.end(JSON.stringify({ok:true}));void shutdown();return;}
    if(req.method==='GET' && req.url==='/status'){res.end(JSON.stringify({status:state.status,url:state.url,port:state.port}));return;}
    res.writeHead(404);res.end('{}');
  });
  await new Promise((resolve,reject)=>{controlServer.once('error',reject);controlServer.listen(0,'127.0.0.1',resolve);});
  state.controlPort=controlServer.address().port;await save();
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void shutdown());
  const log=fs.createWriteStream(path.join(data,'cloudflared.log'),{flags:'a'});
  let buffer='';
  try {
    const url=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Tunnel URL timed out. Check data/cloudflared.log.')),90000);
      tunnel=spawn(binary,['tunnel','--no-autoupdate','--protocol','http2','--edge-ip-version','4','--url',`http://127.0.0.1:${port}`],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
      const collect=chunk=>{log.write(chunk);buffer=(buffer+chunk.toString()).slice(-12000);const match=buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(match){clearTimeout(timeout);resolve(match[0]);}};
      tunnel.stdout.on('data',collect);tunnel.stderr.on('data',collect);
      tunnel.once('error',e=>{clearTimeout(timeout);reject(e);});
      tunnel.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Tunnel stopped (${code}).`));if(!stopping)void shutdown('Tunnel disconnected',true);});
    });
    if(stopping)return;
    state={...state,url,tunnelPid:tunnel.pid};await save();
    const out=fs.openSync(path.join(data,'public-server.log'),'a'),err=fs.openSync(path.join(data,'public-server-error.log'),'a');
    backend=spawn(process.execPath,['server/main.mjs'],{cwd:root,windowsHide:true,stdio:['ignore',out,err],env:{...process.env,HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:url,TRUST_CLOUDFLARE_PROXY:'1',LLM_MAX_CALLS_PER_24H:process.env.PUBLIC_DEMO_LLM_MAX_CALLS || '100'}});
    fs.closeSync(out);fs.closeSync(err);
    backend.once('error',e=>void shutdown(e.message,true));backend.once('exit',code=>{if(!stopping)void shutdown(`Public backend stopped (${code})`,true);});
    for(let attempt=0;attempt<50;attempt++) {
      if(stopping)return;
      try {const response=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1000)});const health=await response.json();if(response.ok && health.publicOrigin===url){state={...state,status:'running',backendPid:backend.pid};await save();console.log(JSON.stringify({status:'running',url}));return;}}catch{}
      await delay(200);
    }
    throw new Error('Public backend did not start. Check data/public-server-error.log.');
  } catch(e){await shutdown(e.message,true);}
}

const mode=process.argv[2] || 'start';
if(mode==='run')await run();
else if(mode==='stop') {
  const result=await control(await readState(),'stop');console.log(result?'Public demo stopped.':'No running public demo controller found.');
} else if(mode==='status') {
  const result=await control(await readState());console.log(JSON.stringify(result || {status:'stopped'}));
} else if(mode==='start') {
  const current=await control(await readState());
  if(current?.status==='running')console.log(JSON.stringify(current));
  else {
    if(!current) {
      const out=fs.openSync(path.join(data,'public-demo-controller.log'),'a');
      const child=spawn(process.execPath,[file,'run'],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,out]});child.unref();fs.closeSync(out);
    }
    let ready=false;
    for(let attempt=0;attempt<100;attempt++) {
      await delay(1000);const state=await readState(),active=await control(state);
      if(active?.status==='running'){console.log(JSON.stringify(active));ready=true;break;}
      if(state?.status==='error'){console.error(state.reason);process.exitCode=1;ready=true;break;}
    }
    if(!ready){console.error('Public demo is not ready. Inspect data/public-demo-controller.log and data/cloudflared.log.');process.exitCode=1;}
  }
} else throw new Error('Use start, stop or status.');
