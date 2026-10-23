'use strict';

const SERVICE_KEY = 'services-v1';
const experienceOptions = [
  {id:'p9', duration:'60–90 分钟', location:'非遗街附近，具体作坊与集合点待确认', image:'umbrella-1', craft:'umbrella'},
  {id:'p10', duration:'30–45 分钟', location:'古镇手作空间，具体作坊与集合点待确认', image:'bamboo-1', craft:'bamboo'}
];
const routeSights = {family:['luo'],team:['county'],couple:['kuixing'],wellness:[]};
const emptyServiceState = () => ({plan:[],records:[],providers:{}});
function readServiceState() {
  const raw=load(SERVICE_KEY,null);
  if(!raw || typeof raw!=='object')return emptyServiceState();
  return {
    plan:Array.isArray(raw.plan)?[...new Set(raw.plan.filter(id=>sights.some(s=>s.id===id)))]:[],
    records:Array.isArray(raw.records)?raw.records.filter(r=>r&&typeof r.id==='string'&&['experience','purchase','inquiry'].includes(r.kind)&&['saved','contacted','cancelled','archived'].includes(r.status)&&Number.isFinite(r.total)&&r.total>=0&&Array.isArray(r.lines)).slice(0,200):[],
    providers:raw.providers && typeof raw.providers==='object'?raw.providers:{},
  };
}
let serviceState=readServiceState();
let recordFilter='all';
function commitServices(change) {
  const next=JSON.parse(JSON.stringify(serviceState));
  change(next);
  if(!save(SERVICE_KEY,next))return false;
  serviceState=next;
  return true;
}
const money=n=>`¥${Number(n).toFixed(2)}`;
const chinaToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const serviceTime=iso=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
const statusText=r=>({saved:'未发送 · 待联系',contacted:'已联系（手动记录）',cancelled:'已取消',archived:'已归档'}[r.status]);
const kindText=r=>({experience:'体验意向',purchase:'购买意向',inquiry:'咨询记录'}[r.kind]);
const serviceId=()=>`SG-${Date.now().toString(36).toUpperCase()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,5).toUpperCase()}`;
function addServiceRecord(record) {
  if(serviceState.records.length>=200){toast('本机记录已达 200 条，请导出并删除旧记录后再保存');return false;}
  return commitServices(state=>state.records.unshift({id:serviceId(),created:new Date().toISOString(),status:'saved',simulation:'waiting',...record}));
}
function pageJump(page) {
  closeDialogs();
  if(location.hash==='#'+page)render();else location.hash=page;
}
function showLinkedSight(id) {
  const s=sights.find(x=>x.id===id);if(!s)return;
  $('#detail-dialog').classList.remove('lightbox');
  $('#detail-content').innerHTML=`<img class="detail-image" src="${asset(s.image)}" alt="${safe(s.caption)}"><div class="detail-body"><span class="eyebrow">${s.type} · 松溉文化遗存</span><h2>${s.name}</h2><p class="caption">${s.caption}</p><p>${s.detail}</p><p class="notice">${s.tip}</p>${s.source!==null?`<a class="source-link" href="${SOURCES[s.source].url}" target="_blank" rel="noopener">资料依据：${SOURCES[s.source].publisher} ${icon('arrow-up-right')}</a>`:''}<div class="action-row"><button class="btn small" data-plan-add="${s.id}" ${serviceState.plan.includes(s.id)?'disabled':''}>${icon('map-plus')}${serviceState.plan.includes(s.id)?'已加入游线':'加入我的游线'}</button><a class="text-btn" href="#visit" data-close>出行信息 ${icon('arrow-right')}</a></div></div>`;
  openDialog($('#detail-dialog'));
}
function myPlanMarkup() {
  return `<section class="service-band wrap" id="my-plan"><span class="eyebrow">MY SONGJI WALK</span><h2>我的自选游线</h2><p>已选 ${serviceState.plan.length} 处景点 · 按你的步调，安排古镇一日。</p>${serviceState.plan.length?`<ol class="plan-list">${serviceState.plan.map((id,i)=>{const s=sights.find(x=>x.id===id);return `<li><button class="text-btn plan-name" data-sight="${id}">${s.name}</button><div class="plan-controls"><button class="icon-btn" data-plan-move="${id}" data-direction="-1" title="上移${s.name}" aria-label="上移${s.name}" ${i===0?'disabled':''}>${icon('arrow-up')}</button><button class="icon-btn" data-plan-move="${id}" data-direction="1" title="下移${s.name}" aria-label="下移${s.name}" ${i===serviceState.plan.length-1?'disabled':''}>${icon('arrow-down')}</button><button class="icon-btn" data-plan-remove="${id}" title="移除${s.name}" aria-label="移除${s.name}">${icon('x')}</button></div></li>`;}).join('')}</ol><div class="action-row"><button class="btn small" data-export-plan>${icon('download')}导出自选游线</button><a class="btn secondary small" href="#heritage">${icon('paintbrush')}搭配手作体验</a></div>`:`<div class="record-empty">${icon('route')}还没有选定的景点。<div class="action-row"><a class="btn small" href="#sights">挑选景点 ${icon('arrow-right')}</a></div></div>`}<p class="caption">顺序由你安排，非自动导航；步行距离、坡度与开放情况请以现场为准。</p></section>`;
}
function routeConnectionsMarkup() {
  return `<section class="service-band wrap"><span class="eyebrow">FROM PLANS TO EXPERIENCES</span><h2>把喜欢的行程带上</h2><div class="action-row">${routes.map(r=>`<button class="btn secondary small" data-adopt-route="${r.id}">${icon(r.icon)}收藏${r.name}游线景点</button>`).join('')}</div><p class="caption">收藏各主题明确关联的文化景点；康养路线以老街休闲为主，可自行选点。完整时间安排仍见上方主题游线。</p><div class="action-row"><button class="text-btn" data-book="p9">油纸伞体验 ${icon('arrow-right')}</button><button class="text-btn" data-book="p10">植物编织体验 ${icon('arrow-right')}</button><a class="text-btn" href="#shop">挑选伴手礼 ${icon('arrow-right')}</a><a class="text-btn" href="#visit">出行服务 ${icon('arrow-right')}</a></div></section>`;
}
function experienceMarkup() {
  return `<section class="service-band wrap" id="experiences"><span class="eyebrow">A LITTLE TIME FOR CRAFT</span><h2>留一段时间，亲手做</h2><p>体验意向仅保存在本机，费用、场地与接待能力须另向经营者确认。</p><div class="experience-list">${experienceOptions.map(x=>{const p=products.find(p=>p.id===x.id);return `<article class="experience-item"><img src="${asset(x.image)}" alt="${p.name}工艺参考图，非已合作作坊" loading="lazy"><span class="status-label">合作方待确认</span><h3>${p.name}</h3><dl><dt>建议时长</dt><dd>${x.duration}</dd><dt>计划地点</dt><dd>${x.location}</dd><dt>参考费用</dt><dd>${money(p.price)} / 人，非商家报价</dd><dt>适合人群</dt><dd>${x.id==='p9'?'亲子、情侣与研学小组':'亲子、朋友与传统手艺爱好者'}；儿童需成人陪同</dd><dt>经营者联系</dt><dd>暂无经核实的预约渠道，尚未开放正式预约</dd></dl><div class="action-row"><button class="btn small" data-book="${p.id}">${icon('calendar-plus')}记录预约意向</button><a class="text-btn" href="#photos" data-close>古镇实景 ${icon('images')}</a></div></article>`;}).join('')}</div></section>`;
}
function showBooking(id) {
  const x=experienceOptions.find(x=>x.id===id),p=products.find(p=>p.id===id);if(!x||!p)return;
  $('#detail-dialog').classList.remove('lightbox');$('#detail-dialog').classList.add('service-dialog');
  $('#detail-content').innerHTML=`<div class="detail-body"><span class="eyebrow">A CRAFT TO REMEMBER</span><h2>${p.name}</h2><dl class="facts-list"><dt>建议时长</dt><dd>${x.duration}</dd><dt>计划地点</dt><dd>${x.location}</dd><dt>经营者</dt><dd>待确认 · 尚未提供正式预约与支付</dd></dl><form id="booking-form" class="service-form" data-product="${id}"><div class="field-row"><div class="form-group"><label for="book-date">意向日期</label><input id="book-date" name="date" type="date" min="${chinaToday()}" required></div><div class="form-group"><label for="book-time">意向时段</label><select id="book-time" name="slot"><option value="morning">上午（时间待确认）</option><option value="afternoon">下午（时间待确认）</option></select></div></div><div class="field-row"><div class="form-group"><label for="book-count">参与人数（1–20 人）</label><input id="book-count" name="count" type="number" min="1" max="20" step="1" value="1" required></div><div class="form-group"><label for="book-name">称呼（选填）</label><input id="book-name" name="nickname" maxlength="30" autocomplete="nickname" placeholder="怎么称呼你"></div></div><div class="form-group"><label for="book-note">备注（选填，最多 200 字）</label><textarea id="book-note" name="note" maxlength="200" placeholder="例如儿童人数、材料偏好"></textarea></div><div class="booking-total"><span>参考合计 · 未付款</span><strong id="booking-amount">${money(p.price)}</strong></div><label class="consent"><input type="checkbox" name="consent" required><span>我已知晓这只是本机意向记录，不会通知商家或保留名额。日期、费用与地点均需另行确认。</span></label><button class="btn" type="submit">${icon('save')}保存预约意向</button><div id="booking-error" role="alert"></div></form></div>`;
  openDialog($('#detail-dialog'));
}
function renderVisit() {
  const map='https://uri.amap.com/search?keyword='+encodeURIComponent('松溉古镇')+'&city='+encodeURIComponent('重庆');
  const facilities=[['car-front','停车','停车场入口、车位与收费暂未核实。请以导航平台实时信息和现场指引为准。'],['accessibility','台阶与通行','古镇依山临江，古县衙等节点涉及高差。石板路雨天易滑；推车、轮椅出行前需确认可行路段。'],['map-pin','公共厕所','暂无已核验的厕所点位和开放时间，抵达后请查看景区导览牌或询问现场工作人员。'],['armchair','休息点与饮水','老街茶馆等可作为休息选择；营业、消费要求、饮水设施和无障碍设施待核实。']];
  return heading('出行服务','BEFORE YOUR SONGJI DAY','带上计划，也为江边的一天留出从容。')+`<section class="page-content wrap"><div class="travel-grid"><article class="travel-item"><h2>${icon('navigation')}怎么到达</h2><p>目的地：重庆市永川区松溉镇，松溉古镇。自驾可使用地图实时规划，返程班次与路况请出发前再次确认。</p><a class="btn small" href="${map}" target="_blank" rel="noopener">${icon('map-pin')}导航到松溉古镇</a><p>公共交通：暂不提供未经核实的线路号、票价和末班时间。请向当地客运站或运营方核对当日班次。</p></article><article class="travel-item"><h2>${icon('clock-3')}开放与费用</h2><span class="status-label">建筑开放时间、收费待核实</span><p>古镇街区与院落、庙观的可进入范围可能不同；不将街区可通行等同于各建筑全天开放。活动和手作接待请单独确认。</p><a class="text-btn" href="${SOURCES[0].url}" target="_blank" rel="noopener">官方景区资料 ${icon('external-link')}</a><p class="caption">该资料用于景区介绍，不作为实时营业公告。</p></article>${facilities.map(([ic,title,desc])=>`<article class="travel-item"><h2>${icon(ic)}${title}</h2><p>${desc}</p><span class="status-label ${title==='台阶与通行'?'neutral':''}">${title==='台阶与通行'?'通行提示 · 非无障碍承诺':'设施位置待现场核实'}</span></article>`).join('')}</div><p class="notice">临江观景请在开放公共区域内活动，勿翻越护栏、下到滩涂或进入未开放建筑。紧急求助：110 / 120 / 119。资料整理：2026 年 10 月 17 日，设施实时状态以现场为准。</p><div class="action-row"><a class="btn secondary" href="#routes">${icon('route')}安排游线</a><a class="text-btn" href="#contact">反馈设施信息 ${icon('arrow-right')}</a></div></section>`;
}
function recordDetails(r) {
  return `${r.lines.map(l=>`${l.name} × ${l.quantity}`).join('、')}${r.date?` · ${r.date} ${r.slot==='morning'?'上午':'下午'}`:''}`;
}
function renderRecords() {
  const list=serviceState.records.filter(r=>recordFilter==='all'||r.kind===recordFilter);
  return heading('我的行程','YOUR SONGJI, KEPT CLOSE','把想去的地方与想做的手作，留在同一份计划里。')+myPlanMarkup()+`<section class="service-band wrap"><h2>我的意向记录</h2><p class="notice">记录仅保存在当前浏览器，不会发送至景区或商家。换浏览器、切换访问地址或清除浏览器数据后不会自动同步；可导出留存。正式预约、下单与付款尚未接入。</p><div class="filter-group">${[['all','全部'],['experience','体验意向'],['purchase','购买意向'],['inquiry','咨询记录']].map(([id,label])=>`<button class="filter-btn ${recordFilter===id?'active':''}" aria-pressed="${recordFilter===id}" data-record-filter="${id}">${label}</button>`).join('')}</div><div class="record-list">${list.length?list.map(r=>`<article class="record-item"><div class="record-top"><div><span class="record-id">${safe(r.id)} · ${kindText(r)}</span><h3>${safe(r.title)}</h3></div><span class="status-label ${r.status==='cancelled'?'neutral':''}">${statusText(r)}</span></div><p>${safe(recordDetails(r))}<br>${serviceTime(r.created)} 保存 · 参考金额 ${money(r.total)} · 未付款</p>${r.note?`<p>备注：${safe(r.note)}</p>`:''}<p>供给方：${safe(r.provider||'待确认')} · ${r.simulation==='completed'?'已标记演示履约，非实际成交':'尚未形成正式订单'}</p><div class="action-row"><button class="text-btn" data-record-export="${safe(r.id)}">导出记录 ${icon('download')}</button>${['saved','contacted'].includes(r.status)?`<button class="text-btn" data-record-cancel="${safe(r.id)}">取消意向 ${icon('x')}</button>`:`<button class="text-btn" data-record-delete="${safe(r.id)}">删除本机记录 ${icon('trash-2')}</button>`}</div></article>`).join(''):`<div class="record-empty">${icon('notebook-pen')}暂无${recordFilter==='all'?'':{experience:'体验意向',purchase:'购买意向',inquiry:'咨询'}}记录<div class="action-row"><a class="btn small" href="#heritage">看看手作体验 ${icon('arrow-right')}</a><a class="text-btn" href="#shop">逛逛古镇好物 ${icon('arrow-right')}</a></div></div>`}</div></section>`;
}
function renderOperations() {
  const active=serviceState.records.filter(r=>!['cancelled','archived'].includes(r.status));
  const simulated=active.filter(r=>r.simulation==='completed').reduce((n,r)=>n+r.total,0);
  const inquiry=serviceState.records.filter(r=>r.kind==='inquiry').length+(lastFeedback?1:0);
  const provider=serviceState.providers.local||{};
  return heading('本地管理台账','SONGJI OPERATIONS','意向、供给与模拟结算，逐项留痕。')+`<section class="page-content wrap"><p class="notice">本机演示管理页，无管理员鉴权、多人同步或真实商家连接。同一浏览器可查看、修改这里的数据，请勿录入敏感信息。模拟履约与待结算金额不代表真实经营成果，实际到账保持为 0。</p><div class="operations-tabs"><a href="#operations" data-ops-scroll="ops-records">意向记录</a><a href="#operations" data-ops-scroll="ops-provider">供给方资料</a><a href="#operations" data-ops-scroll="ops-ledger">助农台账</a><a href="#contact">游客意见（${inquiry}）</a></div><div class="metrics"><div class="metric"><span>有效意向</span><strong>${active.length}</strong><small>非正式订单</small></div><div class="metric"><span>意向参考总额</span><strong>${money(active.reduce((n,r)=>n+r.total,0))}</strong><small>非成交金额</small></div><div class="metric"><span>模拟待结算</span><strong>${money(simulated)}</strong><small>演示履约金额</small></div><div class="metric"><span>实际到账</span><strong>¥0.00</strong><small>尚未接入真实结算</small></div></div><section class="service-band" id="ops-records"><h2>预约与购买意向</h2><div class="action-row"><button class="btn small" data-export-ledger>${icon('download')}导出台账 CSV</button><button class="btn secondary small" data-inquiry>${icon('message-square-plus')}记录咨询</button></div><div class="table-scroll"><table class="ledger-table"><caption class="sr-only">本机意向记录</caption><thead><tr><th>记录 / 时间</th><th>项目 / 供给方</th><th>参考金额</th><th>状态</th><th>处理</th></tr></thead><tbody>${serviceState.records.length?serviceState.records.map(r=>`<tr><td>${safe(r.id)}<small>${serviceTime(r.created)}</small></td><td>${safe(r.title)}<small>${safe(r.provider||'待确认')}</small></td><td>${money(r.total)}<small>非实收</small></td><td>${statusText(r)}<small>${r.simulation==='completed'?'演示履约':'未履约'}</small></td><td>${r.status==='saved'?`<button class="text-btn" data-record-contact="${safe(r.id)}">标记已联系</button>`:''}${r.status==='contacted'&&r.kind!=='inquiry'&&r.simulation!=='completed'?`<button class="text-btn" data-simulate="${safe(r.id)}">模拟履约</button>`:''}${['saved','contacted'].includes(r.status)?` <button class="text-btn" data-record-cancel="${safe(r.id)}">取消</button>`:`<button class="text-btn" data-record-delete="${safe(r.id)}">删除</button>`}</td></tr>`).join(''):'<tr><td colspan="5">暂无记录。游客保存意向后会显示于此。</td></tr>'}</tbody></table></div>${lastFeedback?`<p class="notice">最近游客意见：${safe(lastFeedback.type)} · ${safe(lastFeedback.message)}。仅保存在本机，尚未发送至景区。</p>`:''}</section><section class="service-band" id="ops-provider"><h2>供给方资料草稿</h2><p>供给方可为当地商户、农户或合作社。此草稿不会自动发布成合作商家，也不会向其发送预约。</p><form id="provider-form" class="service-form provider-form"><div class="form-group"><label for="provider-name">供给方名称</label><input id="provider-name" name="name" maxlength="60" value="${safe(provider.name||'')}" placeholder="待实地对接后填写" required></div><div class="form-group"><label for="provider-channel">公开联系渠道（选填）</label><input id="provider-channel" name="channel" maxlength="120" value="${safe(provider.channel||'')}" placeholder="已公开的商户联系渠道"></div><div class="form-group"><label for="provider-location">接待地点（选填）</label><input id="provider-location" name="location" maxlength="120" value="${safe(provider.location||'')}"></div><div class="form-group"><label for="provider-service">供给内容（选填）</label><input id="provider-service" name="service" maxlength="120" value="${safe(provider.service||'')}" placeholder="产品、手作体验、讲解等"></div><div class="provider-note"><span class="status-label">合作、资质、价格与结算约定待线下核验</span></div><div class="action-row"><button class="btn small" type="submit">${icon('save')}保存资料草稿</button><button class="text-btn" type="button" data-provider-clear>清除草稿 ${icon('trash-2')}</button></div><p id="provider-status" role="status"></p></form></section><section class="service-band" id="ops-ledger"><h2>助农收益台账</h2><p>记录意向参考金额与模拟履约金额。真实订单、成本、农户分配和结算凭证尚未接入，不据此计算实际助农收益。</p><dl class="facts-list"><dt>模拟待结算</dt><dd>${money(simulated)}（演示履约，非应付账款）</dd><dt>实际到账</dt><dd>¥0.00</dd><dt>结算通道</dt><dd>拟沿用既有商户或合作社通道，具体主体与约定待确认。</dd><dt>凭证状态</dt><dd>无真实付款、收货与收益分配凭证。</dd></dl></section></section>`;
}
function openInquiry() {
  $('#detail-dialog').classList.remove('lightbox');$('#detail-dialog').classList.add('service-dialog');
  $('#detail-content').innerHTML=`<div class="detail-body"><h2>记录咨询</h2><p class="notice">仅保存本机咨询备忘，不会发送给景区或商家。</p><form id="inquiry-form" class="service-form"><div class="form-group"><label for="inquiry-title">咨询主题</label><input id="inquiry-title" name="title" maxlength="60" required></div><div class="form-group"><label for="inquiry-note">咨询内容</label><textarea id="inquiry-note" name="note" maxlength="500" required></textarea></div><button class="btn" type="submit">${icon('save')}保存咨询</button></form></div>`;
  openDialog($('#detail-dialog'));
}
function providerAssignmentsMarkup() {
  const provider=serviceState.providers.local;
  if(!provider?.name)return '';
  const records=serviceState.records.filter(r=>['saved','contacted'].includes(r.status)&&r.kind!=='inquiry');
  return `<section class="service-band wrap"><h2>关联供给方草稿</h2><p>当前资料：${safe(provider.name)}。关联仅用于本机台账归类，合作关系、履约与结算仍需核验。</p>${records.length?records.map(r=>`<div class="record-item"><div class="record-top"><div><h3>${safe(r.title)}</h3><p>供给方：${safe(r.provider||'待确认')}</p></div><button class="btn secondary small" data-assign-provider="${safe(r.id)}">关联此草稿 ${icon('link')}</button></div></div>`).join(''):'<p>暂无可关联的有效意向。</p>'}</section>`;
}
function exportRecord(r) {
  download(`${r.id}-意向记录.txt`,`松溉古镇 · ${kindText(r)}\n编号：${r.id}\n保存时间：${serviceTime(r.created)}\n状态：${statusText(r)}\n${r.title}\n${recordDetails(r)}\n称呼：${r.nickname||'未填写'}\n备注：${r.note||'无'}\n参考金额：${money(r.total)}\n供给方：${r.provider||'待确认'}\n\n本记录未发送至商家，不代表已预约、下单或付款。`);
}
// Prefix formula-like cells so exported text cannot become a spreadsheet formula.
function csvCell(value) {
  let v=String(value??'');if(/^[\s]*[=+@-]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
}
function exportLedger() {
  const rows=[['编号','类型','保存时间','项目','意向日期','人数/数量','状态','供给方（未核验）','意向参考金额','模拟待结算','实际到账','备注']];
  serviceState.records.forEach(r=>rows.push([r.id,kindText(r),serviceTime(r.created),r.title,r.date||'',r.lines.reduce((n,l)=>n+l.quantity,0),statusText(r),r.provider||'待确认',r.total,['saved','contacted'].includes(r.status)&&r.simulation==='completed'?r.total:0,0,r.note||'']));
  download('松溉古镇-本机演示台账.csv',rows.map(row=>row.map(csvCell).join(',')).join('\r\n'));
  toast('已导出本机台账，金额均非实际收入');
}
function refreshServices() {render(false);}
document.addEventListener('click',event=>{
  const b=event.target.closest('button,a');if(!b)return;
  const d=b.dataset;
  if(d.planAdd){if(commitServices(s=>{if(!s.plan.includes(d.planAdd)&&sights.some(x=>x.id===d.planAdd))s.plan.push(d.planAdd);})){b.disabled=true;b.innerHTML=icon('check')+'已加入游线';icons();toast('已加入我的行程，刷新后仍保留');}}
  if(d.planRemove){if(commitServices(s=>s.plan=s.plan.filter(id=>id!==d.planRemove)))refreshServices();}
  if(d.planMove){const i=serviceState.plan.indexOf(d.planMove),j=i+Number(d.direction);if(i>=0&&j>=0&&j<serviceState.plan.length&&commitServices(s=>[s.plan[i],s.plan[j]]=[s.plan[j],s.plan[i]]))refreshServices();}
  if(d.adoptRoute){const ids=routeSights[d.adoptRoute];if(ids?.length){if(commitServices(s=>s.plan=[...new Set([...s.plan,...ids])])){refreshServices();$('#my-plan').scrollIntoView({block:'start'});toast('主题关联景点已加入自选游线');}}else toast('康养游线以老街休闲为主，可从景点页自行选点');}
  if(b.hasAttribute('data-export-plan'))download('松溉古镇-自选游线.txt',`我的松溉自选游线\n\n${serviceState.plan.map((id,i)=>{const s=sights.find(x=>x.id===id);return `${i+1}. ${s.name}\n${s.tip}`;}).join('\n\n')}\n\n顺序为自选安排，非地图导航；距离、交通、建筑开放情况以现场为准。`);
  if(d.book)showBooking(d.book);
  if(d.recordFilter){recordFilter=d.recordFilter;refreshServices();}
  if(d.recordExport){const r=serviceState.records.find(r=>r.id===d.recordExport);if(r)exportRecord(r);}
  const recordId=d.recordCancel||d.recordDelete||d.recordContact||d.simulate;
  if(recordId){const r=serviceState.records.find(r=>r.id===recordId);if(!r)return;
    if(d.recordCancel&&['saved','contacted'].includes(r.status)&&commitServices(s=>{const item=s.records.find(r=>r.id===recordId);item.status='cancelled';item.simulation='waiting';})){refreshServices();toast('已取消本机意向；此操作不会通知商家');}
    if(d.recordDelete&&['cancelled','archived'].includes(r.status)&&commitServices(s=>s.records=s.records.filter(r=>r.id!==recordId))){refreshServices();toast('本机记录已删除');}
    if(d.recordContact&&r.status==='saved'&&commitServices(s=>s.records.find(r=>r.id===recordId).status='contacted')){refreshServices();toast('仅手动标记已联系，未向商家发送消息');}
    if(d.simulate&&r.status==='contacted'&&r.kind!=='inquiry'&&commitServices(s=>s.records.find(r=>r.id===recordId).simulation='completed')){refreshServices();toast('已标记演示履约，实际到账仍为 0');}
  }
  if(d.assignProvider){const profile=serviceState.providers.local;if(profile?.name&&commitServices(s=>{const r=s.records.find(r=>r.id===d.assignProvider);if(r)r.provider=profile.name+'（资料草稿，待核验）';})){refreshServices();toast('已关联供给方草稿，仍需线下核验');}}
  if(b.hasAttribute('data-save-purchase')){
    const inCart=products.filter(p=>cart[p.id]);
    const entries=inCart.filter(p=>!experienceOptions.some(x=>x.id===p.id));
    if(!entries.length){const experience=inCart.find(p=>experienceOptions.some(x=>x.id===p.id));if(experience){closeDialogs();showBooking(experience.id);toast('手作体验需另选日期人数');}else toast('请先向购物袋添加商品');return;}
    const lines=entries.map(p=>({id:p.id,name:p.name,quantity:cart[p.id],price:p.price}));
    if(serviceState.records.some(r=>r.kind==='purchase'&&r.status==='saved'&&JSON.stringify(r.lines)===JSON.stringify(lines))){toast('相同购买意向已保存，请在我的行程查看');return;}
    if(addServiceRecord({kind:'purchase',title:entries.length===1?entries[0].name:`古镇好物 · ${entries.length} 款`,lines,total:lines.reduce((n,l)=>n+l.price*l.quantity,0),provider:'待对接商户 / 农户',note:''})){pageJump('records');toast('购买意向已保存，未生成订单或付款');}
  }
  if(b.hasAttribute('data-export-ledger'))exportLedger();
  if(b.hasAttribute('data-inquiry'))openInquiry();
  if(d.opsScroll){event.preventDefault();document.getElementById(d.opsScroll)?.scrollIntoView({block:'start',behavior:'smooth'});}
  if(b.hasAttribute('data-provider-clear')&&commitServices(s=>s.providers={})){refreshServices();toast('供给方草稿已清除');}
});
document.addEventListener('input',event=>{
  if(event.target.id==='book-count'){const p=products.find(p=>p.id===$('#booking-form').dataset.product);const n=Number(event.target.value);$('#booking-amount').textContent=Number.isInteger(n)&&n>=1&&n<=20?money(n*p.price):'请填 1–20 人';}
});
document.addEventListener('submit',event=>{
  const form=event.target;
  if(!['booking-form','provider-form','inquiry-form'].includes(form.id))return;
  event.preventDefault();const data=new FormData(form);
  if(form.id==='booking-form'){
    const p=products.find(p=>p.id===form.dataset.product),count=Number(data.get('count')),date=String(data.get('date')),slot=String(data.get('slot'));
    if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<chinaToday()||!Number.isInteger(count)||count<1||count>20||!['morning','afternoon'].includes(slot)||!data.has('consent')){$('#booking-error').textContent='请检查日期、人数和保存确认。';return;}
    if(serviceState.records.some(r=>r.kind==='experience'&&['saved','contacted'].includes(r.status)&&r.lines[0]?.id===p.id&&r.date===date&&r.slot===slot&&r.lines[0].quantity===count)){$('#booking-error').textContent='相同体验意向已保存，请在“我的行程”查看。';return;}
    if(addServiceRecord({kind:'experience',title:p.name,lines:[{id:p.id,name:p.name,quantity:count,price:p.price}],date,slot,total:count*p.price,nickname:String(data.get('nickname')||'').trim().slice(0,30),note:String(data.get('note')||'').trim().slice(0,200),provider:'体验合作方待确认'})){pageJump('records');toast('意向已保存在本机，未向商家发送预约');}
  }
  if(form.id==='provider-form'){
    const profile=Object.fromEntries(['name','channel','location','service'].map(key=>[key,String(data.get(key)||'').trim().slice(0,key==='name'?60:120)]));
    if(!profile.name){$('#provider-name').setCustomValidity('请填写供给方名称');$('#provider-name').reportValidity();$('#provider-name').setCustomValidity('');return;}
    if(commitServices(s=>s.providers.local=profile)){$('#provider-status').textContent='资料草稿已保存在本机，合作状态仍为待核验。';toast('供给方资料草稿已保存');}
  }
  if(form.id==='inquiry-form'){
    const title=String(data.get('title')||'').trim().slice(0,60),note=String(data.get('note')||'').trim().slice(0,500);if(!title||!note)return;
    if(addServiceRecord({kind:'inquiry',title,note,lines:[],total:0,provider:'待联系'})){pageJump('operations');toast('咨询已保存于本机，尚未发送');}
  }
});
window.addEventListener('storage',event=>{if(event.key==='songji-'+SERVICE_KEY){serviceState=readServiceState();if(['records','operations','routes'].includes(currentPage)&&!document.querySelector('dialog[open]'))refreshServices();}});

