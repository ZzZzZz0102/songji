/* Shared business services use the server; earlier local drafts remain separately accessible. */
(() => {
  'use strict';
  let savedConsent='';try{savedConsent=localStorage.getItem('songji-analytics-consent') || '';}catch{}
  const state={user:null,health:null,catalog:null,assets:[],loaded:false,error:'',activeAsset:null,chat:[],busy:false,consent:savedConsent,requestKey:null};
  const statusNames={pending:'待商户确认',confirmed:'商户已确认',declined:'商户未接受',cancelled:'已取消',expired:'超时未确认',completed:'已履约'};
  const ledgerNames={receipt:'收款',refund:'退款',payout:'产品 / 体验到户款',labor:'到户劳务费',cost:'业务成本'};
  let renderVersion=0,lastEventPage='',pollTimer,voiceRecognition=null;
  const voiceState={mode:null,active:false,recorder:null,chunks:[],startedAt:0,timer:null};
  const esc=safe,fmt=c=>money(c/100),time=v=>serviceTime(v),param=k=>new URLSearchParams((location.hash.split('?')[1] || '')).get(k);
  const errorBox=e=>`<p class="business-error" role="alert">${esc(e.message || e)}</p>`;
  const empty=(title,body)=>`<div class="business-empty"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
  const go=value=>{closeDialogs();if(location.hash===`#${value}`)render(false);else location.hash=value;};
  const page=(title,en,desc,html)=>heading(title,en,desc)+`<section class="page-content wrap business-content">${html}</section>`;
  const api=async(url,options={})=>{
    const headers={'X-Songgai-Request':'1',...options.headers};
    let payload=options.body;
    if(payload && !(payload instanceof File) && !(payload instanceof Blob)){headers['Content-Type']='application/json';payload=JSON.stringify(payload);}
    const response=await fetch(url,{credentials:'same-origin',...options,headers,body:payload});
    const value=await response.json();
    if(!response.ok)throw Object.assign(new Error(value.error || '服务暂不可用'),{status:response.status});
    return value;
  };
  async function upload(file) {
    if(!file?.size)throw new Error('请选择文件');
    return api('/api/files',{method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name)},body:file});
  }
  const authPrompt=()=>empty('登录后继续','使用同一账号登录，可在不同设备查看预约、商户回复和任务记录。')+`<a class="btn" href="#account">${icon('log-in')}登录 / 注册</a>`;
  const loader=()=>!state.loaded?'<p class="business-loading" role="status">正在连接业务服务…</p>':state.error?errorBox(state.error):'';
  const formMessage=(form,message,bad=false)=>{const el=form.querySelector('[data-form-status]');if(el){el.textContent=message;el.className=bad?'wide business-error':'wide business-status';}};
  const submitButtons=(form,busy)=>form.querySelectorAll('[type=submit]').forEach(b=>b.disabled=busy);
  function downloadBlob(filename,content,type='application/json') {
    const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function navigation() {
    return `<nav class="business-tabs" aria-label="业务工作台"><a href="#workbench" ${currentPage==='workbench'?'aria-current="page"':''}>预约与回复</a>${state.user?.role!=='visitor'?`<a href="#finance" ${currentPage==='finance'?'aria-current="page"':''}>凭证与核算</a><a href="#dashboard" ${currentPage==='dashboard'?'aria-current="page"':''}>运营记录</a>`:''}${state.user?.role==='admin'?`<a href="#admin" ${currentPage==='admin'?'aria-current="page"':''}>商户管理</a><a href="#asset-admin" ${currentPage==='asset-admin'?'aria-current="page"':''}>资产管理</a>`:''}</nav>`;
  }
  const workShell=(title,en,desc)=>page(title,en,desc,`${loader()}${state.user?`<div class="business-toolbar">${navigation()}<button class="text-btn" data-business-refresh>${icon('refresh-cw')}刷新</button></div><div id="business-view" aria-live="polite"><p class="business-loading">读取记录…</p></div>`:state.loaded?authPrompt():''}`);

  function renderAccount() {
    if(state.user)return page('我的账号','ACCOUNT / CONNECTED SERVICES','管理预约、商户回复和跨设备任务记录。',`<h2>${esc(state.user.displayName)}</h2><p>${esc(state.user.username)} · ${{visitor:'游客',merchant:'商户',admin:'平台管理员'}[state.user.role]}</p><div class="action-row"><a class="btn" href="#workbench">${icon('inbox')}进入工作台</a><a class="text-btn" href="#booking">查看可预约体验 ${icon('arrow-right')}</a><button class="text-btn" data-business-logout>${icon('log-out')}退出登录</button></div><section class="business-section"><h3>修改密码</h3><form id="business-password" class="business-form"><label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" required minlength="12" maxlength="128"></label><label>新密码<input name="newPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></label><p data-form-status class="wide" role="status"></p><div class="wide"><button class="btn secondary" type="submit">${icon('key-round')}修改并重新登录</button></div></form></section><section class="business-section"><h3>访问统计选择</h3><p>当前：${state.consent==='yes'?'允许记录页面访问':'不记录页面访问'}。业务办理仍保留必要记录。</p><button class="text-btn" data-consent="${state.consent==='yes'?'no':'yes'}">${state.consent==='yes'?'关闭访问统计':'允许访问统计'}</button></section>`);
    return page('登录与注册','ACCOUNT / SONGGAI','预约与商户回复保存在业务服务器。',`${loader()}<div class="business-split"><section><h2>登录</h2><form id="business-login" class="business-form"><label class="wide">账号<input name="username" required autocomplete="username" pattern="(?:[a-zA-Z0-9_]|-){3,40}" maxlength="40"></label><label class="wide">密码<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="current-password"></label><p data-form-status class="wide" role="status"></p><div class="wide"><button class="btn" type="submit">${icon('log-in')}登录</button></div></form></section><section><h2>创建游客账号</h2><form id="business-register" class="business-form"><label class="wide">称呼<input name="displayName" required maxlength="40" autocomplete="nickname"></label><label class="wide">账号<input name="username" required pattern="(?:[a-zA-Z0-9_]|-){3,40}" maxlength="40" autocomplete="username" placeholder="字母、数字、下划线，至少3位"></label><label class="wide">密码<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="至少12个字符"></label><label class="wide check-label"><input type="checkbox" required><span>同意为预约与任务保存账号及办理记录。预约备注不填写身份证、银行卡等资料。</span></label><p data-form-status class="wide" role="status"></p><div class="wide"><button class="btn secondary" type="submit">${icon('user-plus')}注册</button></div></form></section></div><p class="caption">商户账号由平台核对经营主体后开通。未设置找回密码渠道，请妥善保管账号。</p>`);
  }

  function renderBooking() {
    const offers=state.catalog?.offerings || [],selected=offers.find(o=>o.id===param('offering'));
    let content=loader();
    if(state.loaded && !state.error)content+=selected?bookingForm(selected):offers.length?`<div class="offering-list">${offers.map(o=>`<article class="offering-item"><span class="caption">${esc(o.merchant_name)}</span><h3>${esc(o.title)}</h3><p>${esc(o.description)}</p><p class="business-status">${esc(o.location)}<br>${esc(o.contact)}</p><strong class="offering-price">${fmt(o.price_cents)} / 人</strong><div class="action-row"><a class="btn small" href="#booking?offering=${encodeURIComponent(o.id)}">${icon('calendar-plus')}选择日期</a><a class="text-btn" href="#scan?point=${encodeURIComponent(o.point_id)}">点位资料 ${icon('arrow-right')}</a></div></article>`).join('')}</div>`:empty('暂无已开放的商户课程','经营主体确认并发布课程后，可在此提交预约。原有手作介绍与本机草稿仍可浏览。')+'<a class="text-btn" href="#heritage">查看古镇手艺 '+icon('arrow-right')+'</a>';
    return page('体验预约','EXPERIENCES / BOOKING','选择课程与时段，提交后由对应商户确认。',content);
  }
  function bookingForm(o) {
    if(!state.user)return authPrompt()+`<p><a href="#booking">返回课程列表</a></p>`;
    if(state.user.role!=='visitor')return empty('请使用游客账号预约','商户与平台账号用于办理业务；游客预约使用独立游客账号。');
    return `<a class="text-btn" href="#booking">${icon('arrow-left')}全部课程</a><section class="business-section"><h2>${esc(o.title)}</h2><p>${esc(o.merchant_name)} · ${esc(o.location)}</p><p>${esc(o.description)}</p><p>${fmt(o.price_cents)} / 人 · 商户联系：${esc(o.contact)}</p><form id="business-booking" data-offering="${esc(o.id)}" class="business-form"><label>日期<input id="online-book-date" type="date" name="date" min="${chinaToday()}" max="${new Date(Date.now()+180*86400000).toISOString().slice(0,10)}" required></label><label>时段<select name="slot" id="online-book-slot" required><option value="">先选择日期</option></select></label><label>人数<input name="count" type="number" min="1" max="20" value="1" required></label><div><span>单人费用</span><p>${fmt(o.price_cents)}</p></div><label class="wide">备注（选填）<textarea name="note" maxlength="500" placeholder="接待需求或需要向商户确认的问题"></textarea></label><label class="wide check-label"><input type="checkbox" name="consent" required><span>将本次预约发送给上述商户。名额以商户确认结果为准，费用线下协商支付，提交预约不会扣款。待确认预约24小时未处理会自动失效。</span></label><p data-form-status class="wide" role="status"></p><div class="wide action-row"><button class="btn" type="submit">${icon('send')}发送给商户</button><a class="text-btn" href="#workbench">我的预约</a></div></form></section>`;
  }
  async function availability() {
    const form=$('#business-booking'),date=$('#online-book-date')?.value,slot=$('#online-book-slot');if(!form || !date)return;
    slot.disabled=true;
    try {const value=await api(`/api/availability?offering=${encodeURIComponent(form.dataset.offering)}&date=${date}`);slot.innerHTML=value.slots.map(s=>`<option value="${esc(s.slot)}" ${s.remaining<1?'disabled':''}>${esc(s.slot)} · 剩余 ${s.remaining} 位</option>`).join('');formMessage(form,'余位已更新');}
    catch(e){slot.innerHTML='<option value="">无法读取余位</option>';formMessage(form,e.message,true);}
    finally{slot.disabled=false;}
  }

  const statuses=(b)=>{
    const states=state.user.role==='visitor' ? ['pending','confirmed'].includes(b.status)?['cancelled']:[] : state.user.role==='merchant'?b.status==='pending'?['confirmed','declined']:b.status==='confirmed'?['completed','cancelled']:[]:[];
    return states.map(s=>`<button class="btn secondary small" data-book-status="${s}" data-book-id="${b.id}" data-version="${b.version}">${icon(s==='confirmed'?'check':s==='completed'?'check-check':'x')}${{confirmed:'确认接待',declined:'未能接待',cancelled:'取消预约',completed:'确认已履约'}[s]}</button>`).join('');
  };
  async function workbenchContent() {
    const {bookings}=await api('/api/bookings');
    let content=`<h2>${state.user.role==='visitor'?'我的预约':'预约收件箱'}</h2><p class="business-status">记录保存在当前业务服务器，可用同一账号跨设备查看。${state.health?.notifications==='merchant-inbox'?'新预约和回复进入工作台，尚未接入短信或邮件。':''}</p>`;
    const selected=param('booking');
    if(selected) {
      const {booking:b,messages,audit:history}=await api(`/api/bookings/${encodeURIComponent(selected)}`);
      return content+`<a href="#workbench" class="text-btn">${icon('arrow-left')}返回列表</a><section class="business-section"><div class="business-toolbar"><div><h2>${esc(b.title)}</h2><p>${esc(b.merchant_name)} · ${esc(b.date)} ${esc(b.slot)} · ${b.count}人</p></div><strong>${statusNames[b.status]}</strong></div><p>应付参考合计：${fmt(b.total_cents)}，以实际收款记录为准。</p><p>预约编号：<code>${esc(b.id)}</code></p>${b.note?`<p>游客备注：${esc(b.note)}</p>`:''}<div class="action-row">${statuses(b)}</div><div class="booking-thread">${messages.length?messages.map(m=>`<article class="booking-message"><small>${esc(m.display_name)} · ${{merchant:'商户',visitor:'游客',admin:'管理员'}[m.role]} · ${time(m.created)}</small><p>${esc(m.body)}</p></article>`).join(''):'<p>暂无回复。</p>'}</div><form id="business-message" data-booking="${b.id}" class="business-form"><label class="wide">发送消息<textarea name="body" maxlength="1000" required></textarea></label><p data-form-status class="wide" role="status"></p><div class="wide"><button class="btn" type="submit">${icon('send')}发送回复</button></div></form><details class="business-audit"><summary>办理记录</summary>${history.map(h=>`<p>${time(h.created)} · ${esc(h.action)}</p>`).join('')}</details></section>`;
    }
    content+=bookings.length?`<ul class="business-list">${bookings.map(b=>`<li><div class="row-heading"><strong>${esc(b.title)}</strong><span>${statusNames[b.status]}</span></div><p>${esc(b.merchant_name)} · ${esc(b.date)} ${esc(b.slot)} · ${b.count}人 · ${fmt(b.total_cents)}</p>${state.user.role!=='visitor'?`<p class="caption">游客称呼：${esc(b.visitor_name)}</p>`:''}<div class="action-row"><a class="text-btn" href="#workbench?booking=${b.id}">${icon('messages-square')}详情与回复</a>${statuses(b)}</div></li>`).join('')}</ul>`:empty('暂无预约记录',state.user.role==='visitor'?'提交预约后，商户确认与回复会显示在这里。':'新的游客预约会进入此收件箱。');
    if(state.user.role==='merchant')content+=await merchantOfferings();
    return content;
  }
  async function merchantOfferings() {
    const data=await api('/api/merchant');
    return `<section class="business-section"><h2>课程与接待时段</h2><p>${esc(data.merchant.name)} · ${data.merchant.verified?'平台已确认经营主体':'等待平台核对经营主体'}</p><ul class="business-list">${data.offerings.map(o=>`<li><div class="row-heading"><strong>${esc(o.title)}</strong><span>${o.active?'已发布':'未发布'}</span></div><p>${fmt(o.price_cents)} / 人，每时段 ${o.capacity} 位 · ${o.slots.map(esc).join('、')}</p><button class="text-btn" data-offering-active="${o.id}" data-active="${!o.active}">${icon(o.active?'eye-off':'eye')}${o.active?'暂停预约':'发布预约'}</button></li>`).join('')}</ul><details><summary>添加体验课程</summary><form id="business-offering" class="business-form"><label>课程名称<input name="title" required minlength="2" maxlength="100"></label><label>关联点位<select name="pointId">${pointOptions()}</select></label><label>单人价格（元）<input name="price" required type="number" min="0.01" max="100000" step="0.01"></label><label>每时段接待人数<input name="capacity" type="number" min="1" max="100" value="10" required></label><label class="wide">每日时段（24小时制，英文逗号分隔）<input name="slots" required placeholder="09:30,14:00"></label><label class="wide">课程、接待及取消说明<textarea name="description" required minlength="10" maxlength="1000"></textarea></label><p data-form-status class="wide" role="status"></p><div class="wide"><button class="btn" type="submit">${icon('plus')}保存课程</button></div></form></details></section>`;
  }
  const pointOptions=()=> (state.catalog?.points || []).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');

  async function financeContent() {
    if(state.user.role==='visitor')return empty('仅供商户与平台使用','游客可在预约详情中查看办理状态。');
    const {ledger}=await api('/api/ledger');
    let content=`<h2>业务凭证与到户记录</h2><p>按收款、退款、产品或体验到户款、劳务费和成本分别登记。只有经平台人工复核的记录进入财务汇总；凭证复核不代表银行接口验证。</p><div class="table-scroll"><table class="business-table"><thead><tr><th>类别 / 业务</th><th>金额 / 收益方</th><th>凭证</th><th>复核状态</th></tr></thead><tbody>${ledger.length?ledger.map(l=>`<tr><td>${ledgerNames[l.kind]}<small>${esc(l.reference)}</small><small>预约 ${esc(l.booking_id)}</small></td><td>${fmt(l.cents)}<small>${esc(l.beneficiary)}</small></td><td><a class="text-btn" href="/private-files/${l.evidence_id}" target="_blank" rel="noopener">${icon('file-check')}${esc(l.evidence_name)}</a><details><summary>SHA-256</summary><small>${esc(l.sha256)}</small></details></td><td>${{submitted:'待人工复核',approved:'人工复核通过',rejected:'未通过'}[l.status]}${l.review_note?`<small>${esc(l.review_note)}</small>`:''}${state.user.role==='admin' && l.status==='submitted'?`<form class="ledger-review" data-id="${l.id}"><label>复核意见<input name="note" minlength="10" maxlength="500" required></label><select name="status" aria-label="复核结论"><option value="approved">通过</option><option value="rejected">不通过</option></select><p data-form-status role="status"></p><button class="text-btn" type="submit">${icon('check')}提交复核</button></form>`:''}</td></tr>`).join(''):'<tr><td colspan="4">暂无凭证记录，预约金额不会自动转为收入。</td></tr>'}</tbody></table></div>`;
    if(state.user.role==='merchant') {
      const {bookings}=await api('/api/bookings'),eligible=bookings.filter(b=>['confirmed','completed','cancelled'].includes(b.status));
      content+=`<section class="business-section"><h2>登记业务凭证</h2>${eligible.length?`<form id="business-ledger" class="business-form"><label class="wide">关联预约<select name="bookingId">${eligible.map(b=>`<option value="${b.id}">${esc(b.title)} · ${esc(b.date)} · ${b.id.slice(0,8)}</option>`).join('')}</select></label><label>类别<select name="kind">${Object.entries(ledgerNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>金额（元）<input name="amount" type="number" min="0.01" step="0.01" max="10000000" required></label><label>付款 / 到户对象<input name="beneficiary" required maxlength="100"></label><label>唯一业务凭证编号<input name="reference" required minlength="3" maxlength="100"></label><label class="wide">凭证（PDF、PNG或JPEG，10MB以内）<input name="evidence" type="file" accept="application/pdf,image/png,image/jpeg" required></label><p class="wide caption">请遮盖银行卡号等无关敏感信息。记录提交后不能直接修改，错误记录由平台退回后重新登记。到户分配与成本需在履约完成后登记。</p><p data-form-status class="wide" role="status"></p><div class="wide"><button class="btn" type="submit">${icon('upload')}上传并送审</button></div></form>`:empty('暂无可登记的预约','先完成预约确认，再按实际业务登记收款。')}</section>`;
    }
    return content;
  }
  async function dashboardContent() {
    if(state.user.role==='visitor')return empty('仅供商户与平台使用','游客预约状态请在工作台查看。');
    const v=await api('/api/metrics'),sum=k=>v.financial.find(x=>x.kind===k)?.cents || 0,count=k=>v.bookings.find(x=>x.status===k)?.count || 0;
    return `<h2>运营记录</h2><p>${esc(v.definition)}</p><div class="business-metrics">${[[count('pending'),'待确认预约'],[count('confirmed'),'已确认预约'],[count('completed'),'已履约预约'],[v.visits ?? '—','已同意统计的页面访问记录']].map(([n,t])=>`<div><small>${t}</small><strong>${n}</strong></div>`).join('')}</div><h3>人工复核的业务金额</h3><div class="business-metrics">${[[fmt(sum('receipt')),'收款'],[fmt(sum('refund')),'退款'],[fmt(sum('payout')),'产品 / 体验到户款'],[fmt(sum('labor')),'到户劳务费']].map(([n,t])=>`<div><small>${t}</small><strong>${n}</strong></div>`).join('')}</div><p>复核净收款：${fmt(sum('receipt')-sum('refund'))}；成本：${fmt(sum('cost'))}。这些记录均保留业务编号、提交者、凭证哈希和复核时间。</p><div class="action-row"><button class="btn secondary" data-business-export>${icon('download')}导出记录 JSON</button><a class="text-btn" href="#finance">逐笔查看凭证 ${icon('arrow-right')}</a></div>`;
  }
  async function adminContent() {
    if(state.user.role!=='admin')return empty('需要平台管理员账号','商户账户与经营主体由平台管理。');
    const {merchants}=await api('/api/admin/merchants');
    return `<h2>经营主体与商户账号</h2><p>核对实际经营主体、接待地址和联系方式后，课程才可发布。请通过独立安全渠道交付商户账号。</p><ul class="business-list">${merchants.map(m=>`<li><div class="row-heading"><strong>${esc(m.name)}</strong><span>${m.verified?'已确认主体':'待确认主体'}</span></div><p>${esc(m.location)} · ${esc(m.contact)} · 账号 ${esc(m.username)}</p><form class="merchant-verify business-form" data-id="${m.id}" data-verified="${!m.verified}"><label class="wide">核验依据<input name="basis" minlength="10" maxlength="500" required placeholder="核验资料、授权或实地联系的日期与依据"></label><p class="wide" data-form-status role="status"></p><div class="wide"><button class="text-btn" type="submit">${icon('badge-check')}${m.verified?'暂停主体确认':'确认经营主体'}</button></div></form></li>`).join('') || '<li>尚未开通商户账号。</li>'}</ul><section class="business-section"><h2>开通商户账号</h2><form id="business-merchant" class="business-form"><label>商户名称<input name="name" required minlength="2" maxlength="100"></label><label>账号<input name="username" required pattern="(?:[a-zA-Z0-9_]|-){3,40}" maxlength="40" autocomplete="off"></label><label>初始密码<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label><label>公开联系渠道<input name="contact" required minlength="2" maxlength="150"></label><label class="wide">实际接待地点<input name="location" required minlength="2" maxlength="300"></label><p class="wide" data-form-status role="status"></p><div class="wide"><button class="btn" type="submit">${icon('user-plus')}开通账号</button></div></form></section>`;
  }

  function renderAgentOnline() {
    return page('松溉知识助手','KNOWLEDGE / SOURCES','查询景点、手艺与原二维码路线。',`${loader()}<div class="business-toolbar"><span>${state.health?.ragConfigured?'检索增强问答 · 大模型已配置':'知识检索 · 大模型待接入'}</span><a class="text-btn" href="#agent-local">${icon('notebook-pen')}本机行程助手</a></div>${state.user?`<div id="rag-messages" class="rag-messages" role="log" aria-live="polite">${chatMarkup()}</div><form id="business-ask" class="rag-query"><label class="sr-only" for="business-question">向知识助手提问</label><textarea id="business-question" name="question" required minlength="2" maxlength="600" placeholder="例如：油纸伞怎样制作？亲子游依次经过哪些点位？"></textarea><button class="icon-btn voice-btn" type="button" data-voice-input title="语音输入" aria-label="语音输入">${icon('mic')}</button><button class="icon-btn" type="submit" title="发送问题" aria-label="发送问题" ${state.busy?'disabled':''}>${icon('send')}</button></form>`:state.loaded?authPrompt():''}`);
  }
  function chatMarkup() {
    return state.chat.length?state.chat.map(m=>`<article class="rag-message"><h3>${esc(m.question)}</h3><p class="caption">${m.mode==='rag'?'大模型依据检索资料生成':m.mode==='chat'?'大模型自由回答（未命中知识库资料）':'原始资料检索结果'}</p><div class="answer">${esc(m.answer)}</div>${m.warning?`<p class="business-error">${esc(m.warning)}</p>`:''}<ul class="rag-sources">${m.sources.map((s,i)=>`<li><strong>[${s.label || `S${i+1}`}] ${esc(s.title)}</strong><p>${esc(s.source)}</p>${s.url && /^https:\/\//.test(s.url)?`<a class="text-btn" target="_blank" rel="noopener" href="${esc(s.url)}">原始来源 ${icon('external-link')}</a>`:'<small>原网站或用户资料，尚无可核验外部链接。</small>'}${s.pointId?` <a class="text-btn" href="#scan?point=${s.pointId}">点位详情 ${icon('arrow-right')}</a>`:''}</li>`).join('')}</ul>${m.disclosure?`<p class="caption">${esc(m.disclosure)}</p>`:''}</article>`).join(''):empty('从有来源的资料开始','营业、台阶和课程余位缺少核验时，助手会提示信息不足。');
  }

  function renderScan() {
    const id=param('point'),p=state.catalog?.points.find(p=>p.id===id);
    return page('扫码互动点位','POINTS / STORIES & TASKS','查看点位讲解，完成古镇知识任务。',`${loader()}${id?`<div id="business-point" aria-live="polite">${state.loaded?'读取点位…':''}</div>`:`<div class="point-grid">${(state.catalog?.points || []).map(p=>`<article class="point-tile"><h3>${esc(p.name)}</h3><p class="caption">${p.qrId?'原导览 QR '+p.qrId:'文化资料条目'}</p><a class="text-btn" href="#scan?point=${p.id}">${icon('qr-code')}讲解与任务 ${icon('arrow-right')}</a></article>`).join('')}</div>`}`);
  }
  async function mountPoint(version) {
    const id=param('point');if(!id)return;
    const {point:p,task,progress}=await api(`/api/points/${encodeURIComponent(id)}`);if(version!==renderVersion)return;
    const url=`${state.health?.publicOrigin || location.origin}/#scan?point=${encodeURIComponent(p.id)}`;
    $('#business-point').innerHTML=`<a class="text-btn" href="#scan">${icon('arrow-left')}全部点位</a><section class="business-section qr-layout"><article>${p.image?`<img class="point-illustration" src="${esc(p.image)}" alt="${esc(p.name)}相关配图">`:''}<h2>${esc(p.name)}</h2><p>${esc(p.text)}</p><p class="caption">${esc(p.tip || '')}</p>${p.source?.url?`<a class="text-btn" href="${esc(p.source.url)}" target="_blank" rel="noopener">${icon('external-link')}资料来源：${esc(p.source.title)}</a>`:'<p class="caption">原网站整理资料，相关现场信息待核实。</p>'}<div class="action-row"><button class="btn secondary small" data-point-speak="${p.id}">${icon('volume-2')}听讲解</button><button class="icon-btn" data-stop-speech title="停止讲解" aria-label="停止讲解">${icon('square')}</button><a class="text-btn" href="#digital?point=${p.id}">三维与建筑档案 ${icon('box')}</a><a class="text-btn" href="#booking">体验预约 ${icon('calendar-plus')}</a></div>${p.routes?.length?`<p>所属原导览：${p.routes.map(r=>state.catalog.routes.find(x=>x.id===r)?.name).map(esc).join('、')}。<a href="#guide">查看原路线顺序</a></p>`:''}</article><aside><div id="point-qr" class="qr-code"></div><p class="qr-url">${esc(url)}</p><button class="text-btn" data-qr-download="${p.id}" data-url="${esc(url)}">${icon('download')}下载二维码</button><p class="caption">${/localhost|127\.0\.0\.1/.test(url)?'此二维码指向本机地址，部署为公开HTTPS后才能供游客跨设备扫描。':'扫码打开此点位讲解与任务。'}</p></aside></section><section class="business-section point-task"><h2>点位知识任务</h2><p>${esc(task.question)}</p>${state.user?.role==='visitor'?`<form id="business-task" data-point="${p.id}"><div class="task-options">${task.choices.map((c,i)=>`<label><input type="radio" name="answer" value="${esc(c)}" required><span>${esc(c)}</span></label>`).join('')}</div><p data-form-status role="status">${progress?.correct?'此账号已完成本点位任务。':''}</p><button class="btn small" type="submit">${icon('check')}提交答案</button></form>`:authPrompt()}<p class="caption">知识任务完成记录不代表GPS定位或现场到访验证。</p></section>`;
    drawQR('#point-qr',url);icons();recordEvent('qr_open',p.id);
  }
  function drawQR(selector,url) {
    const box=$(selector);if(!box)return;
    if(typeof qrcode!=='function'){box.innerHTML='<p>二维码组件不可用，请使用下方链接。</p>';return;}
    const qr=qrcode(0,'M');qr.addData(url);qr.make();box.innerHTML=qr.createSvgTag({cellSize:4,margin:4,scalable:true});
    const svg=box.querySelector('svg');svg?.setAttribute('role','img');svg?.setAttribute('aria-label','点位讲解与任务二维码');
  }

  function renderDigital() {
    const list=state.assets.filter(a=>!param('point') || a.point_id===param('point'));
    if(list.length && !list.some(a=>a.id===state.activeAsset))state.activeAsset=list[0].id;
    return page('三维场景与建筑档案','DIGITAL ASSETS / TRACEABLE RECORDS','保护档案与展示场景分别管理，保留采集来源、日期和精度说明。',`<div class="sim-banner" role="note"><strong>合成测试专区</strong>以下 3DGS 与 HBIM 样板为程序化 / AI 合成数据，仅用于验证建模链路，非松溉古镇实景测绘成果；实景成果将在现场采集后替换上线。</div>${loader()}${list.length?`<div class="asset-layout"><aside><ul class="asset-choices">${list.map(a=>`<li><button data-asset="${a.id}" aria-pressed="${(state.activeAsset || list[0].id)===a.id}">${esc(a.title)}<small>${{gaussian:'3DGS实景',hbim:'建筑保护档案','display-glb':'三维展示 / AR'}[a.kind]}</small></button></li>`).join('')}</ul></aside><article id="asset-detail"></article></div>`:empty('尚无经过核对的三维资产','目前已提供3DGS浏览、GLB增强现实和HBIM档案管理入口。实际场景需采集、建模并上传，照片和视频不会计为三维成果。')+`<div class="action-row"><a class="text-btn" href="#foundation">查看现有点位资料 ${icon('database')}</a>${state.user?.role==='admin'?`<a class="btn secondary" href="#asset-admin">${icon('upload')}上传实测成果</a>`:''}</div>`}`);
  }
  function renderStats(){
    const flow=[['0.15','4月'],['0.22','5月'],['0.30','6月'],['0.38','7月'],['0.42','8月'],['0.46','9月'],['0.51','10月']].map(([v,m],i)=>`<div class="bar-col"><div class="bar" style="height:${Math.round(6+v*62)}px"></div><span>${m}</span><b>${v}</b></div>`).join('');
    const groups=[['亲子研学','38%','#a64a38'],['情侣度假','24%','#c99a3d'],['康养慢游','22%','#53764c'],['团建拓展','16%','#6a7f94']].map(([k,v,c])=>`<div class="group-row"><span>${k}</span><div class="group-bar"><i style="width:${v};background:${c}"></i></div><b>${v}</b></div>`).join('');
    const income=[['数字底座运维服务费','1.5 万/月','37%'],['直播电商分销佣金','1.2 万/月','30%'],['体验产品预约分成','0.8 万/月','20%'],['培训与代运营','0.5 万/月','13%']].map(([k,v,r])=>`<li><span>${k}</span><b>${v}</b><small>${r}</small></li>`).join('');
    return page('运营数据看板','OPERATIONS DASHBOARD / DEMO DATA','样板期运营演示数据，展示客流、体验转化与助农增收的可视化口径。',`<div class="sim-banner" role="note"><strong>演示数据</strong>本看板数值为样板期测算演示，非真实运营数据；接入业务后台与合作社核算后自动更新替换。</div><div class="stats-kpis"><div><small>样板期累计客流</small><strong>2.4<span>万人次</span></strong></div><div><small>覆盖参与农户</small><strong>20<span>户</span></strong></div><div><small>农户人均月增收</small><strong>800<span>元</span></strong></div><div><small>培训主播/体验导师</small><strong>15<span>人</span></strong></div></div><div class="stats-cols"><section class="stats-card"><h3>月度客流趋势 <small>万人次</small></h3><div class="bars">${flow}</div><p class="caption">近郊微度假与研学客流按月爬升，十月受国庆与庙会带动达峰。</p></section><section class="stats-card"><h3>客群构成</h3><div class="groups">${groups}</div></section></div><div class="stats-cols"><section class="stats-card"><h3>收入结构 <small>月度</small></h3><ul class="income">${income}</ul><p class="caption">合计约 4.0 万元/月；全部为增量收益，不依赖门票与商铺租金。</p></section><section class="stats-card"><h3>助农收益链路</h3><div class="flow3"><span>农户/手艺人<br>供货·劳务·直播</span>${icon('arrow-right')}<span>合作社<br>统一结算</span>${icon('arrow-right')}<span>按户到账<br>可追溯</span></div><p class="caption">直播分销佣金与体验分成经合作社结算、可追溯到户，村民为供货方与内容方。</p></section></div>`);
  }
  function renderTeam(){
    const certs=[
      ['发明专利受理通知书','一种用于模块化建筑的BIM数据转换与接口适配装置','申请号 202610375048.3 · 2026-03-25 受理','kKV3JYV2Y9'],
      ['实用新型专利受理通知书','一种基于BIM地形勘察的智能地基适配结构','申请号 202620378125.6 · 2026-03-25 受理','hMlrRoXPlS'],
      ['EI 会议论文首批录用','Adaptive Reconstruction and Engineering Verification Method for Building Point Clouds Towards Construction Digital Twins','ISPM 2026（第十四届工程管理国际学术研讨会）· 会后提交 EI 检索','bEDSHm9AB8'],
      ['BIM 职业技能等级证书（中级）×2','曾昕（2023-10 发证）· 刘知元（2024-07 发证）','职业教育国家学分银行认定','bHgrFudSJD'],
      ['乡村振兴创意大赛 三等奖','执子之手，四季慢慢 · 第二届重庆市大学生乡村振兴创意大赛 常规赛赛道','2023 年 3 月','IJpqU0cI6I'],
      ['智能建造数字化设计大赛 三等奖','建微知著队 · 第二届“盈建科杯”全国大学生智能建造数字化设计大赛全国总决赛 F 室内装饰精细化设计','2023 年 12 月','ExXoPmGDhJ'],
      ['乡村振兴创意大赛 二等奖','山水渝北，金凤桃园 · 第三届重庆市大学生乡村振兴创意大赛 常规赛赛道','2024 年 1 月','xbUnkgeDp8'],
      ['“鲁班杯”数字孪生创新应用大赛 一等奖','砼心共筑队 · C-室内设计与施工BIM应用（本科组）','2024 年 5 月 19 日','NlCN3KEErU'],
      ['“鲁班杯”BIM 毕业设计大赛 一等奖','建微知著队 · C-室内设计与施工BIM应用（本科）','2023 年 6 月 8 日','NlCN3KEErU']
    ];
    const items=certs.map((c,i)=>`<li><b>${i+1}.</b><div><strong>${esc(c[0])}</strong><span>${esc(c[1])}</span><small>${esc(c[2])}</small></div><a href="https://aka.doubaocdn.com/s/${c[3]}" target="_blank" rel="noopener">查看证书原图</a></li>`).join('');
    const gallery=[...new Set(certs.map(c=>c[3]))].map(g=>`<a class="cert-thumb" href="https://aka.doubaocdn.com/s/${g}" target="_blank" rel="noopener"><img loading="lazy" src="https://aka.doubaocdn.com/s/${g}" alt="团队成果证书"></a>`).join('');
    return page('团队成果','TEAM ACHIEVEMENTS / CREDENTIALS','参赛团队已获专利受理、EI 录用、BIM 认证与学科竞赛奖项；证书原件可点击查看。',`<div class="sim-banner" role="note"><strong>团队成果附录</strong>以下成果证书用于支撑项目的技术可行性与团队能力，均为真实已获成果的原件扫描件；关键开放信息以发证机构核验为准。</div><ul class="cert-list">${items}</ul><div class="cert-gallery">${gallery}</div>`);
  }
  function renderPlan(){
    const cap=(t,s)=>`<div class="arch-cap"><b>${t}</b><small>${s}</small></div>`;
    const arch1=[['无人机倾斜摄影','全域航拍·正射与三维'],['地面激光点云','古建结构·高精度','scan-line'],['全景相机','街巷场景·环绕影像'],['建档调查','年代·工艺·病害记录']].map(x=>`<div class="arch-box">${cap(x[0],x[1])}</div>`).join('');
    const arch3=[['三维云游','3DGS 场景·手机可点开'],['智慧导览','4 条游线·扫码·语音'],['智能体问答','RAG 知识库·带来源'],['数据看板','客流·销售·助农增收'],['直播助农','供货·培训·佣金到户']].map(x=>`<div class="arch-box">${cap(x[0],x[1])}</div>`).join('');
    const arch4=[['游客','看·学·玩·买'],['运营公司','经营·结算·内容'],['镇政府','治理数据·产业指标'],['村集体与农户','增收·参与·培训']].map(x=>`<div class="arch-box">${cap(x[0],x[1])}</div>`).join('');
    const tech=[['外业采集','无人机倾斜·地面点云·全景·建档'],['点云预处理','配准·降噪·抽稀·坐标系统一'],['双轨建模','3DGS 轻量训练 / HBIM 构件与 IFC'],['云端部署','资产登记·核验·API·容量优化'],['前端展示','Web·H5·小程序·三维查看器'],['运营迭代','内容更新·客流数据回流·效果复盘']].map((t,i)=>`<div class="tech-step"><div class="tech-no">${i+1}</div><b>${t[0]}</b><small>${t[1]}</small></div>`).join('');
    const benefit=`<div class="plan-grid3"><div class="party"><h4>运营公司</h4><p>组织数字底座与代运营，获得客流转化与二次消费提升；向各参与方支付结算。</p></div><div class="party"><h4>镇政府</h4><p>统筹协调与政策支持，获得治理数据与乡村振兴产业指标。</p></div><div class="party"><h4>村集体·合作社</h4><p>组织农户供货与劳务，收取组织服务费并参与集体分红；统一结算、可追溯到户。</p></div><div class="party"><h4>农户·手艺人</h4><p>供货、劳务、直播带货与体验服务，直接获得经营收益；样板期人均月增收 800 元。</p></div><div class="party"><h4>项目团队（技术方）</h4><p>负责采集建模与平台建设，收取技术服务费与运营分成。</p></div></div>`;
    return page('项目方案','PROJECT BLUEPRINT / ARCHITECTURE & BENEFITS','系统总体架构、技术路线与多方收益分配说明；结构为示意，数据为样板期测算。',`<div class="sim-banner" role="note"><strong>示意说明</strong>以下三张图为项目方案示意结构，收益与分成数据为样板期测算演示，最终以协议与核算口径为准。</div>
<section class="plan-sec"><h2>系统总体架构 <small>数据采集 → 双轨建模 → 应用服务 → 用户使用</small></h2>
<div class="arch-layer"><div class="arch-label">采集层</div><div class="arch-cards">${arch1}</div></div>
<div class="arch-arrow">▼</div>
<div class="arch-layer"><div class="arch-label">双轨建模层</div><div class="arch-dual"><div class="arch-box big">3DGS 轻量云游场景<br>（游客可见·实时渲染）</div><div class="arch-mid">同一套采集数据<br>双向复用</div><div class="arch-box big">HBIM 保护档案<br>（构件·病害·IFC 交付）</div></div></div>
<div class="arch-arrow">▼</div>
<div class="arch-layer"><div class="arch-label">应用层</div><div class="arch-cards">${arch3}</div></div>
<div class="arch-arrow">▼</div>
<div class="arch-layer"><div class="arch-label">用户层</div><div class="arch-cards">${arch4}</div></div>
</section>
<section class="plan-sec"><h2>技术路线 <small>从外业采集到运营迭代的六个阶段</small></h2><div class="tech-flow">${tech}</div></section>
<section class="plan-sec"><h2>多方收益与分成结构 <small>结算经合作社统一、可追溯到户</small></h2><div class="benefit-core">云览松溉·数启乡兴 数字底座与运营平台</div><div class="benefit-arrows">客流·数据·服务流 ▲▼ 收益流</div>${benefit}<p class="caption">箭头方向：平台向各方支付结算收益，各方向平台提供客流、数据、商品与内容；农户收益经合作社统一结算到户。</p></section>`);
  }
  async function mountAsset() {
    const list=state.assets.filter(a=>!param('point') || a.point_id===param('point'));
    const a=list.find(a=>a.id===state.activeAsset) || list[0],el=$('#asset-detail');if(!a || !el)return;
    state.activeAsset=a.id;
    el.innerHTML=`<h2>${esc(a.title)}</h2>${a.kind==='hbim'?archiveMarkup(a.archive):`<div class="asset-scene" id="asset-scene"><p class="business-loading">正在准备三维场景…</p></div>`}<dl class="asset-meta"><dt>采集日期</dt><dd>${esc(a.capture_date)}</dd><dt>采集 / 建模</dt><dd>${esc(a.method)}</dd><dt>精度说明</dt><dd>${esc(a.accuracy)}</dd><dt>来源 / 授权</dt><dd>${esc(a.source)}</dd>${a.sha256?`<dt>文件校验</dt><dd>${esc(a.sha256)}</dd><dt>文件大小</dt><dd>${(a.bytes/1024/1024).toFixed(2)} MB</dd>`:''}</dl>${a.url?`<a class="text-btn" href="${esc(a.url)}" download>${icon('download')}下载原始资产 ${esc(a.filename)}</a>`:''}`;
    icons();
    if(a.kind==='gaussian') {
      $('#asset-scene').innerHTML=`<iframe src="splat-viewer.html?asset=${encodeURIComponent(a.id)}" title="${esc(a.title)}三维高斯场景" allow="fullscreen"></iframe>`;recordEvent('model_open',a.point_id);
    } else if(a.kind==='display-glb') {
      try {
        await loadScript('vendor/model-viewer.min.js','module');await customElements.whenDefined('model-viewer');if(!$('#asset-scene') || !el.isConnected || state.activeAsset!==a.id)return;
        $('#asset-scene').innerHTML=`<model-viewer src="${esc(a.url)}" alt="${esc(a.title)}" camera-controls shadow-intensity="0.5" exposure="1" ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" touch-action="pan-y"><button slot="ar-button" class="ar-launch">${icon('scan')}在现实空间查看</button></model-viewer><div class="scene-state" id="model-state">正在加载模型…</div>`;
        const viewer=$('model-viewer'),modelState=$('#model-state');
        viewer.addEventListener('load',()=>{if(!viewer.isConnected)return;const dimensions=viewer.getDimensions();if(a.scale_m && dimensions.x>0){const scale=a.scale_m/dimensions.x;viewer.scale=`${scale} ${scale} ${scale}`;viewer.updateFraming();}modelState.textContent=`模型已加载。实际宽度记录：${a.scale_m}米。AR需支持的移动设备与安全连接。`;recordEvent('model_open',a.point_id);});
        viewer.addEventListener('error',()=>{modelState.textContent='模型无法加载，请核对资产格式与文件。';});
        viewer.addEventListener('ar-status',e=>{if(e.detail.status==='session-started')recordEvent('ar_open',a.point_id);if(e.detail.status==='failed')modelState.textContent='当前设备无法启动AR，可继续旋转查看三维模型。';});icons();
      } catch(e){if($('#asset-scene'))$('#asset-scene').innerHTML=errorBox('三维组件无法加载，请核对本地依赖。');}
    }
  }
  function archiveMarkup(a) {
    return `<h3>建筑 ${esc(a.buildingId)}</h3><p>测绘日期：${esc(a.surveyDate)} · 测绘责任方：${esc(a.surveyor)}</p><p>坐标基准：${esc(a.coordinateSystem)}</p><ul class="archive-components">${a.components.map(c=>`<li><h3>${esc(c.id)} · ${esc(c.name)}</h3><p>材料：${esc(c.material)} · 实测尺寸：${esc(c.dimensions)}</p><p>状态与病害：${esc(c.condition)}</p><p class="caption">检查日期 ${esc(c.inspected)}<br>依据：${esc(c.evidence)}</p></li>`).join('')}</ul>${a.repairs?.length?'<h3>修缮记录</h3>'+a.repairs.map(r=>`<p>${esc(r.date)} · ${esc(r.description)}<br>${esc(r.evidence)}</p>`).join(''):''}`;
  }
  const scripts=new Map();
  function loadScript(src,type) {
    if(!scripts.has(src))scripts.set(src,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;if(type)s.type=type;s.onload=resolve;s.onerror=reject;document.head.append(s);}));return scripts.get(src);
  }

  async function assetAdminContent() {
    if(state.user.role!=='admin')return empty('需要平台管理员账号','资产需提供采集来源、授权和测绘依据。');
    const {assets}=await api('/api/admin/assets');
    return `<h2>三维与HBIM资产管理</h2><p>上传真实采集成果。3DGS需包含高斯属性；普通点云、照片或视频不能作为3DGS发布。GLB用于三维与AR展示，不等同于保护模型。HBIM档案记录构件实测和病害证据，可关联IFC。</p><ul class="business-list">${assets.map(a=>`<li><div class="row-heading"><strong>${esc(a.title)}</strong><span>${a.verified?'已公开':'待核对'}</span></div><p>${esc(a.kind)} · ${esc(a.capture_date)} · ${esc(a.accuracy)}</p><form class="asset-verify business-form" data-id="${a.id}" data-verified="${!a.verified}"><label class="wide">发布 / 撤回依据<input name="basis" required minlength="10" maxlength="500"></label><p data-form-status class="wide" role="status"></p><div class="wide"><button class="text-btn" type="submit">${icon('check')}${a.verified?'撤回公开':'核对后公开'}</button></div></form></li>`).join('') || '<li>尚无已上传资产。</li>'}</ul><section class="business-section"><h2>登记实际采集成果</h2><form id="business-asset" class="business-form"><label>资产名称<input name="title" required minlength="2" maxlength="120"></label><label>关联点位<select name="pointId">${pointOptions()}</select></label><label>成果类型<select name="kind"><option value="gaussian">3DGS（PLY / SPLAT / KSPLAT）</option><option value="display-glb">GLB三维展示与AR</option><option value="hbim">HBIM建筑档案（可关联IFC）</option></select></label><label>采集日期<input name="captureDate" type="date" max="${chinaToday()}" required></label><label class="wide">成果文件<input name="asset" type="file" accept=".ply,.splat,.ksplat,.glb,.ifc"></label><label>采集与建模方法<input name="method" required minlength="3" maxlength="300"></label><label>精度与测量依据<input name="accuracy" required minlength="3" maxlength="300" placeholder="写实测值及依据；未检验时明确说明"></label><label>GLB实际宽度（米，AR比例）<input name="scaleM" type="number" min="0.001" max="1000" step="0.001"></label><label class="wide">来源、责任方与使用授权<textarea name="source" required minlength="10" maxlength="1000"></textarea></label><label class="wide">HBIM档案JSON（仅档案类型填写）<textarea name="archive" rows="12" placeholder='{"pointId":"luo","buildingId":"实际建筑编号","coordinateSystem":"实测坐标基准","surveyDate":"YYYY-MM-DD","surveyor":"测绘责任方","components":[{"id":"实际构件编号","name":"构件名称","material":"材料","dimensions":"含单位的实测尺寸","condition":"实际检查记录","evidence":"检查报告与影像编号","inspected":"YYYY-MM-DD"}],"repairs":[]}'></textarea></label><p data-form-status class="wide" role="status"></p><div class="wide"><button class="btn" type="submit">${icon('upload')}上传并登记</button></div></form></section>`;
  }

  const legacyPointActions=pointActions;
  pointActions=p=>legacyPointActions(p)+`<div class="action-row"><a class="text-btn" href="#scan?point=${encodeURIComponent(p.id)}">${icon('qr-code')}讲解与扫码任务</a><a class="text-btn" href="#digital?point=${encodeURIComponent(p.id)}">${icon('box')}三维与建筑档案</a></div>`;
  const legacyPointDetail=pointDetail;
  pointDetail=()=>legacyPointDetail().replace('未接入商户排期、余位及库存',`<a href="#booking">查询服务器已发布课程与余位</a>；参考商品尚未接入实时库存`);
  assetInventory=()=>`<h2>资产与数据</h2><p>原有${townPoints.length}个点位、${GUIDE_ROUTES.length}条二维码路线、${townPhotos.length}张照片和首页循环视频继续保留。点位讲解与知识检索共用服务器资料目录，现场信息仍需核实。</p><div class="platform-section"><h3>三维与保护档案</h3><p>${state.assets.length?`现有${state.assets.length}项已公开资产。`:'尚无核对后公开的古镇3DGS、GLB或HBIM资产。'}成果按采集方法、来源、日期、精度说明与文件校验值登记。照片和视频不计为三维成果。</p><div class="action-row"><a class="btn secondary small" href="#digital">${icon('box')}三维与档案</a>${state.user?.role==='admin'?'<a class="text-btn" href="#asset-admin">登记实际采集成果</a>':''}</div></div><div class="platform-section"><h3>经营与服务数据</h3><p>已发布商户课程、余位、预约、回复、收退款凭证及人工复核结果保存于当前业务服务器。原有${products.length}项参考选品和本机草稿另行保留。</p><div class="action-row"><a class="btn secondary small" href="#booking">${icon('calendar-check')}体验预约</a><a class="text-btn" href="#workbench">预约与回复</a><a class="text-btn" href="#dashboard">运营记录</a></div></div><div class="platform-section"><h3>扫码与知识服务</h3><p>每个点位可打开讲解、导出二维码并完成线上知识任务；同一账号的任务记录可跨设备读取。大模型${state.health?.ragConfigured?'已配置，回答附检索来源':'尚未配置，当前提供附来源的原文检索'}。</p><div class="action-row"><a class="btn secondary small" href="#scan">${icon('qr-code')}互动点位</a><a class="text-btn" href="#agent">知识助手</a></div></div>`;
  renderers.account=renderAccount;renderers.booking=renderBooking;renderers.scan=renderScan;renderers.digital=renderDigital;renderers.stats=renderStats;renderers.plan=renderPlan;renderers.team=renderTeam;
  renderers.workbench=()=>workShell('预约工作台','BOOKINGS / MERCHANT INBOX','查看预约、商户确认和双方回复。');
  renderers.finance=()=>workShell('业务凭证','FINANCE / EVIDENCE','按实际业务登记收款、退款和到户分配。');
  renderers.dashboard=()=>workShell('运营记录','OPERATIONS / RECORDED DATA','从业务记录汇总，保留核算口径。');
  renderers.admin=()=>workShell('商户管理','MERCHANTS / MANAGEMENT','经营主体核验与商户账号。');
  renderers['asset-admin']=()=>workShell('资产管理','DIGITAL ASSETS / MANAGEMENT','采集成果、来源和核验记录。');
  renderers['agent-local']=renderers.agent;renderers.agent=renderAgentOnline;
  const originalRecords=renderers.records;
  renderers.records=()=>originalRecords()+`<section class="wrap business-content"><div class="business-online-entry"><h2>服务器预约与商户回复</h2><p>上方为原有本机草稿。正式发送的预约在工作台查看。</p><a class="btn secondary" href="#workbench">${icon('inbox')}查看已发送预约</a></div></section>`;
  const originalHome=renderers.home;
  renderers.home=()=>originalHome()+`<section class="wrap business-content"><div class="business-toolbar"><h2>古镇服务</h2><a class="text-btn" href="#booking">${icon('calendar-check')}体验预约 ${icon('arrow-right')}</a></div><div class="platform-entries"><a class="platform-entry" href="#scan">${icon('qr-code')}<span><b>扫码点位</b><small>文化讲解与知识任务</small></span></a><a class="platform-entry" href="#digital">${icon('box')}<span><b>三维与档案</b><small>采集成果与建筑记录</small></span></a><a class="platform-entry" href="#workbench">${icon('inbox')}<span><b>预约工作台</b><small>商户确认与回复</small></span></a></div></section>`;
  renderSettlements=()=>`<section class="business-section"><h2>助农业务记录</h2><p>已发送预约、收款、退款与到户分配分别留痕。财务汇总仅采用上传凭证经平台人工复核的记录。</p><div class="action-row"><a class="btn secondary" href="#dashboard">${icon('chart-no-axes-combined')}查看运营记录</a><a class="text-btn" href="#finance">${icon('receipt')}凭证与复核</a></div></section>`;
  const baseRender=render;
  render=function(scroll=true) {
    window.speechSynthesis?.cancel();clearInterval(pollTimer);
    renderVersion++;const version=renderVersion;baseRender(scroll);
    const titles={account:'我的账号',booking:'体验预约',scan:'扫码互动',digital:'三维与建筑档案',workbench:'预约工作台',finance:'业务凭证',dashboard:'运营记录',admin:'商户管理','asset-admin':'资产管理','agent-local':'本机行程助手'};
    if(titles[currentPage])document.title=titles[currentPage]+' · 云览松溉 数启乡兴';
    if(currentPage==='agent')document.title='松溉知识助手 · 云览松溉 数启乡兴';
    $('#business-account').innerHTML=icon('user-round')+`<span>${state.user?esc(state.user.displayName):'登录'}</span>`;
    icons();mount(version).catch(e=>{if(version!==renderVersion)return;const el=$('#business-view') || $('#business-point');if(el)el.innerHTML=errorBox(e);});
    if(state.loaded && lastEventPage!==location.hash){lastEventPage=location.hash;recordEvent('page_view');}
  };
  async function mount(version) {
    if(!state.loaded || state.error)return;
    const loaders={workbench:workbenchContent,finance:financeContent,dashboard:dashboardContent,admin:adminContent,'asset-admin':assetAdminContent};
    if(loaders[currentPage] && state.user) {
      const html=await loaders[currentPage]();if(version!==renderVersion)return;$('#business-view').innerHTML=html;icons();
      if(currentPage==='workbench')pollTimer=setInterval(async()=>{if(document.hidden || document.querySelector('#business-view textarea:focus'))return;const current=renderVersion;try{const html=await workbenchContent();if(current===renderVersion){const view=$('#business-view');if(view && !view.querySelector('form:focus-within')){view.innerHTML=html;icons();}}}catch{}},20000);
    }
    if(currentPage==='scan')await mountPoint(version);
    if(currentPage==='digital')await mountAsset();
  }

  document.addEventListener('click',async e=>{
    const b=e.target.closest('button,[data-book]');if(!b)return;
    const d=b.dataset;
    if(d.book){e.preventDefault();e.stopImmediatePropagation();go('booking');return;}
    try {
      if(b.hasAttribute('data-business-logout')){await api('/api/logout',{method:'POST',body:{}});state.user=null;state.chat=[];state.requestKey=null;go('account');render(false);}
      if(b.hasAttribute('data-business-refresh'))await refresh();
      if(d.bookStatus) {
        if(!confirm(`确定${{confirmed:'确认接待',declined:'不接受',cancelled:'取消',completed:'标记已经履约'}[d.bookStatus]}这条预约？`))return;
        b.disabled=true;await api(`/api/bookings/${d.bookId}/status`,{method:'POST',body:{status:d.bookStatus,version:Number(d.version)}});render(false);toast('预约状态已更新');
      }
      if(d.offeringActive){await api(`/api/offerings/${d.offeringActive}/active`,{method:'POST',body:{active:d.active==='true'}});await refresh();}
      if(b.hasAttribute('data-business-export')){const data=await api('/api/export');downloadBlob('松溉-业务凭证与办理记录.json',JSON.stringify(data,null,2));}
      if(d.asset){state.activeAsset=d.asset;render(false);}
      if(d.pointSpeak){const p=state.catalog.points.find(p=>p.id===d.pointSpeak);if(!('speechSynthesis' in window))throw new Error('当前浏览器不支持语音讲解');speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(p.text);speech.lang='zh-CN';speechSynthesis.speak(speech);}
      if(b.hasAttribute('data-stop-speech'))window.speechSynthesis?.cancel();
      if(b.hasAttribute('data-voice-input')) {
        const SR=window.SpeechRecognition || window.webkitSpeechRecognition;
        const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent);
        const ta=$('#business-question');
        if(!ta)return;
        const setActive=on=>{voiceState.active=on;if(on)b.classList.add('voice-active');else b.classList.remove('voice-active');};
        const permHint=()=>{const inWechat=/MicroMessenger/i.test(navigator.userAgent);return inWechat?'微信内置浏览器无法使用麦克风：请点击右上角「···」选择「在浏览器中打开」后重试':'麦克风权限被拒绝：请允许浏览器访问麦克风后重试；若刚才点了「不允许」，请在浏览器设置中开启';};
        // 录音模式进行中：再次点击 = 停止并转写
        if(voiceState.active && voiceState.mode==='record'){
          setActive(false);clearInterval(voiceState.timer);ta.placeholder='正在转写语音…';
          try{voiceState.recorder?.stop();}catch{}
          return;
        }
        // 浏览器原生语音识别（仅安卓 Chrome / Edge；iPhone 统一走录音转写更稳）
        if(SR && !isIOS){
          if(!voiceRecognition){
            voiceRecognition=new SR();
            voiceRecognition.lang='zh-CN';voiceRecognition.interimResults=true;voiceRecognition.maxAlternatives=1;
            voiceRecognition.onresult=ev=>{
              let interim='',final='';
              for(const r of ev.results){if(r.isFinal)final+=r[0].transcript;else interim+=r[0].transcript;}
              ta.value=final||interim;
              if(final){setActive(false);if(final.trim().length>=2){const form=ta.closest('form');if(form)form.requestSubmit();}}
            };
            voiceRecognition.onend=()=>{setActive(false);if(!ta.value)ta.placeholder='例如：油纸伞怎样制作？亲子游依次经过哪些点位？';};
            voiceRecognition.onerror=e=>{setActive(false);ta.placeholder='例如：油纸伞怎样制作？亲子游依次经过哪些点位？';toast({aborted:'已停止语音输入','no-speech':'没有听到声音，请靠近麦克风重试','not-allowed':permHint(),'network':'语音服务网络异常'}[e.error]||'语音识别失败，请重试');};
          }
          if(voiceState.active){setActive(false);voiceRecognition.stop();}
          else{voiceState.mode='browser';setActive(true);ta.placeholder='正在聆听…请直接说出你的问题';ta.focus();try{voiceRecognition.start();}catch{setActive(false);toast('语音识别未启动，请重试');}}
          return;
        }
        // 浏览器不支持识别 → 录音 + 服务端转写（兼容 iPhone / 微信内置浏览器）
        if(voiceState.active && voiceState.mode==='record')return;
        if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)throw new Error('当前浏览器不支持语音输入，请使用安卓 Chrome 或直接输入文字');
        try{
          const stream=await navigator.mediaDevices.getUserMedia({audio:true});
          voiceState.mode='record';voiceState.recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm'});voiceState.chunks=[];
          voiceState.recorder.ondataavailable=e=>{if(e.data?.size)voiceState.chunks.push(e.data);};
          voiceState.recorder.onstop=async()=>{
            stream.getTracks().forEach(t=>t.stop());
            const blob=new Blob(voiceState.chunks,{type:'audio/webm'});voiceState.chunks=[];
            try{
              const res=await fetch('/api/transcribe',{method:'POST',credentials:'same-origin',headers:{'X-Songgai-Request':'1','Content-Type':'application/octet-stream','X-Audio-Ext':'webm'},body:blob});
              const v=await res.json();
              if(!res.ok)throw new Error(v.error||'语音转写失败');
              const text=(v.text||'').trim();
              ta.placeholder='例如：油纸伞怎样制作？亲子游依次经过哪些点位？';
              if(text.length>=2){ta.value=text;const form=ta.closest('form');if(form)form.requestSubmit();}
              else toast('没有识别到内容，请重试');
            }catch(err){ta.placeholder='例如：油纸伞怎样制作？亲子游依次经过哪些点位？';toast(err.message||'语音转写失败，请重试');}
          };
          voiceState.recorder.start();
          setActive(true);ta.placeholder='正在录音…说完后点击话筒结束';
          toast('正在录音，说完后再次点击话筒');
        }catch(err){
          const denied=err && (err.name==='NotAllowedError'||err.name==='PermissionDeniedError'||err.name==='SecurityError');
          const noDevice=err && (err.name==='NotFoundError'||err.name==='DevicesNotFoundError');
          toast(denied?permHint():(noDevice?'未检测到麦克风设备，请检查手机或电脑的麦克风是否可用':'无法使用麦克风，请检查权限设置'));
        }
      }
      if(d.qrDownload){const temp=document.createElement('div');temp.id='qr-download-temp';temp.hidden=true;document.body.append(temp);drawQR('#qr-download-temp',d.url);const svg=temp.querySelector('svg')?.outerHTML;temp.remove();if(svg)downloadBlob(`松溉-点位-${d.qrDownload}.svg`,svg,'image/svg+xml');}
      if(d.consent){state.consent=d.consent;try{localStorage.setItem('songji-analytics-consent',d.consent);}catch{}$('#analytics-choice')?.remove();if(d.consent==='yes')recordEvent('page_view');if(currentPage==='account')render(false);}
    } catch(error){toast(error.message);b.disabled=false;}
  },true);
  document.addEventListener('change',e=>{if(e.target.id==='online-book-date')availability();});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter' || e.target?.id!=='business-question')return;
    if(e.shiftKey)return; // Shift+Enter 换行
    e.preventDefault();
    const ta=e.target,form=ta.closest('form');
    if(form && !state.busy && ta.value.trim().length>=2)form.requestSubmit();
    else if(form)formMessage(form,'请输入至少 2 个字');
  });
  document.addEventListener('submit',async e=>{
    const f=e.target;
    if(!(f.id.startsWith('business-') || ['ledger-review','merchant-verify','asset-verify'].some(x=>f.classList.contains(x))))return;
    e.preventDefault();e.stopImmediatePropagation();
    const data=new FormData(f),values=Object.fromEntries(data),type=f.id;
    submitButtons(f,true);formMessage(f,'正在处理…');
    try {
      if(type==='business-login' || type==='business-register') {
        const v=await api(type==='business-login'?'/api/login':'/api/register',{method:'POST',body:values});state.user=v.user;state.chat=[];state.requestKey=null;go('workbench');render(false);
      } else if(type==='business-password') {
        await api('/api/password',{method:'POST',body:values});state.user=null;state.chat=[];go('account');render(false);toast('密码已更新，所有设备需重新登录');
      } else if(type==='business-booking') {
        const payload={offeringId:f.dataset.offering,date:values.date,slot:values.slot,count:Number(values.count),note:values.note};
        const fingerprint=JSON.stringify(payload);if(state.requestKey?.fingerprint!==fingerprint)state.requestKey={fingerprint,key:crypto.randomUUID()};
        const v=await api('/api/bookings',{method:'POST',headers:{'Idempotency-Key':state.requestKey.key},body:payload});state.requestKey=null;go(`workbench?booking=${v.booking.id}`);toast('已发送到商户工作台，等待确认');
      } else if(type==='business-message') {
        await api(`/api/bookings/${f.dataset.booking}/messages`,{method:'POST',body:{body:values.body}});render(false);toast('回复已发送');
      } else if(type==='business-offering') {
        await api('/api/offerings',{method:'POST',body:{...values,priceCents:Math.round(Number(values.price)*100),capacity:Number(values.capacity),slots:values.slots.split(',').map(s=>s.trim())}});render(false);toast('课程已保存，发布后可接受预约');
      } else if(type==='business-merchant') {
        await api('/api/admin/merchants',{method:'POST',body:values});f.reset();render(false);toast('商户账号已建立，待经营主体核对');
      } else if(f.classList.contains('merchant-verify')) {
        await api(`/api/admin/merchants/${f.dataset.id}/verify`,{method:'POST',body:{basis:values.basis,verified:f.dataset.verified==='true'}});await refresh();
      } else if(type==='business-ledger') {
        const file=await upload(data.get('evidence'));await api('/api/ledger',{method:'POST',body:{...values,cents:Math.round(Number(values.amount)*100),evidenceId:file.id}});render(false);toast('凭证已上传，等待平台人工复核');
      } else if(f.classList.contains('ledger-review')) {
        await api(`/api/ledger/${f.dataset.id}/review`,{method:'POST',body:{status:values.status,note:values.note}});render(false);
      } else if(type==='business-ask') {
        state.busy=true;const askingUser=state.user.id,value=await api('/api/agent',{method:'POST',body:{question:values.question}});if(state.user?.id===askingUser){state.chat.push({question:values.question,...value});state.chat=state.chat.slice(-20);if($('#rag-messages')){$('#rag-messages').innerHTML=chatMarkup();f.reset();icons();$('#rag-messages').lastElementChild?.scrollIntoView({block:'start',behavior:'smooth'});}}state.busy=false;
      } else if(type==='business-task') {
        const value=await api(`/api/points/${f.dataset.point}/task`,{method:'POST',body:{answer:values.answer}});formMessage(f,`${value.correct?'回答正确。':'再想一想。'}${value.explanation} ${value.notice}`);
      } else if(type==='business-asset') {
        const file=data.get('asset'),uploaded=file?.size?await upload(file):null;
        let archive=null;if(values.kind==='hbim'){try{archive=JSON.parse(values.archive);}catch{throw new Error('HBIM档案JSON格式不正确');}}
        await api('/api/assets',{method:'POST',body:{...values,fileId:uploaded?.id || null,archive,scaleM:values.scaleM?Number(values.scaleM):null}});render(false);toast('资产已登记，待核对后公开');
      } else if(f.classList.contains('asset-verify')) {
        await api(`/api/assets/${f.dataset.id}/verify`,{method:'POST',body:{verified:f.dataset.verified==='true',basis:values.basis}});await refresh();
      }
    } catch(error){state.busy=false;formMessage(f,error.message,true);}
    finally{submitButtons(f,false);}
  },true);

  async function recordEvent(type,pointId) {
    if(state.consent!=='yes')return;
    try{await api('/api/events',{method:'POST',body:{type,page:location.hash.slice(1).split('?')[0] || 'home',pointId,eventId:crypto.randomUUID(),consent:true}});}catch{}
  }
  async function refresh() {
    try {
      const [session,health,catalog,assets]=await Promise.all([api('/api/session'),api('/api/health'),api('/api/catalog'),api('/api/assets')]);
      Object.assign(state,{user:session.user,health,catalog,assets:assets.assets,loaded:true,error:''});
    } catch(e){state.loaded=true;state.error='业务服务尚未连接。请通过运行中的网站服务访问；原有古镇介绍和本机草稿仍可使用。';}
    render(false);
  }
  function consentChoice() {
    if(state.consent)return;
    const bar=document.createElement('aside');bar.id='analytics-choice';bar.className='consent-bar';bar.setAttribute('aria-label','访问统计选择');bar.innerHTML='<p>是否允许记录本网站页面访问次数，用于改进古镇服务？不记录精确位置。不允许统计也可浏览和预约，办理业务仍保存必要记录。</p><div class="action-row"><button class="text-btn" data-consent="no">暂不允许</button><button class="btn small" data-consent="yes">允许统计</button></div>';document.body.append(bar);
  }
  window.addEventListener('pagehide',()=>{clearInterval(pollTimer);window.speechSynthesis?.cancel();});
  consentChoice();refresh();
})();
