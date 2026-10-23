'use strict';

const QR_GUIDE_URL = 'https://tour.mapapp.cn/?appid=yeeabk287';
const QR_GUIDE_API = 'https://tour.ebmap.com/api/map/getData?map_key=yeeabk287&locale=default';
const GUIDE_QR_IMAGE = 'assets/guide-qr.png';
const GUIDE_ROUTES = [
  {id:'wellness', name:'康养游', icon:'leaf', abstract:'闲坐茶馆品香茗，竹下听戏悦心情。旧忆重拾人未老，松溉闲游一身轻。', length:'1.5 km', time:'3 小时', image:'photo-33', stops:[
    ['松溉古镇大门（上码头）','从临江入口开始，先看古码头与江岸风景。','4517'],['临江茶馆','在吊脚楼茶馆品盖碗茶、听评书，留出休息时间。','4487'],['松溉老油坊','了解传统榨油与老街日常。','4488'],['马帮议事厅','沿商贸线索认识水陆转运的旧时故事。','4489'],['鹏飞书院','在书院旧址感受松溉崇文重教的文脉。','4490'],['陈少南夫妇墓碑','结合现场说明了解鹏飞书院相关碑刻线索。','4491'],['神仙口','在古街巷交汇处观察九宫十八庙的空间记忆。','4500'],['松溉古镇大门（邵家坝子）','从陆路主入口结束，前往停车或返程。','4518']
  ]},
  {id:'couple', name:'情侣游', icon:'heart', abstract:'古巷携手缓步行，江风落日倍含情。同描伞底同心意，松溉风月两心倾。', length:'3.5 km', time:'2.5 小时', image:'photo-13', stops:[
    ['松溉古镇大门（邵家坝子）','从陆路主入口进入古镇。','4518'],['松溉油纸伞','看制伞与手绘细节，选择一把伞留下纪念。','4499'],['松溉棕编','体验或观摩棕叶编结的民间手艺。','4502'],['罗氏祠堂','从宗祠院落与戏台读一读家族和社区记忆。','4504'],['新运纺纱厂陈列馆','了解抗战时期工业迁建留下的地方记忆。','4507'],['紫云宫','感受船帮会馆与水运信仰的历史线索。','4494'],['永川县署','沿台阶寻找松溉置县与江镇治理的历史印记。','4496'],['秦家大院','观察川东传统民居的院落与木构细节。','4497'],['玉皇观','在山巅宫观看古镇高差与屋脊风景。','4498'],['天后宫','了解闽籍商帮与妈祖信仰留下的文化痕迹。','4519'],['松溉集市','逛一逛本地农产、手作与街头小吃。','4505'],['魁星阁','以飞檐与文脉地标收束古镇慢游。','4493']
  ]},
  {id:'team', name:'团建游', icon:'users', abstract:'结伴穿巷踏歌行，协作手作趣满盈。江风散尽职场倦，聚力同行共远征。', length:'3 km', time:'2.5 小时', image:'photo-04', stops:[
    ['松溉古镇大门（上码头）','从江岸入口集合，分组确认联络与返程点。','4517'],['临江茶馆','用茶叙和观察任务开启团队行程。','4487'],['松溉老油坊','认识传统油坊与古镇生活生产。','4488'],['熊氏杆秤','观察木杆秤制作，体验传统衡器的手艺逻辑。','4501'],['紫云宫','沿水运与商帮线索完成团队文化观察。','4494'],['永川县署','在高处节点了解古镇空间格局。','4496'],['秦家大院','分组寻找穿斗式木构与院落细节。','4497'],['新运纺纱厂陈列馆','共同认识抗战工业遗产的地方故事。','4507'],['罗氏祠堂','以家风、宗族与社区为题进行分享。','4504'],['松溉棕编','安排轻量手作共创，具体体验需现场确认。','4502'],['神仙口','在街巷交汇点完成团队合影或任务收束。','4500'],['鹏飞书院','回望松溉崇文重教的历史文脉。','4490'],['陈少南夫妇墓碑','以现场文保说明作为行程结束前的补充。','4491']
  ]},
  {id:'family', name:'亲子游', icon:'sprout', abstract:'牵娃闲步古巷行，同做非遗趣满盈。江风拂面笑盈盈，松溉亲子伴童行。', length:'2 km', time:'3 小时', image:'photo-15', stops:[
    ['松溉古镇大门（邵家坝子）','从陆路主入口进入，先确认厕所、饮水与集合点。','4518'],['松溉集市','从农产、小吃和街巷招牌开始认识古镇生活。','4505'],['天后宫','听一段移民与水运信仰的故事，停留时间按孩子状态调整。','4519'],['罗氏祠堂','观察院落、戏台与木构，不触碰建筑构件。','4504'],['熊氏杆秤','认识传统计量工具，适合做简单观察任务。','4501'],['松溉棕编','选择安全的基础编织体验，需家长全程陪同。','4502'],['松溉油纸伞','看穿骨、裱纸或手绘工序，体验项目以店家安排为准。','4499'],['神仙口','沿平缓街巷慢走，留意台阶和人流。','4500'],['鹏飞书院','用“古人在哪里读书”作为亲子讲解线索。','4490'],['马帮议事厅','以商队故事收尾，按体力选择返回路线。','4489']
  ]}
];

