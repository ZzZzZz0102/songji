import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const state=JSON.parse(await fs.readFile(path.join(root,'data/public-demo.json'),'utf8'));
const base=state.url;
assert.match(base,/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/);
const healthResponse=await fetch(base+'/api/health',{signal:AbortSignal.timeout(30000)});
assert.equal(healthResponse.status,200);const health=await healthResponse.json();assert.equal(health.publicOrigin,base);assert.equal(health.ragConfigured,true);
for(const route of ['/.env','/data/songgai.sqlite','/tools/public-demo.mjs'])assert.equal((await fetch(base+route)).status,404);
const badOrigin=await fetch(base+'/api/logout',{method:'POST',headers:{Origin:'https://unrelated.example','X-Songgai-Request':'1','Content-Type':'application/json'},body:'{}'});assert.equal(badOrigin.status,403);
const initial=await fs.readFile(path.join(root,'data/initial-admin.txt'),'utf8');
const username=initial.match(/^Username: (.+)$/m)?.[1].trim(),password=initial.match(/^Password: (.+)$/m)?.[1].trim();
assert.ok(username && password,'Initial admin credentials are needed for this isolated browser check.');
const require=createRequire(import.meta.url),bundled='C:/Users/hexinyi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || bundled+'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const output=path.join(root,'test-results');await fs.mkdir(output,{recursive:true});
const errors=[],report={url:base,checkedAt:new Date().toISOString(),https:true,privateFilesBlocked:true,crossOriginPostBlocked:true};
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('songji-analytics-consent','no'));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#home',{timeout:60000});await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0,null,{timeout:40000});
  report.video=await page.locator('video').evaluate(v=>({width:v.videoWidth,loop:v.loop,muted:v.muted,playing:!v.paused}));assert.ok(report.video.playing && report.video.loop);
  await page.screenshot({path:path.join(output,'public-home-desktop.png')});
  await page.goto(base+'/#account');await page.locator('#business-login').waitFor();
  await page.locator('#business-login [name=username]').fill(username);await page.locator('#business-login [name=password]').fill(password);await page.locator('#business-login [type=submit]').click();await page.waitForURL('**/#workbench');
  const cookie=(await context.cookies(base)).find(c=>c.name==='sg_session');assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite==='Strict');report.secureSessionCookie=true;
  await page.goto(base+'/#agent');await page.locator('#business-ask textarea').fill('油纸伞有哪些制作步骤？');await page.locator('#business-ask [type=submit]').click();await page.locator('.rag-message').waitFor({timeout:40000});
  const mode=await page.locator('.rag-message .caption').first().innerText();assert.match(mode,/大模型依据检索资料生成/);report.agent={mode:'rag',sources:await page.locator('.rag-sources li').count()};assert.ok(report.agent.sources>0);
  await page.screenshot({path:path.join(output,'public-agent-desktop.png'),fullPage:true});
  await page.goto(base+'/#scan?point=craft-umbrella');await page.locator('.qr-code svg').waitFor();const qrUrl=await page.locator('.qr-url').innerText();assert.ok(qrUrl.startsWith(base+'/#scan?point='));report.publicQR=true;
  await page.goto(base+'/#account');await page.locator('[data-business-logout]').click();await page.locator('#business-login').waitFor();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});await mobile.addInitScript(()=>localStorage.setItem('songji-analytics-consent','no'));const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));
  for(const route of ['home','food','guide','booking','agent','scan?point=craft-umbrella']) {
    await mp.goto(base+'/#'+route,{timeout:60000});await mp.waitForTimeout(250);
    if(route.startsWith('scan'))await mp.locator('.qr-code svg').waitFor();
    assert.ok(await mp.locator('#main').innerText());assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await mp.screenshot({path:path.join(output,'public-qr-mobile.png'),fullPage:true});report.mobilePages=true;
  assert.deepEqual(errors,[]);report.uncaughtErrors=errors;
  await fs.writeFile(path.join(output,'public-demo-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
