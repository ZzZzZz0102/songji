import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplication} from '../server/app.mjs';
import {hashPassword} from '../server/security.mjs';
import {id,now} from '../server/database.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let app,base,directory,admin,user,other,m1,m2,merchantId,offering;
const password='test-password-2026!';
async function request(route,{cookie,method='GET',body,headers={}}={}) {
  const response=await fetch(base+route,{method,headers:{'X-Songgai-Request':'1',...cookie?{Cookie:cookie}:{},...body && !(body instanceof Buffer)?{'Content-Type':'application/json'}:{},...headers},body:body instanceof Buffer?body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(username) {const v=await request('/api/login',{method:'POST',body:{username,password}});assert.equal(v.status,200);return v.cookie;}
async function register(username) {const v=await request('/api/register',{method:'POST',body:{username,password,displayName:username}});assert.equal(v.status,200);return v.cookie;}
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const book=(cookie,count=1,key=id(),offer=offering,slot='09:30')=>request('/api/bookings',{method:'POST',cookie,headers:{'Idempotency-Key':key},body:{offeringId:offer,date:today(),slot,count,note:''}});
async function status(cookie,b,change){return request(`/api/bookings/${b.id}/status`,{method:'POST',cookie,body:{status:change,version:b.version}});}
async function evidence(cookie=m1) {return request('/api/files',{method:'POST',cookie,body:Buffer.from('%PDF-1.4\nTEST ONLY receipt\n%%EOF'),headers:{'X-File-Name':'test-receipt.pdf'}});}
async function ledger(b,kind,cents,ref=id(),file) {return request('/api/ledger',{method:'POST',cookie:m1,body:{bookingId:b.id,kind,cents,beneficiary:'TEST supplier',reference:ref,evidenceId:file || (await evidence()).data.id}});}
async function review(lid,status='approved') {return request(`/api/ledger/${lid}/review`,{method:'POST',cookie:admin,body:{status,note:'TEST ONLY: document checked in isolated test database'}});}

before(async()=>{
  directory=await fs.mkdtemp(path.join(root,'data','songgai-test-'));
  app=createApplication({root,dataDir:directory,origin:'http://127.0.0.1:8787',test:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;
  const adminId=id();app.db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(adminId,'test_admin','TEST admin',await hashPassword(password),'admin',1,now());
  admin=await login('test_admin');user=await register('visitor_one');other=await register('visitor_two');
  for(const username of ['merchant_one','merchant_two']) {
    const created=await request('/api/admin/merchants',{method:'POST',cookie:admin,body:{username,password,name:`TEST ${username}`,location:'TEST receiving location',contact:'TEST public contact'}});assert.equal(created.status,201);
    if(username==='merchant_one')merchantId=created.data.id;
    const verified=await request(`/api/admin/merchants/${created.data.id}/verify`,{method:'POST',cookie:admin,body:{verified:true,basis:'TEST ONLY: isolated merchant fixture, not an actual partner'}});assert.equal(verified.status,200);
  }
  m1=await login('merchant_one');m2=await login('merchant_two');
  const offer=await request('/api/offerings',{method:'POST',cookie:m1,body:{pointId:'craft-umbrella',title:'TEST umbrella class',description:'TEST ONLY course for booking validation',priceCents:5800,capacity:4,slots:['09:30','14:00','16:00','17:00']}});assert.equal(offer.status,201);offering=offer.data.id;
  assert.equal((await request(`/api/offerings/${offering}/active`,{method:'POST',cookie:m1,body:{active:true}})).status,200);
});
after(async()=>{await app.close();await fs.rm(directory,{recursive:true,force:true});});

test('authentication, CSRF and role boundaries',async()=>{
  assert.equal((await request('/api/bookings')).status,401);
  assert.equal((await request('/api/admin/merchants',{cookie:user})).status,403);
  assert.equal((await request('/api/metrics',{cookie:user})).status,403);
  assert.equal((await request('/api/login',{method:'POST',body:{username:'visitor_one',password:'wrong-password-long'}})).status,401);
  const response=await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:user,'Content-Type':'application/json',Origin:'https://other.example','X-Songgai-Request':'1'},body:'{}'});assert.equal(response.status,403);
  assert.equal((await request('/api/register',{method:'POST',body:{username:'weak',displayName:'weak',password:'short'}})).status,400);
});

test('catalog preserves all original point records and route order',async()=>{
  const {data}=await request('/api/catalog');assert.equal(data.points.length,24);assert.equal(data.routes.length,4);
  const family=data.routes.find(r=>r.id==='family');assert.equal(family.stops[0][2],'4518');assert.equal(family.stops.at(-1)[2],'4489');assert.equal(family.stops.length,10);
});

test('booking is server-persistent, idempotent and scoped to both parties',async()=>{
  const key=id(),result=await book(user,1,key);assert.equal(result.status,201);const b=result.data.booking;
  const again=await book(user,1,key);assert.equal(again.status,200);assert.equal(again.data.booking.id,b.id);
  assert.equal((await book(user,2,key)).status,409);
  const secondDevice=await login('visitor_one');assert.ok((await request('/api/bookings',{cookie:secondDevice})).data.bookings.some(x=>x.id===b.id));
  assert.equal((await request(`/api/bookings/${b.id}`,{cookie:other})).status,404);
  assert.equal((await request(`/api/bookings/${b.id}`,{cookie:m2})).status,404);
  assert.equal((await request(`/api/bookings/${b.id}/messages`,{method:'POST',cookie:m1,body:{body:'TEST merchant reply'}})).status,201);
  assert.equal((await request(`/api/bookings/${b.id}`,{cookie:user})).data.messages[0].body,'TEST merchant reply');
  const confirmed=await status(m1,b,'confirmed');assert.equal(confirmed.status,200);
  assert.equal((await status(m1,b,'confirmed')).status,409);
  assert.equal((await status(m1,confirmed.data.booking,'completed')).status,200);
});

test('capacity is atomic under simultaneous booking requests',async()=>{
  const values=await Promise.all([book(user,3,id(),offering,'14:00'),book(other,3,id(),offering,'14:00')]);
  assert.deepEqual(values.map(v=>v.status).sort(),[201,409]);
  const remaining=await request(`/api/availability?offering=${offering}&date=${today()}`);assert.equal(remaining.data.slots.find(s=>s.slot==='14:00').remaining,1);
});

test('unverified merchants and invalid dates cannot accept bookings',async()=>{
  const bad=await request('/api/bookings',{method:'POST',cookie:user,headers:{'Idempotency-Key':id()},body:{offeringId:offering,date:'2026-02-30',slot:'09:30',count:1,note:''}});assert.equal(bad.status,400);
  assert.equal((await request(`/api/admin/merchants/${merchantId}/verify`,{method:'POST',cookie:admin,body:{verified:false,basis:'TEST ONLY suspension to verify merchant boundary'}})).status,200);
  assert.equal((await book(user)).status,409);
  assert.equal((await request(`/api/admin/merchants/${merchantId}/verify`,{method:'POST',cookie:admin,body:{verified:true,basis:'TEST ONLY restore isolated merchant fixture'}})).status,200);
});

test('financial totals count only reviewed evidence and enforce refund / distribution balances',async()=>{
  let b=(await book(user,1,id(),offering,'16:00')).data.booking;
  assert.equal((await ledger(b,'receipt',5800)).status,409);
  b=(await status(m1,b,'confirmed')).data.booking;
  const file=await evidence();assert.equal(file.status,201);const fid=file.data.id;
  assert.equal((await request(`/api/ledger`,{method:'POST',cookie:m2,body:{bookingId:b.id,kind:'receipt',cents:5800,beneficiary:'TEST',reference:id(),evidenceId:fid}})).status,404);
  const receipt=await ledger(b,'receipt',5800,id(),fid);assert.equal(receipt.status,201);
  assert.equal((await request('/api/metrics',{cookie:admin})).data.financial.length,0);
  assert.equal((await request(`/private-files/${fid}`,{cookie:other})).status,403);
  assert.equal((await request(`/api/ledger/${receipt.data.id}/review`,{method:'POST',cookie:m1,body:{status:'approved',note:'TEST invalid self-review'}})).status,403);
  assert.equal((await review(receipt.data.id)).status,200);
  assert.equal((await ledger(b,'receipt',1)).status,409);
  const refund=await ledger(b,'refund',1000);assert.equal(refund.status,201);assert.equal((await review(refund.data.id)).status,200);
  assert.equal((await ledger(b,'payout',1000)).status,409);
  b=(await status(m1,b,'completed')).data.booking;
  const payout=await ledger(b,'payout',3000);assert.equal(payout.status,201);assert.equal((await review(payout.data.id)).status,200);
  assert.equal((await ledger(b,'labor',2000)).status,409);
  const metrics=(await request('/api/metrics',{cookie:admin})).data;assert.equal(metrics.financial.find(x=>x.kind==='receipt').cents,5800);assert.equal(metrics.financial.find(x=>x.kind==='refund').cents,1000);assert.equal(metrics.financial.find(x=>x.kind==='payout').cents,3000);
  const exported=(await request('/api/export',{cookie:admin})).data;assert.ok(exported.audit.some(x=>x.action==='ledger.approved'));assert.ok(exported.ledger.every(x=>x.evidence_id));
});

test('knowledge retrieval returns actual sources and never claims a connected model',async()=>{
  const answer=await request('/api/agent',{method:'POST',cookie:user,body:{question:'油纸伞怎么制作？'}});assert.equal(answer.status,200);assert.equal(answer.data.mode,'retrieval');assert.ok(answer.data.sources.some(x=>x.title==='油纸伞'));assert.match(answer.data.answer,/制骨/);
  const unknown=await request('/api/agent',{method:'POST',cookie:user,body:{question:'zzzz_unrelated_question'}});assert.equal(unknown.data.sources.length,0);
  assert.equal((await request('/api/health')).data.ragConfigured,false);
});

test('QR tasks sync across sessions without claiming physical attendance',async()=>{
  const point=await request('/api/points/craft-umbrella');assert.ok(point.data.task.choices.includes('制骨'));
  const task=await request('/api/points/craft-umbrella/task',{method:'POST',cookie:user,body:{answer:'制骨'}});assert.equal(task.status,200);assert.equal(task.data.correct,true);assert.match(task.data.notice,/不代表GPS/);
  const second=await login('visitor_one');assert.equal((await request('/api/points/craft-umbrella',{cookie:second})).data.progress.correct,1);
});

test('ordinary PLY files are rejected as 3DGS, and HBIM requires provenance',async()=>{
  assert.equal((await request('/api/assets')).data.assets.length,0);
  const uploaded=await request('/api/files',{method:'POST',cookie:admin,headers:{'X-File-Name':'ordinary.ply'},body:Buffer.from('ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nend_header\n0\n')});assert.equal(uploaded.status,201);
  const bad=await request('/api/assets',{method:'POST',cookie:admin,body:{pointId:'luo',title:'TEST ordinary point cloud',kind:'gaussian',fileId:uploaded.data.id,source:'TEST ONLY synthetic file, not actual heritage',method:'TEST pointcloud',captureDate:today(),accuracy:'TEST unmeasured'}});assert.equal(bad.status,400);
  const archive=await request('/api/assets',{method:'POST',cookie:admin,body:{pointId:'luo',title:'TEST incomplete archive',kind:'hbim',source:'TEST ONLY',method:'test',captureDate:today(),accuracy:'unmeasured',archive:{pointId:'luo',components:[]}}});assert.equal(archive.status,400);
  const content=await fetch(base+'/../server/catalog.json');assert.equal(content.status,404);
});

test('changing a password revokes sessions on every device',async()=>{
  const cookie=await register('password_test'),second=await login('password_test');
  const changed=await request('/api/password',{method:'POST',cookie,body:{currentPassword:password,newPassword:'new-password-for-isolated-test'}});assert.equal(changed.status,200);
  assert.equal((await request('/api/bookings',{cookie:second})).status,401);
  assert.equal((await request('/api/login',{method:'POST',body:{username:'password_test',password}})).status,401);
  assert.equal((await request('/api/login',{method:'POST',body:{username:'password_test',password:'new-password-for-isolated-test'}})).status,200);
});

test('business records and valid sessions survive a server restart',async()=>{
  const before=(await request('/api/bookings',{cookie:user})).data.bookings.map(b=>b.id).sort();assert.ok(before.length>0);
  await app.close();app=createApplication({root,dataDir:directory,origin:'http://127.0.0.1:8787',test:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;
  const after=(await request('/api/bookings',{cookie:user})).data.bookings.map(b=>b.id).sort();assert.deepEqual(after,before);
});