let guideRouteId = 'wellness';
const guideRoute = () => GUIDE_ROUTES.find(r => r.id === guideRouteId) || GUIDE_ROUTES[0];
const guideMapUrl = name => `https://uri.amap.com/search?keyword=${encodeURIComponent(name)}&city=${encodeURIComponent('重庆')}`;
const guidePhoto = route => `assets/photos/${route.image}.webp`;

function renderGuide() {
  const route = guideRoute();
  return heading('智慧导览', 'SMART GUIDE · QR ROUTES', '扫描二维码进入松溉古镇官方导览地图；下面按二维码中的推荐路线，整理为可读、可保存的游览步骤。') +
    `<section class="page-content wrap guide-content">
      <div class="guide-source"><div class="guide-qr"><img src="${GUIDE_QR_IMAGE}" alt="松溉古镇智慧导览二维码"><span>扫码打开原始智慧导览</span></div><div class="guide-source-copy"><span class="eyebrow">QR SOURCE / MAPAPP TOUR</span><h2>路线顺序来自二维码导览</h2><p>二维码解析入口为 <strong>tour.mapapp.cn/?appid=yeeabk287</strong>。四条路线的景点顺序、路线长度和建议时长按该导览数据整理；现场开放、施工、活动和步行条件变化时，请以二维码地图与现场指引为准。</p><div class="action-row"><a class="btn small" href="${QR_GUIDE_URL}" target="_blank" rel="noopener">打开智慧导览 ${icon('external-link')}</a><a class="btn secondary small" href="${QR_GUIDE_API}" target="_blank" rel="noopener">查看路线数据 ${icon('database')}</a></div></div></div>
      <div class="guide-route-tabs" role="tablist" aria-label="二维码推荐路线">${GUIDE_ROUTES.map(r => `<button class="guide-route-tab ${r.id === route.id ? 'active' : ''}" role="tab" aria-selected="${r.id === route.id}" data-guide-route="${r.id}">${icon(r.icon)}<span>${r.name}</span></button>`).join('')}</div>
      <article class="guide-route-panel" id="guide-route-panel"><div class="guide-route-hero"><img src="${guidePhoto(route)}" alt="${route.name}路线参考实景"><div><span class="eyebrow">${route.name} · QR RECOMMENDED ROUTE</span><h2>${route.name}</h2><p>${route.abstract}</p><div class="guide-facts"><span>${icon('footprints')}${route.length}</span><span>${icon('clock-3')}${route.time}</span><span>${icon('map')}${route.stops.length} 个导览点</span></div></div></div><div class="guide-route-actions"><button class="btn small" data-guide-save="${route.id}">${icon('bookmark-plus')}保存到我的行程</button><button class="btn secondary small" data-guide-download="${route.id}">${icon('download')}导出路线</button><a class="text-btn" href="${QR_GUIDE_URL}" target="_blank" rel="noopener">在原地图中导航 ${icon('arrow-up-right')}</a></div><ol class="guide-stops">${route.stops.map((stop, i) => `<li><span class="guide-stop-number">${String(i + 1).padStart(2, '0')}</span><div><h3>${stop[0]}</h3><p>${stop[1]}</p><a href="${guideMapUrl(stop[0])}" target="_blank" rel="noopener">地图查看 ${icon('map-pin')}</a></div></li>`).join('')}</ol><p class="notice">路线长度与时长为二维码智慧导览的标注值，不代表现场测绘结果。老街台阶、居民通道、宗教场所和临江区域请按现场提示通行；餐饮、茶馆与手作体验需要到店确认。</p></article>
    </section>`;
}

function exportGuideRoute(id) {
  const route = GUIDE_ROUTES.find(r => r.id === id);
  if (!route) return;
  download(`松溉古镇-${route.name}-二维码路线.txt`, `松溉古镇智慧导览 · ${route.name}\n来源：${QR_GUIDE_URL}\n路线长度：${route.length} · 建议时长：${route.time}\n\n${route.abstract}\n\n${route.stops.map((s, i) => `${i + 1}. ${s[0]}\n${s[1]}\n地图：${guideMapUrl(s[0])}`).join('\n\n')}\n\n以二维码地图与现场指引为准。`);
  toast('二维码路线已导出');
}

function saveGuideRoute(id) {
  const route = GUIDE_ROUTES.find(r => r.id === id);
  if (!route) return;
  save('guide-route', {id, name: route.name, savedAt: new Date().toISOString(), source: QR_GUIDE_URL});
  toast(`${route.name}已保存到本机行程`);
}

renderers.guide = renderGuide;
SOURCES.push({title: '松溉古镇智慧导览二维码路线', publisher: 'MapApp Tour · appid yeeabk287', url: QR_GUIDE_URL});

document.addEventListener('click', event => {
  const button = event.target.closest('button,a');
  if (!button) return;
  if (button.dataset.guideRoute) {
    guideRouteId = button.dataset.guideRoute;
    if (currentPage === 'guide') render(false);
  }
  if (button.dataset.guideSave) saveGuideRoute(button.dataset.guideSave);
  if (button.dataset.guideDownload) exportGuideRoute(button.dataset.guideDownload);
});

// services.js renders once before this extension is loaded; honor a direct #guide link.
if (location.hash.slice(1).split('?')[0] === 'guide') render(false);
