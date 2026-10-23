import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createApplication} from '../server/app.mjs';
import {hashPassword} from '../server/security.mjs';
import {id,now} from '../server/database.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const bundled='C:/Users/hexinyi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || bundled+'playwright');
const sharp=require(process.env.SHARP_MODULE || bundled+'sharp');
const output=path.join(root,'test-results');await fs.mkdir(output,{recursive:true});
const directory=await fs.mkdtemp(path.join(root,'data','browser-test-'));
const port=Number(process.env.QA_PORT || 8793),base=`http://127.0.0.1:${port}`;
const app=createApplication({root,dataDir:directory,origin:base,test:true});
let browser;
const errors=[],report=[];const password='isolated-browser-test-2026!';
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
async function api(route,{cookie,method='GET',body,headers={}}={}) {
  const response=await fetch(base+route,{method,headers:{'X-Songgai-Request':'1',...cookie?{Cookie:cookie}:{},...body && !Buffer.isBuffer(body)?{'Content-Type':'application/json'}:{},...headers},body:Buffer.isBuffer(body)?body:body?JSON.stringify(body):undefined});
  const data=await response.json();assert.ok(response.ok,`${route}: ${response.status} ${JSON.stringify(data)}`);
  return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function go(page,hash) {await page.goto(base+'/#'+hash);await page.waitForFunction(()=>document.querySelector('#business-account')?.textContent.trim().length>0);await page.waitForTimeout(180);}
async function layout(page,label) {
  const size=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
  assert.ok(size.width<=size.viewport+1,`${label} horizontal overflow ${JSON.stringify(size)}`);
}
function splats() {
  const rows=[];
  for(let i=0;i<50;i++)for(let j=1;j<30;j++) {
    const theta=i*Math.PI*2/50,phi=j*Math.PI/30,row=Buffer.alloc(32);
    [Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta),.045,.045,.045].forEach((v,k)=>row.writeFloatLE(v,k*4));
    row[24]=i<25?216:43;row[25]=j<15?165:83;row[26]=i<25?42:161;row[27]=255;row[28]=255;row[29]=128;row[30]=128;row[31]=128;rows.push(row);
  }
  return Buffer.concat(rows);
}
function cubeGLB() {
  const faces=[[[1,0,0],[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],[[-1,0,0],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],[[0,1,0],[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],[[0,-1,0],[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],[[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]];
  const positions=[],normals=[];
  for(const [normal,...vertices] of faces)for(const idx of [0,1,2,0,2,3]){positions.push(...vertices[idx]);normals.push(...normal);}
  const p=Buffer.from(new Float32Array(positions).buffer),n=Buffer.from(new Float32Array(normals).buffer),binary=Buffer.concat([p,n]);
  const gltf={asset:{version:'2.0',generator:'TEST ONLY synthetic cube'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.7,.19,.1,1],metallicFactor:0,roughnessFactor:.7}}],buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:p.length},{buffer:0,byteOffset:p.length,byteLength:n.length}],accessors:[{bufferView:0,componentType:5126,count:36,type:'VEC3',min:[-1,-1,-1],max:[1,1,1]},{bufferView:1,componentType:5126,count:36,type:'VEC3'}]};
  let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const head=Buffer.alloc(20);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+binary.length,8);head.writeUInt32LE(json.length,12);head.write('JSON',16);
  const chunk=Buffer.alloc(8);chunk.writeUInt32LE(binary.length);chunk.writeUInt32LE(0x004e4942,4);return Buffer.concat([head,json,chunk,binary]);
}
async function pixels(locator,name) {
  const buffer=await locator.screenshot({path:path.join(output,name+'.png')});
  const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const colors=new Set();for(let i=0;i<data.length;i+=Math.max(3,Math.floor(info.width*info.height/20000)*3))colors.add(`${data[i]>>4},${data[i+1]>>4},${data[i+2]>>4}`);
  assert.ok(colors.size>25,`${name} blank scene (${colors.size} quantized colors)`);return buffer;
}
try {
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});
  app.db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(id(),'qa_admin','TEST ONLY admin',await hashPassword(password),'admin',1,now());
  const admin=(await api('/api/login',{method:'POST',body:{username:'qa_admin',password}})).cookie;
  const merchant=(await api('/api/admin/merchants',{method:'POST',cookie:admin,body:{username:'qa_merchant',password,name:'测试商户·非实际合作方',location:'隔离测试地址',contact:'隔离测试联系信息'}})).data.id;
  await api(`/api/admin/merchants/${merchant}/verify`,{method:'POST',cookie:admin,body:{verified:true,basis:'TEST ONLY fixture in isolated database, not real verification'}});
  const mc=(await api('/api/login',{method:'POST',body:{username:'qa_merchant',password}})).cookie;
  const offering=(await api('/api/offerings',{method:'POST',cookie:mc,body:{pointId:'craft-umbrella',title:'测试油纸伞体验·非实际课程',description:'隔离数据库功能验证，不是实际商户课程。',priceCents:5800,capacity:4,slots:['09:30','14:00']}})).data.id;
  await api(`/api/offerings/${offering}/active`,{method:'POST',cookie:mc,body:{active:true}});
  const assets={};
  for(const [kind,filename,body] of [['gaussian','TEST-ONLY.splat',splats()],['display-glb','TEST-ONLY.glb',cubeGLB()]]) {
    const file=(await api('/api/files',{method:'POST',cookie:admin,headers:{'X-File-Name':filename},body})).data.id;
    assets[kind]=(await api('/api/assets',{method:'POST',cookie:admin,body:{pointId:'craft-umbrella',kind,fileId:file,title:`TEST ONLY ${kind}`,source:'Synthetic test fixture; not a model of Songgai. Isolated QA database only.',method:'Programmatic QA geometry',captureDate:today,accuracy:'Synthetic, no survey accuracy',scaleM:2}})).data.id;
    await api(`/api/assets/${assets[kind]}/verify`,{method:'POST',cookie:admin,body:{verified:true,basis:'TEST ONLY visual renderer fixture, not actual surveyed heritage'}});
  }
  assets.hbim=(await api('/api/assets',{method:'POST',cookie:admin,body:{pointId:'luo',kind:'hbim',title:'TEST ONLY HBIM archive',source:'Synthetic archive for QA, not a real surveyed building.',method:'Synthetic QA archive only',captureDate:today,accuracy:'Not surveyed',archive:{pointId:'luo',buildingId:'TEST-BUILDING',coordinateSystem:'TEST local axes, not georeferenced',surveyDate:today,surveyor:'TEST ONLY',components:[{id:'TEST-COLUMN',name:'TEST column',material:'TEST timber',dimensions:'TEST 0.3m x 0.3m x 2m',condition:'TEST condition record, not real inspection',evidence:'TEST report reference, no real evidence',inspected:today}],repairs:[]}}})).data.id;
  await api(`/api/assets/${assets.hbim}/verify`,{method:'POST',cookie:admin,body:{verified:true,basis:'TEST ONLY synthetic archive layout verification'}});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
  await desktop.addInitScript(()=>localStorage.setItem('songji-analytics-consent','no'));
  const page=await desktop.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')report.push('Browser console: '+e.text());});
  page.on('response',r=>{if(r.status()>=400)report.push(`HTTP ${r.status()} ${r.url()}`);});
  await go(page,'home');await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0,{},{timeout:20000});
  const video=await page.locator('video').evaluate(v=>({loop:v.loop,muted:v.muted,paused:v.paused,width:v.videoWidth}));assert.ok(video.loop && video.muted && !video.paused && video.width>0);report.push({homeVideo:video});
  await page.screenshot({path:path.join(output,'desktop-home.png')});
  for(const route of ['photos','sights','food','heritage','shop','routes','guide','visit','records','foundation','live','agent','stays','scan?point=craft-umbrella','account','booking']) {await go(page,route);await layout(page,'desktop '+route);assert.ok(await page.locator('#main').innerText());}
  await go(page,'account');
  const register=page.locator('#business-register');await register.locator('[name=displayName]').fill('测试游客');await register.locator('[name=username]').fill('qa_visitor');await register.locator('[name=password]').fill(password);await register.locator('[type=checkbox]').check();await register.locator('[type=submit]').click();await page.waitForURL('**/#workbench');await page.locator('#business-view h2').waitFor();
  await go(page,`booking?offering=${offering}`);await page.locator('#online-book-date').fill(today);await page.locator('#online-book-slot option[value="09:30"]').waitFor({state:'attached'});await page.locator('#online-book-slot').selectOption('09:30');await page.locator('#business-booking [name=consent]').check();await page.locator('#business-booking [type=submit]').click();await page.waitForURL(/#workbench\?booking=/);await page.locator('#business-message').waitFor();
  const bid=new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('booking');
  const merchantContext=await browser.newContext({viewport:{width:1440,height:1000}});await merchantContext.addInitScript(()=>localStorage.setItem('songji-analytics-consent','no'));await merchantContext.addCookies([{name:'sg_session',value:mc.split('=')[1],url:base}]);
  const merchantPage=await merchantContext.newPage();merchantPage.on('pageerror',e=>errors.push(e.message));
  await go(merchantPage,`workbench?booking=${bid}`);await merchantPage.locator('#business-message').waitFor();merchantPage.on('dialog',d=>d.accept());await merchantPage.locator('[data-book-status=confirmed]').click();await merchantPage.locator('[data-book-status=completed]').waitFor();await merchantPage.locator('#business-message textarea').fill('隔离测试：商户已确认接待。');await merchantPage.locator('#business-message [type=submit]').click();await merchantPage.getByText('隔离测试：商户已确认接待。',{exact:true}).waitFor();
  await page.reload();await page.getByText('隔离测试：商户已确认接待。',{exact:true}).waitFor();report.push('Booking through visitor UI, merchant confirmation and reply, reload persistence: passed');
  const adminContext=await browser.newContext({viewport:{width:1440,height:1000}});await adminContext.addInitScript(()=>localStorage.setItem('songji-analytics-consent','no'));await adminContext.addCookies([{name:'sg_session',value:admin.split('=')[1],url:base}]);
  const ap=await adminContext.newPage();ap.on('pageerror',e=>errors.push(e.message));
  for(const route of ['admin','asset-admin','finance','dashboard','workbench']){await go(ap,route);await ap.locator('#business-view h2').first().waitFor();await layout(ap,'admin '+route);assert.equal(await ap.locator('#business-view .business-error').count(),0);}
  for(const route of ['finance','dashboard','workbench']){await go(merchantPage,route);await merchantPage.locator('#business-view h2').first().waitFor();await layout(merchantPage,'merchant '+route);assert.equal(await merchantPage.locator('#business-view .business-error').count(),0);}
  await go(page,'agent');await page.locator('#business-ask textarea').fill('油纸伞怎么制作？');await page.locator('#business-ask [type=submit]').click();await page.locator('.rag-sources li').first().waitFor();assert.match(await page.locator('.rag-message .answer').innerText(),/制骨/);await page.screenshot({path:path.join(output,'desktop-knowledge.png')});
  await go(page,'scan?point=craft-umbrella');await page.locator('.qr-code svg').waitFor();await page.locator('#business-task input[value="制骨"]').check();await page.locator('#business-task [type=submit]').click();await page.getByText(/回答正确/).waitFor();await page.screenshot({path:path.join(output,'desktop-qr.png')});
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});await mobile.addInitScript(()=>localStorage.setItem('songji-analytics-consent','no'));const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));
  for(const route of ['home','photos','sights','food','heritage','shop','routes','guide','foundation','live','agent','scan?point=craft-umbrella','account','booking','digital']) {await go(mp,route);await layout(mp,'mobile '+route);}
  const glbPage=async(p,prefix)=>{
    await go(p,'digital');await p.locator(`[data-asset="${assets['display-glb']}"]`).click();await p.waitForFunction(()=>document.querySelector('model-viewer')?.loaded,{},{timeout:30000});await p.waitForTimeout(1000);await layout(p,prefix+' glb');assert.ok((await p.locator('.asset-scene').boundingBox()).width<=p.viewportSize().width);await pixels(p.locator('.asset-scene'),prefix+'-glb');
    const before=await p.locator('.asset-scene').screenshot();await p.locator('model-viewer').evaluate(v=>{v.cameraOrbit='110deg 70deg auto';v.jumpCameraToGoal();});await p.waitForTimeout(350);const after=await p.locator('.asset-scene').screenshot();assert.notDeepEqual(before,after);report.push(prefix+' GLB visible and camera interaction changes pixels');
  };
  const splatPage=async(p,prefix)=>{
    await go(p,'digital');await p.locator(`[data-asset="${assets.gaussian}"]`).click();const frame=p.frameLocator('#asset-scene iframe');await frame.locator('#status').filter({hasText:'3DGS实景已加载'}).waitFor({timeout:45000});await p.waitForTimeout(700);await layout(p,prefix+' splat');await pixels(p.locator('.asset-scene'),prefix+'-splat');
    const box=await p.locator('.asset-scene').boundingBox(),before=await p.locator('.asset-scene').screenshot();await p.mouse.move(box.x+box.width*.4,box.y+box.height*.45);await p.mouse.down();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:12});await p.mouse.up();await p.waitForTimeout(500);assert.notDeepEqual(before,await p.locator('.asset-scene').screenshot());report.push(prefix+' Gaussian visible and rotation changes pixels');
  };
  await glbPage(page,'desktop');await splatPage(page,'desktop');await glbPage(mp,'mobile');await splatPage(mp,'mobile');
  await go(mp,'digital');await mp.locator(`[data-asset="${assets.hbim}"]`).click();await mp.getByText('TEST-COLUMN · TEST column',{exact:true}).waitFor();await layout(mp,'mobile HBIM');await mp.screenshot({path:path.join(output,'mobile-archive.png'),fullPage:true});report.push('HBIM structured archive renders actual registered fields in isolated test');
  await go(mp,'home');await mp.screenshot({path:path.join(output,'mobile-home.png')});
  await go(mp,'scan?point=craft-umbrella');await mp.locator('.qr-code svg').waitFor();await mp.screenshot({path:path.join(output,'mobile-qr.png'),fullPage:true});
  assert.deepEqual(errors,[]);report.push('No uncaught page errors');
  console.log(JSON.stringify(report,null,2));
  await fs.writeFile(path.join(output,'browser-report.json'),JSON.stringify({testedAt:now(),isolatedFixtures:true,report,errors,limitations:['AR requires physical supported device and HTTPS; not tested on handset.','Synthetic renderer fixtures are not Songgai 3DGS/HBIM deliverables.']},null,2));
} finally {
  await browser?.close();await app.close();await fs.rm(directory,{recursive:true,force:true});
}