renderers.visit=renderVisit;
renderers.records=renderRecords;
renderers.operations=()=>renderOperations()+providerAssignmentsMarkup();
renderers.home=()=>{
  const original=renderHome();const end=original.indexOf('</section>')+10;
  return original.slice(0,end)+`<div class="wrap quick-links"><a href="#visit">${icon('navigation')}出行服务</a><a href="#routes">${icon('route')}挑选游线</a><a href="#heritage">${icon('paintbrush')}手作体验</a><a href="#records">${icon('notebook-pen')}我的行程</a></div>`+original.slice(end);
};
renderers.routes=()=>renderRoutes().replace('<section class="page-content wrap">','<section class="page-content wrap"><div class="action-row route-plan-entry"><a class="btn small" href="#guide">按二维码查看智慧导览 '+icon('qr-code')+'</a><button class="text-btn" data-scroll="my-plan">查看我的自选游线 '+icon('arrow-down')+'</button><a class="text-btn" href="#records">我的意向记录 '+icon('notebook-pen')+'</a></div>')+routeConnectionsMarkup()+myPlanMarkup();
renderers.heritage=()=>renderHeritage().replace('<section class="page-content wrap">','<section class="page-content wrap"><div class="action-row route-plan-entry"><button class="text-btn" data-scroll="experiences">记录手作体验意向 '+icon('calendar-plus')+'</button><a class="text-btn" href="#records">我的预约意向 '+icon('arrow-right')+'</a></div>')+experienceMarkup();
renderers.shop=()=>renderShop().replace('目前不提供在线下单、付款或体验预约。','目前不提供在线下单与付款；体验意向可在下方单独保存，尚未向商家发出预约。').replace('<section class="page-content wrap">','<section class="page-content wrap"><div class="action-row route-plan-entry"><button class="text-btn" data-scroll="experiences">手作体验 · 选择日期人数 '+icon('calendar-plus')+'</button><a class="text-btn" href="#records">我的购买意向 '+icon('arrow-right')+'</a></div>')+experienceMarkup();
function updateServiceTitle() {
  const title={visit:'出行服务',records:'我的行程',operations:'本地管理台账'}[currentPage];
  if(title)document.title=title+' · 云览松溉 数启乡兴';
  $('#detail-dialog').classList.remove('service-dialog');
}
window.addEventListener('hashchange',updateServiceTitle);
installPhotoFeatures();
installFoodFeatures();
render(false);updateServiceTitle();
