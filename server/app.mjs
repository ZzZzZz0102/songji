import http from 'node:http';
import {isIP} from 'node:net';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { openDatabase,id,now,transaction,audit } from './database.mjs';
import { hashPassword,checkPassword,digest,token,error,text,integer,passwordValue,usernameValue,rateLimit } from './security.mjs';
import { knowledgeDocuments,answerQuestion } from './knowledge.mjs';
import { transcribe } from './whisper.mjs';

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.wasm':'application/wasm','.glb':'model/gltf-binary','.usdz':'model/vnd.usdz+zip'};
const safeUser=u=>({id:u.id,username:u.username,displayName:u.display_name,role:u.role});
const chinaDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const fileTypes={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',glb:'model/gltf-binary',ply:'application/octet-stream',splat:'application/octet-stream',ksplat:'application/octet-stream',ifc:'application/octet-stream',usdz:'model/vnd.usdz+zip'};

export function createApplication({root,dataDir,origin='http://127.0.0.1:8787',llmBase='',llmKey='',llmModel='',llmMaxCalls=0,trustCloudflare=false,webhook='',webhookSecret='',test=false}) {
  if(!Number.isSafeInteger(llmMaxCalls) || llmMaxCalls<0)throw new Error('LLM_MAX_CALLS_PER_24H must be a non-negative integer.');
  const db=openDatabase(dataDir), catalog=JSON.parse(fs.readFileSync(path.join(root,'server/catalog.json'),'utf8'));
  fs.mkdirSync(path.join(dataDir,'tmp'),{recursive:true});
  const documents=knowledgeDocuments(catalog), config={llmBase,llmKey,llmModel,llmMaxCalls,test};
  const publicRoot=path.join(root,'public'),pointIds=new Set(catalog.points.map(p=>p.id));
  let dummyPassword;
  const ready=hashPassword(token()).then(v=>dummyPassword=v);
  function json(res,status,data,headers={}) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
  function session(req) {
    const cookie=String(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('sg_session='));
    if(!cookie)return null;
    return db.prepare('SELECT u.*,s.hash AS session_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>? AND u.active=1').get(digest(cookie.slice(11)),now());
  }
  function requireUser(user,roles) {if(!user)throw error(401,'请先登录');if(roles && !roles.includes(user.role))throw error(403,'当前账号没有此操作权限');return user;}
  function merchant(user) {
    requireUser(user,['merchant']);
    const row=db.prepare('SELECT * FROM merchants WHERE user_id=? AND active=1').get(user.id);
    if(!row)throw error(403,'商户尚未启用');return row;
  }
  function bookingFor(user,bid) {
    requireUser(user); const b=db.prepare('SELECT b.*,o.title,m.name AS merchant_name FROM bookings b JOIN offerings o ON o.id=b.offering_id JOIN merchants m ON m.id=b.merchant_id WHERE b.id=?').get(bid);
    if(!b)throw error(404,'预约不存在');
    const m=user.role==='merchant'?merchant(user):null;
    if(user.role!=='admin' && b.user_id!==user.id && m?.id!==b.merchant_id)throw error(404,'预约不存在');
    return b;
  }
  function event(type,userId=null,page=null,pointId=null,eventId=id()) {
    db.prepare('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?)').run(eventId,type,page,pointId,userId,now());
  }
  function expire() {
    transaction(db,()=>{
      for(const b of db.prepare("SELECT id FROM bookings WHERE status='pending' AND expires<?").all(now())) {
        db.prepare("UPDATE bookings SET status='expired',updated=?,version=version+1 WHERE id=?").run(now(),b.id);
        audit(db,null,'booking.expired',b.id);
      }
      db.prepare('DELETE FROM sessions WHERE expires<?').run(now());
    });
  }
  async function body(req,max=64*1024) {
    let bytes=0;const parts=[];
    for await(const chunk of req) {bytes+=chunk.length;if(bytes>max)throw error(413,'上传内容过大');parts.push(chunk);}
    return Buffer.concat(parts);
  }
  async function input(req) {
    if(!String(req.headers['content-type']).startsWith('application/json'))throw error(415,'需要JSON请求');
    try {const obj=JSON.parse((await body(req)).toString());if(!obj || Array.isArray(obj) || typeof obj!=='object')throw new Error();return obj;}
    catch(e) {if(e.status)throw e;throw error(400,'JSON格式错误');}
  }
  function assertPoint(point) {if(!pointIds.has(point))throw error(400,'点位不存在');return point;}
  function approvedTotals(bookingId,includeSubmitted=false) {
    const totals={receipt:0,refund:0,payout:0,labor:0,cost:0};
    for(const row of db.prepare(`SELECT kind,SUM(cents) AS amount FROM ledger WHERE booking_id=? AND status IN (${includeSubmitted?"'approved','submitted'":"'approved'"}) GROUP BY kind`).all(bookingId))totals[row.kind]=row.amount;
    return totals;
  }
  function validateLedger(b,kind,cents) {
    const totals=approvedTotals(b.id,true);totals[kind]+=cents;
    if(totals.receipt>b.total_cents || totals.refund>totals.receipt || totals.payout+totals.labor+totals.cost>totals.receipt-totals.refund)throw error(409,'金额超过预约应收或已记录净收入，请先核对收款、退款及分配记录');
  }
  async function notify(bid) {
    if(!webhook)return;
    try {
      const dest=new URL(webhook);if(dest.protocol!=='https:')throw new Error('HTTPS required');
      const response=await fetch(dest,{method:'POST',signal:AbortSignal.timeout(6000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${webhookSecret}`},body:JSON.stringify({event:'booking.updated',bookingId:bid,at:now()})});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      db.prepare("UPDATE notifications SET status='delivered',attempts=attempts+1,last_error=NULL,updated=? WHERE booking_id=? AND status='pending'").run(now(),bid);
    } catch {
      db.prepare("UPDATE notifications SET attempts=attempts+1,last_error='通知服务不可用，商户工作台仍可查看',updated=? WHERE booking_id=? AND status='pending'").run(now(),bid);
    }
  }
  function queueNotice(bid) {db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?,?)').run(id(),bid,'pending',0,null,now());}
  async function api(req,res,url,user) {
    const route=url.pathname,method=req.method,peer=req.socket.remoteAddress || 'unknown',forwarded=req.headers['cf-connecting-ip'];
    const ip=trustCloudflare && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer) && typeof forwarded==='string' && isIP(forwarded)?forwarded:peer;
    expire();
    if(method==='GET' && route==='/api/health')return json(res,200,{ok:true,storage:'sqlite',ragConfigured:Boolean(llmBase && llmKey && llmModel),notifications:webhook?'webhook-and-inbox':'merchant-inbox',publicOrigin:origin});
    if(method==='GET' && route==='/api/session')return json(res,200,{user:user?safeUser(user):null});
    if(method==='POST' && ['/api/register','/api/login'].includes(route)) {
      rateLimit(db,`auth:${ip}`,test?1000:20,900000);
      const data=await input(req),username=usernameValue(data.username),password=passwordValue(data.password);
      let account;
      if(route==='/api/register') {
        const displayName=text(data.displayName,40,1),encoded=await hashPassword(password),uid=id();
        try {db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(uid,username,displayName,encoded,'visitor',1,now());}
        catch(e) {if(e.code?.includes('CONSTRAINT') || /UNIQUE/.test(e.message))throw error(409,'此账号已被使用');throw e;}
        account=db.prepare('SELECT * FROM users WHERE id=?').get(uid);audit(db,uid,'user.registered',uid);
      } else {
        account=db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
        if(!await checkPassword(password,account?.password || dummyPassword) || !account)throw error(401,'账号或密码不正确');
      }
      const raw=token(),expires=new Date(Date.now()+7*86400000).toISOString();
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(raw),account.id,expires);
      return json(res,200,{user:safeUser(account)},{'Set-Cookie':`sg_session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${origin.startsWith('https:')?'; Secure':''}`});
    }
    if(method==='POST' && route==='/api/logout') {
      if(user)db.prepare('DELETE FROM sessions WHERE hash=?').run(user.session_hash);
      return json(res,200,{ok:true},{'Set-Cookie':'sg_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
    }
    if(method==='POST' && route==='/api/password') {
      requireUser(user);rateLimit(db,`password:${user.id}`,10,900000);
      const data=await input(req),current=passwordValue(data.currentPassword),next=passwordValue(data.newPassword);
      if(!await checkPassword(current,user.password))throw error(401,'当前密码不正确');
      if(current===next)throw error(400,'新密码不能与当前密码相同');
      const encoded=await hashPassword(next);
      transaction(db,()=>{db.prepare('UPDATE users SET password=? WHERE id=?').run(encoded,user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);audit(db,user.id,'user.password_changed',user.id);});
      return json(res,200,{ok:true},{'Set-Cookie':'sg_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
    }
    if(method==='GET' && route==='/api/catalog') {
      const offerings=db.prepare('SELECT o.*,m.name AS merchant_name,m.location,m.contact FROM offerings o JOIN merchants m ON m.id=o.merchant_id WHERE o.active=1 AND m.active=1 AND m.verified=1').all().map(o=>({...o,slots:JSON.parse(o.slots)}));
      return json(res,200,{...catalog,offerings});
    }
    if(method==='GET' && route==='/api/availability') {
      const offering=db.prepare('SELECT o.* FROM offerings o JOIN merchants m ON m.id=o.merchant_id WHERE o.id=? AND o.active=1 AND m.active=1 AND m.verified=1').get(url.searchParams.get('offering'));
      if(!offering)throw error(404,'此课程尚未开放预约');
      const date=text(url.searchParams.get('date'),10,10);if(!validDate(date) || date<chinaDate() || date>new Date(Date.now()+180*86400000).toISOString().slice(0,10))throw error(400,'请选择今天至180天内的有效日期');
      const slots=JSON.parse(offering.slots).map(slot=>({slot,remaining:offering.capacity-db.prepare("SELECT COALESCE(SUM(count),0) AS n FROM bookings WHERE offering_id=? AND date=? AND slot=? AND status IN ('pending','confirmed','completed')").get(offering.id,date,slot).n}));
      return json(res,200,{slots});
    }
    if(method==='POST' && route==='/api/bookings') {
      requireUser(user,['visitor']);rateLimit(db,`booking:${user.id}`,30,3600000);
      const data=await input(req),offeringId=text(data.offeringId,80,1),date=text(data.date,10,10),slot=text(data.slot,40,1),count=integer(data.count,1,20),note=text(data.note || '',500),key=text(req.headers['idempotency-key'],100,8);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date || date<chinaDate() || date>new Date(Date.now()+180*86400000).toISOString().slice(0,10))throw error(400,'预约日期需在今天至180天内');
      let replay=false;
      const booking=transaction(db,()=>{
        const previous=db.prepare('SELECT * FROM bookings WHERE user_id=? AND request_key=?').get(user.id,key);
        if(previous) {
          if(previous.offering_id!==offeringId || previous.date!==date || previous.slot!==slot || previous.count!==count || previous.note!==note)throw error(409,'重复请求编号对应的内容不一致');
          replay=true;return previous;
        }
        const o=db.prepare('SELECT o.* FROM offerings o JOIN merchants m ON m.id=o.merchant_id WHERE o.id=? AND o.active=1 AND m.active=1 AND m.verified=1').get(offeringId);
        if(!o || !JSON.parse(o.slots).includes(slot))throw error(409,'此商户课程或时段尚未开放');
        const reserved=db.prepare("SELECT COALESCE(SUM(count),0) AS n FROM bookings WHERE offering_id=? AND date=? AND slot=? AND status IN ('pending','confirmed','completed')").get(o.id,date,slot).n;
        if(reserved+count>o.capacity)throw error(409,'该时段余位不足，请更换时段或人数');
        const bid=id(),time=now(),expires=new Date(Date.now()+86400000).toISOString();
        db.prepare('INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(bid,user.id,o.id,o.merchant_id,date,slot,count,o.price_cents*count,'pending',note,time,time,expires,1,key);
        audit(db,user.id,'booking.created',bid,{offeringId,count});event('booking_submitted',user.id);queueNotice(bid);
        return db.prepare('SELECT * FROM bookings WHERE id=?').get(bid);
      });
      if(!replay)void notify(booking.id);
      return json(res,replay?200:201,{booking});
    }
    if(method==='GET' && route==='/api/bookings') {
      requireUser(user);
      const filter=user.role==='visitor'?'b.user_id=?':user.role==='merchant'?'b.merchant_id=?':'1=?';
      const param=user.role==='visitor'?user.id:user.role==='merchant'?merchant(user).id:1;
      const items=db.prepare(`SELECT b.*,o.title,m.name AS merchant_name,u.display_name AS visitor_name FROM bookings b JOIN offerings o ON o.id=b.offering_id JOIN merchants m ON m.id=b.merchant_id JOIN users u ON u.id=b.user_id WHERE ${filter} ORDER BY b.created DESC LIMIT 500`).all(param);
      return json(res,200,{bookings:items});
    }
    const bRoute=route.match(/^\/api\/bookings\/([\w-]+)(?:\/(messages|status))?$/);
    if(bRoute) {
      const b=bookingFor(user,bRoute[1]);
      if(method==='GET' && !bRoute[2])return json(res,200,{booking:b,messages:db.prepare('SELECT m.id,m.body,m.created,u.display_name,u.role FROM messages m JOIN users u ON u.id=m.user_id WHERE booking_id=? ORDER BY m.created').all(b.id),audit:db.prepare('SELECT action,detail,created FROM audit WHERE object_id=? ORDER BY created').all(b.id)});
      if(method==='POST' && bRoute[2]==='messages') {
        rateLimit(db,`msg:${user.id}`,50,60000);const data=await input(req),message=text(data.body,1000,1),mid=id();
        transaction(db,()=>{db.prepare('INSERT INTO messages VALUES (?,?,?,?,?)').run(mid,b.id,user.id,message,now());audit(db,user.id,'booking.message',b.id,{messageId:mid});queueNotice(b.id);});void notify(b.id);
        return json(res,201,{ok:true});
      }
      if(method==='POST' && bRoute[2]==='status') {
        const data=await input(req),status=text(data.status,20,1),version=integer(data.version,1,1e9);
        const transitions=user.role==='visitor'?{pending:['cancelled'],confirmed:['cancelled']}:{pending:['confirmed','declined'],confirmed:['completed','cancelled']};
        if(user.role!=='visitor' && user.role!=='merchant')throw error(403,'请由预约双方操作状态');
        transaction(db,()=>{
          const fresh=db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id);
          if(fresh.version!==version)throw error(409,'预约已更新，请刷新后重试');
          if(!transitions[fresh.status]?.includes(status))throw error(409,'不能执行此状态变更');
          if(status==='completed' && fresh.date>chinaDate())throw error(409,'体验日期尚未到达，不能提前完成');
          db.prepare('UPDATE bookings SET status=?,updated=?,version=version+1 WHERE id=?').run(status,now(),b.id);
          audit(db,user.id,`booking.${status}`,b.id);event(`booking_${status}`,user.id);queueNotice(b.id);
        });void notify(b.id);return json(res,200,{booking:bookingFor(user,b.id)});
      }
    }
    if(method==='GET' && route==='/api/merchant')return json(res,200,{merchant:merchant(user),offerings:db.prepare('SELECT * FROM offerings WHERE merchant_id=?').all(merchant(user).id).map(o=>({...o,slots:JSON.parse(o.slots)}))});
    if(method==='POST' && route==='/api/offerings') {
      const m=merchant(user),data=await input(req),oid=id();
      const point=assertPoint(data.pointId),title=text(data.title,100,2),description=text(data.description,1000,10),price=integer(data.priceCents,1,10000000),capacity=integer(data.capacity,1,100),slots=data.slots;
      if(!Array.isArray(slots) || slots.length<1 || slots.length>8 || new Set(slots).size!==slots.length)throw error(400,'请配置1至8个不重复时段');
      for(const slot of slots)if(typeof slot!=='string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))throw error(400,'时段使用24小时制，例如09:30');
      db.prepare('INSERT INTO offerings VALUES (?,?,?,?,?,?,?,?,?)').run(oid,m.id,point,title,description,price,capacity,JSON.stringify(slots),0);audit(db,user.id,'offering.created',oid);
      return json(res,201,{id:oid});
    }
    const toggle=route.match(/^\/api\/offerings\/([\w-]+)\/active$/);
    if(method==='POST' && toggle) {
      const m=merchant(user),data=await input(req);if(typeof data.active!=='boolean')throw error(400,'状态无效');
      const o=db.prepare('SELECT * FROM offerings WHERE id=? AND merchant_id=?').get(toggle[1],m.id);if(!o)throw error(404,'课程不存在');
      if(data.active && !m.verified)throw error(409,'平台尚未确认此经营主体，暂不能发布');
      db.prepare('UPDATE offerings SET active=? WHERE id=?').run(Number(data.active),o.id);audit(db,user.id,'offering.active',o.id,{active:data.active});return json(res,200,{ok:true});
    }
    if(method==='GET' && route==='/api/admin/merchants') {requireUser(user,['admin']);return json(res,200,{merchants:db.prepare('SELECT m.*,u.username,u.display_name FROM merchants m JOIN users u ON u.id=m.user_id').all()});}
    if(method==='POST' && route==='/api/admin/merchants') {
      requireUser(user,['admin']);const data=await input(req),username=usernameValue(data.username),password=await hashPassword(passwordValue(data.password)),name=text(data.name,100,2),location=text(data.location,300,2),contact=text(data.contact,150,2);
      const uid=id(),mid=id();
      try {transaction(db,()=>{db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(uid,username,name,password,'merchant',1,now());db.prepare('INSERT INTO merchants VALUES (?,?,?,?,?,?,?)').run(mid,uid,name,location,contact,0,1);audit(db,user.id,'merchant.created',mid);});}
      catch(e){if(/UNIQUE/.test(e.message))throw error(409,'商户账号已存在');throw e;}
      return json(res,201,{id:mid});
    }
    const verify=route.match(/^\/api\/admin\/merchants\/([\w-]+)\/verify$/);
    if(method==='POST' && verify) {
      requireUser(user,['admin']);const data=await input(req),basis=text(data.basis,500,10);if(typeof data.verified!=='boolean')throw error(400,'核验状态错误');
      const m=db.prepare('SELECT id FROM merchants WHERE id=?').get(verify[1]);if(!m)throw error(404,'商户不存在');
      transaction(db,()=>{db.prepare('UPDATE merchants SET verified=? WHERE id=?').run(Number(data.verified),m.id);audit(db,user.id,'merchant.verified',m.id,{basis,verified:data.verified});});return json(res,200,{ok:true});
    }
    if(method==='POST' && route==='/api/files') {
      requireUser(user,['merchant','admin']);rateLimit(db,`upload:${user.id}`,30,3600000);
      const name=text(decodeURIComponent(String(req.headers['x-file-name'] || '')),180,1),ext=name.split('.').pop().toLowerCase();
      if(!fileTypes[ext])throw error(415,'支持PDF、PNG、JPEG、GLB、PLY、SPLAT、KSPLAT、IFC与USDZ');
      if(user.role==='merchant' && !['pdf','png','jpg','jpeg'].includes(ext))throw error(403,'模型仅允许平台管理员上传');
      const content=await body(req,['pdf','png','jpg','jpeg'].includes(ext)?10*1024*1024:150*1024*1024);
      if(!content.length)throw error(400,'文件为空');
      if(ext==='pdf' && content.subarray(0,5).toString()!=='%PDF-' || ext==='png' && content.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || ['jpg','jpeg'].includes(ext) && content.subarray(0,3).toString('hex')!=='ffd8ff' || ext==='glb' && content.subarray(0,4).toString()!=='glTF' || ext==='ply' && !content.subarray(0,10).toString().startsWith('ply') || ext==='ifc' && !content.subarray(0,200).toString().includes('ISO-10303-21'))throw error(400,'文件内容与扩展名不符');
      if(ext==='glb') {
        try {const size=content.readUInt32LE(12);const scene=JSON.parse(content.subarray(20,20+size).toString());for(const item of [...scene.buffers || [],...scene.images || []])if(item.uri && !item.uri.startsWith('data:'))throw new Error();}
        catch{throw error(400,'GLB必须为有效的单文件模型，纹理与缓冲需内嵌');}
      }
      const fid=id(),disk=path.join(dataDir,'files',fid),sha256=digest(content);
      await fsp.writeFile(disk,content,{flag:'wx'});
      db.prepare('INSERT INTO files VALUES (?,?,?,?,?,?,?,?)').run(fid,user.id,name,fileTypes[ext],content.length,sha256,disk,now());
      audit(db,user.id,'file.uploaded',fid,{sha256,bytes:content.length});return json(res,201,{id:fid,name,sha256,bytes:content.length});
    }
    if(method==='POST' && route==='/api/ledger') {
      const m=merchant(user),data=await input(req),b=bookingFor(user,text(data.bookingId,80,1));
      const kind=text(data.kind,20,1),cents=integer(data.cents,1,1000000000),beneficiary=text(data.beneficiary,100,1),reference=text(data.reference,100,3);
      if(!['receipt','refund','payout','labor','cost'].includes(kind))throw error(400,'账目类型不正确');
      if(['pending','declined','expired'].includes(b.status))throw error(409,'预约尚未确认，不能登记经营金额');
      if(['payout','labor','cost'].includes(kind) && b.status!=='completed')throw error(409,'履约完成后才能登记到户分配和成本');
      const file=db.prepare('SELECT * FROM files WHERE id=? AND owner_id=?').get(data.evidenceId,user.id);
      if(!file || !['application/pdf','image/png','image/jpeg'].includes(file.mime))throw error(400,'请先上传属于当前账号的凭证文件');
      const lid=id();
      try {transaction(db,()=>{validateLedger(b,kind,cents);db.prepare('INSERT INTO ledger (id,booking_id,merchant_id,kind,cents,beneficiary,evidence_id,reference,created_by,created) VALUES (?,?,?,?,?,?,?,?,?,?)').run(lid,b.id,m.id,kind,cents,beneficiary,file.id,reference,user.id,now());audit(db,user.id,'ledger.submitted',lid,{bookingId:b.id});});}
      catch(e){if(/UNIQUE/.test(e.message))throw error(409,'此凭证业务编号已登记');throw e;}
      return json(res,201,{id:lid});
    }
    if(method==='GET' && route==='/api/ledger') {
      requireUser(user,['admin','merchant']);const m=user.role==='merchant'?merchant(user):null;
      const items=db.prepare(`SELECT l.*,f.name AS evidence_name,f.sha256 FROM ledger l JOIN files f ON f.id=l.evidence_id ${m?'WHERE merchant_id=?':''} ORDER BY l.created DESC LIMIT 1000`).all(...m?[m.id]:[]);
      return json(res,200,{ledger:items});
    }
    const review=route.match(/^\/api\/ledger\/([\w-]+)\/review$/);
    if(method==='POST' && review) {
      requireUser(user,['admin']);const data=await input(req),status=text(data.status,20,1),reviewNote=text(data.note,500,10);
      if(!['approved','rejected'].includes(status))throw error(400,'复核状态错误');
      transaction(db,()=>{
        const row=db.prepare('SELECT * FROM ledger WHERE id=?').get(review[1]);if(!row || row.status!=='submitted')throw error(409,'此记录不存在或已复核');
        const totals=approvedTotals(row.booking_id);
        if(status==='approved') {
          totals[row.kind]+=row.cents;const b=bookingFor(user,row.booking_id);
          if(totals.receipt>b.total_cents || totals.refund>totals.receipt || totals.payout+totals.labor+totals.cost>totals.receipt-totals.refund)throw error(409,'请按收款、退款、分配顺序复核，并核对净收入余额');
        }
        db.prepare('UPDATE ledger SET status=?,reviewer_id=?,reviewed=?,review_note=? WHERE id=?').run(status,user.id,now(),reviewNote,row.id);
        audit(db,user.id,`ledger.${status}`,row.id,{note:reviewNote,bookingId:row.booking_id});
      });return json(res,200,{ok:true});
    }
    if(method==='GET' && route==='/api/metrics') {
      requireUser(user,['admin','merchant']);const m=user.role==='merchant'?merchant(user):null;
      const rows=db.prepare(`SELECT status,COUNT(*) AS count FROM bookings ${m?'WHERE merchant_id=?':''} GROUP BY status`).all(...m?[m.id]:[]);
      const sums=db.prepare(`SELECT kind,SUM(cents) AS cents,COUNT(*) AS count FROM ledger WHERE status='approved' ${m?'AND merchant_id=?':''} GROUP BY kind`).all(...m?[m.id]:[]);
      return json(res,200,{bookings:rows,financial:sums,visits:user.role==='admin'?db.prepare("SELECT COUNT(*) AS count FROM events WHERE type='page_view'").get().count:null,taskCompletions:user.role==='admin'?db.prepare('SELECT COUNT(*) AS count FROM task_progress WHERE correct=1').get().count:null,definition:'访问为同意统计后的页面访问记录数，非独立游客人数。财务为上传凭证经人工复核的记录，并非银行接口核验；预约金额不计成交。'});
    }
    if(method==='GET' && route==='/api/export') {
      requireUser(user,['admin','merchant']);const m=user.role==='merchant'?merchant(user):null;
      const ledger=db.prepare(`SELECT id,booking_id,kind,cents,beneficiary,reference,status,created,reviewed,evidence_id FROM ledger ${m?'WHERE merchant_id=?':''} ORDER BY created`).all(...m?[m.id]:[]);
      return json(res,200,{exported:now(),unit:'CNY cents',definition:'人工凭证记录与复核状态，非银行核验',ledger,audit:user.role==='admin'?db.prepare('SELECT * FROM audit ORDER BY created').all():db.prepare("SELECT * FROM audit WHERE actor_id=? ORDER BY created").all(user.id)});
    }
    if(method==='POST' && route==='/api/events') {
      rateLimit(db,`events:${ip}`,300,60000);const data=await input(req);
      if(data.consent!==true || !['page_view','qr_open','ar_open','model_open'].includes(data.type))throw error(400,'事件或统计同意无效');
      const eid=text(data.eventId,80,8),page=text(data.page || '',60);if(data.pointId)assertPoint(data.pointId);
      event(data.type,user?.id || null,page,data.pointId || null,eid);return json(res,201,{ok:true});
    }
    if(method==='POST' && route==='/api/agent') {
      requireUser(user);const data=await input(req);return json(res,200,await answerQuestion({db,documents,question:data.question,user,config}));
    }
    if(method==='POST' && route==='/api/transcribe') {
      requireUser(user);rateLimit(db,`transcribe:${user.id}`,30,3600000);
      const content=await body(req,20*1024*1024);
      if(!content.length)throw error(400,'音频为空');
      const ext=String(req.headers['x-audio-ext']||'webm').toLowerCase().replace(/[^a-z0-9]/g,'');
      const tmp=path.join(dataDir,'tmp',`voice-${id()}.${ext||'webm'}`);
      await fsp.writeFile(tmp,content,{flag:'wx'});
      try {const text=await transcribe(tmp);return json(res,200,{text});}
      catch(e){throw error(502,e.message||'语音转写失败');}
      finally {await fsp.unlink(tmp).catch(()=>{});}
    }
    const pointRoute=route.match(/^\/api\/points\/([\w-]+)(?:\/(task))?$/);
    if(pointRoute) {
      const point=catalog.points.find(p=>p.id===pointRoute[1]);if(!point)throw error(404,'点位不存在');
      const task=taskFor(point);
      if(method==='GET')return json(res,200,{point,task:{question:task.question,choices:task.choices},progress:user?db.prepare('SELECT correct,updated FROM task_progress WHERE user_id=? AND point_id=?').get(user.id,point.id) || null:null});
      if(method==='POST' && pointRoute[2]==='task') {
        requireUser(user,['visitor']);rateLimit(db,`task:${user.id}`,60,60000);const data=await input(req),answer=text(data.answer,200,1);if(!task.choices.includes(answer))throw error(400,'请选择给定答案');
        const correct=Number(answer===task.answer);db.prepare('INSERT INTO task_progress VALUES (?,?,?,?,?) ON CONFLICT(user_id,point_id) DO UPDATE SET answer=excluded.answer,correct=excluded.correct,updated=excluded.updated').run(user.id,point.id,answer,correct,now());
        return json(res,200,{correct:Boolean(correct),explanation:task.explanation,notice:'此为线上知识任务记录，不代表GPS到访验证。'});
      }
    }
    if(method==='GET' && route==='/api/assets') {
      return json(res,200,{assets:db.prepare('SELECT a.*,f.name AS filename,f.bytes,f.sha256 FROM assets a LEFT JOIN files f ON f.id=a.file_id WHERE a.verified=1 ORDER BY a.created DESC').all().map(a=>({...a,archive:a.archive?JSON.parse(a.archive):null,url:a.file_id?`/media/${a.file_id}`:null}))});
    }
    if(method==='POST' && route==='/api/assets') {
      requireUser(user,['admin']);const data=await input(req),point=assertPoint(data.pointId),title=text(data.title,120,2),kind=text(data.kind,20,1),source=text(data.source,1000,10),methodName=text(data.method,300,3),captureDate=text(data.captureDate,10,10),accuracy=text(data.accuracy,300,3);
      if(!['gaussian','display-glb','hbim'].includes(kind))throw error(400,'资产类型无效');
      if(!validDate(captureDate) || captureDate>chinaDate())throw error(400,'请填写有效采集日期');
      let file=null,archive=null,scale=null;
      if(data.fileId)file=db.prepare('SELECT * FROM files WHERE id=? AND owner_id=?').get(data.fileId,user.id);
      if(kind==='gaussian' && (!file || !/\.(ply|splat|ksplat)$/i.test(file.name)))throw error(400,'请上传实际3DGS文件（PLY/SPLAT/KSPLAT）');
      if(kind==='gaussian' && file.name.toLowerCase().endsWith('.ply')) {
        const head=fs.readFileSync(file.path).subarray(0,20000).toString();
        if(!head.includes('f_dc_0') || !head.includes('opacity') || !head.includes('scale_0') || !head.includes('rot_0'))throw error(400,'此PLY缺少高斯属性，普通点云不能作为3DGS成果发布');
      }
      if(kind==='display-glb' && (!file || !/\.glb$/i.test(file.name)))throw error(400,'请上传内嵌纹理的GLB模型');
      if(kind==='display-glb') {if(!Number.isFinite(data.scaleM) || data.scaleM<=0 || data.scaleM>1000)throw error(400,'请记录模型实际宽度（米），用于AR比例');scale=data.scaleM;}
      if(kind==='hbim') {
        archive=validateArchive(data.archive,point);
        if(file && !/\.ifc$/i.test(file.name))throw error(400,'HBIM关联文件应为IFC格式');
      }
      const aid=id();db.prepare('INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(aid,point,title,kind,file?.id || null,archive?JSON.stringify(archive):null,source,methodName,captureDate,accuracy,scale,0,user.id,now());audit(db,user.id,'asset.submitted',aid);
      return json(res,201,{id:aid});
    }
    if(method==='GET' && route==='/api/admin/assets') {requireUser(user,['admin']);return json(res,200,{assets:db.prepare('SELECT a.*,f.name AS filename FROM assets a LEFT JOIN files f ON f.id=a.file_id ORDER BY a.created DESC').all()});}
    const assetVerify=route.match(/^\/api\/assets\/([\w-]+)\/verify$/);
    if(method==='POST' && assetVerify) {
      requireUser(user,['admin']);const data=await input(req),basis=text(data.basis,500,10);if(typeof data.verified!=='boolean')throw error(400,'状态错误');
      if(!db.prepare('SELECT id FROM assets WHERE id=?').get(assetVerify[1]))throw error(404,'资产不存在');
      db.prepare('UPDATE assets SET verified=? WHERE id=?').run(Number(data.verified),assetVerify[1]);audit(db,user.id,'asset.verified',assetVerify[1],{basis,verified:data.verified});return json(res,200,{ok:true});
    }
    throw error(404,'接口不存在');
  }

  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options','SAMEORIGIN');
    res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=(), xr-spatial-tracking=(self)');
    try {
      await ready;
      const url=new URL(req.url,'http://localhost');
      if(!['GET','HEAD','POST'].includes(req.method))throw error(405,'请求方法不支持');
      const user=session(req);
      if(url.pathname.startsWith('/api/')) {
        if(req.method==='POST') {
          if(req.headers['x-songgai-request']!=='1' || req.headers.origin && req.headers.origin!==origin)throw error(403,'请求来源未通过验证');
        }
        return await api(req,res,url,user);
      }
      const media=url.pathname.match(/^\/(media|private-files)\/([\w-]+)$/);
      let target,filename;
      if(media) {
        const file=db.prepare('SELECT * FROM files WHERE id=?').get(media[2]);if(!file)throw error(404,'文件不存在');
        if(media[1]==='media') {
          if(!db.prepare('SELECT id FROM assets WHERE file_id=? AND verified=1').get(file.id))throw error(404,'资产未公开');
        } else {
          requireUser(user,['admin','merchant']);
          if(user.role!=='admin' && file.owner_id!==user.id)throw error(404,'文件不存在');
        }
        target=file.path;filename=file.name;res.setHeader('Content-Type',file.mime);res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Cache-Control','private, no-store');
      } else {
        const decoded=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
        target=path.resolve(publicRoot,'.'+decoded);
        if(!target.startsWith(publicRoot+path.sep) || decoded.split('/').some(s=>s.startsWith('.')))throw error(404,'文件不存在');
        res.setHeader('Content-Type',MIME[path.extname(target).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control','no-cache');
      }
      const stat=await fsp.stat(target);if(!stat.isFile())throw error(404,'文件不存在');
      let start=0,end=stat.size-1;
      if(req.headers.range) {
        const match=String(req.headers.range).match(/^bytes=(\d+)-(\d*)$/);
        if(!match)throw error(416,'范围无效');start=Number(match[1]);end=match[2]?Number(match[2]):end;
        if(start>end || end>=stat.size)throw error(416,'范围无效');
        res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);
      }
      res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',stat.size?end-start+1:0);
      if(req.method==='HEAD' || !stat.size)return res.end();
      await pipeline(fs.createReadStream(target,{start,end}),res);
    } catch(e) {
      if(res.headersSent){res.destroy();return;}
      const status=e.status || (e.code==='ENOENT'?404:500);
      if(status===500)console.error('Request failed:',e.message);
      json(res,status,{error:status===500?'服务暂时不可用，请稍后重试':status===404?'未找到此内容':e.message});
    }
  });
  return {server,db,close:()=>new Promise(resolve=>server.close(()=>{db.close();resolve();}))};
}

function taskFor(point) {
  if(point.id==='craft-umbrella')return {question:'传统油纸伞制作中，裱纸前通常需要完成什么？',choices:['制骨','上油','寄送'],answer:'制骨',explanation:'资料中的制作顺序为制骨、裱纸、绘画、上油。具体工序以工坊讲解为准。'};
  if(point.id==='county')return {question:'观察古县衙时，哪些内容需要区分？',choices:['历史遗存与后续修复','所有建筑都是原物','只看商品价格'],answer:'历史遗存与后续修复',explanation:'现有资料提醒区分历史遗存与修缮更新部分，年代与边界以文保解说为准。'};
  return {question:`在${point.name}参观时，遇到未核实的开放或通行信息应如何处理？`,choices:['查看现场公告并向管理人员确认','默认全天开放','忽略围挡直接进入'],answer:'查看现场公告并向管理人员确认',explanation:'点位资料供出行参考，开放、台阶与临时活动需现场确认。'};
}

function validateArchive(value,pointId) {
  if(!value || typeof value!=='object' || value.pointId!==pointId)throw error(400,'HBIM档案必须匹配所选点位');
  const buildingId=text(value.buildingId,100,1),coordinateSystem=text(value.coordinateSystem,300,3),surveyDate=text(value.surveyDate,10,10),surveyor=text(value.surveyor,150,2);
  if(!validDate(surveyDate) || surveyDate>chinaDate())throw error(400,'测绘日期无效');
  if(!Array.isArray(value.components) || !value.components.length || value.components.length>500)throw error(400,'档案应包含1至500条构件记录');
  const components=value.components.map(c=>{
    const result={id:text(c.id,100,1),name:text(c.name,150,1),material:text(c.material,100,1),dimensions:text(c.dimensions,300,2),condition:text(c.condition,1000,2),evidence:text(c.evidence,1000,5),inspected:text(c.inspected,10,10)};
    if(!validDate(result.inspected) || result.inspected>chinaDate())throw error(400,'构件检查日期无效');
    return result;
  });
  if(new Set(components.map(c=>c.id)).size!==components.length)throw error(400,'构件编号不能重复');
  return {pointId,buildingId,coordinateSystem,surveyDate,surveyor,components,repairs:Array.isArray(value.repairs)?value.repairs.slice(0,100).map(r=>({date:text(r.date,10,10),description:text(r.description,1000,3),evidence:text(r.evidence,1000,5)})):[]};
}
