import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let worker=null,pending=[],stdoutBuf='',waiting=false;

function ensureWorker() {
  if(worker)return;
  worker=spawn('python3',[path.join(root,'tools/transcribe_server.py')],{stdio:['pipe','pipe','pipe']});
  worker.stderr.on('data',()=>{/* 转写引擎日志 */});
  worker.stdout.on('data',chunk=>{
    stdoutBuf+=chunk.toString();
    let nl;
    while((nl=stdoutBuf.indexOf('\n'))>=0){
      const line=stdoutBuf.slice(0,nl).trim();stdoutBuf=stdoutBuf.slice(nl+1);
      const job=pending.shift();
      if(job){
        try{const v=JSON.parse(line);if(v.error)job.reject(new Error(v.error));else job.resolve(v.text||'');}
        catch{job.reject(new Error('转写服务返回异常'));}
      }
      waiting=false;
    }
  });
  worker.on('exit',()=>{worker=null;const rest=pending.splice(0);for(const j of rest)j.reject(new Error('转写服务已退出'));});
  worker.on('error',()=>{worker=null;const rest=pending.splice(0);for(const j of rest)j.reject(new Error('无法启动转写服务'));});
}

export function transcribe(audioPath) {
  return new Promise((resolve,reject)=>{
    ensureWorker();
    const timer=setTimeout(()=>{const i=pending.indexOf(job);if(i>=0)pending.splice(i,1);reject(new Error('语音转写超时，请重试'));},120000);
    const job={audioPath,resolve:(t)=>{clearTimeout(timer);resolve(t);},reject:(e)=>{clearTimeout(timer);reject(e);}};
    pending.push(job);
    worker.stdin.write(audioPath+'\n');
  });
}
