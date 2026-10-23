'use strict';

const foodPhotos = [
  [21,'九大碗宴席','地方美食','青花碗盛起蒸菜与汤品，木桌上摆出一席古镇风味。','1056459737'],
  [22,'九碗家宴','地方美食','九碗依次摆开，咸甜搭配，热气里是团聚的心意。','1056459737'],
  [23,'蒸笼里的猪儿粑','地方美食','叶片托起圆润的猪儿粑，一笼里有不同色泽与口味。','2208262270'],
  [24,'猪儿粑甜咸双味','地方美食','从磨浆吊干到备馅上笼，组照记录猪儿粑的甜咸风味。','2208262270'],
  [25,'猪儿粑手作组照','地方美食','刷叶、包馅与蒸制，老街铺子里的手工日常。','2208262270'],
  [26,'门前编竹','民间手艺','竹篮与簸箕摆在门前，手艺人低头编织日用器物。','2208262270'],
  [27,'纸伞绘花','民间手艺','在石板街边，为撑开的纸伞绘上花草。','2208262270'],
  [28,'一锅鲜鱼','地方美食','葱花、青椒与鱼同锅，记录古镇餐桌上的一味鲜。','825180095'],
  [29,'鲜鱼上桌','地方美食','鲜鱼配上汤汁与葱椒，呈现另一种家常做法。','825180095'],
  [30,'老街火锅小院','地方美食','竹椅围桌，灯笼垂落，小院里留出聚餐的位置。','6101203530'],
  [31,'围桌吃火锅','地方美食','红汤锅底、荤素食材与盖碗，一桌热闹的聚餐。','6101203530'],
  [32,'古镇俯瞰','古建景观','从高处俯瞰层叠屋檐、牌坊与街巷人群。',null],
  [33,'临江茶座','茶馆慢饮','竹椅面向江岸，门外树影与江风相伴。','203978184'],
  [34,'临江茶馆门面','茶馆慢饮','木门上的“临江茶馆”匾额与檐下红灯笼。','203978184'],
  [35,'长嘴壶茶叙','茶馆慢饮','木楼内的长嘴壶倒茶场景，茶客围坐其间。','203978184'],
  [36,'茶馆里的茶牌','茶馆慢饮','茶牌一字排开，木构茶馆里自有饮茶的节奏。','203978184'],
  [37,'木廊茶席','茶馆慢饮','木廊、雕花座椅与栏杆，留出一隅安静茶席。','203978184'],
  [38,'檐下鱼灯','节庆灯会','彩色鱼灯悬在木楼檐下，与红灯笼相映。','203978184'],
  [39,'松溉集市灯彩','节庆灯会','“松溉集市”招牌旁，多种形制的花灯点亮夜色。','609996600'],
  [40,'古镇华灯初上','节庆灯会','夜色里的楼阁、台阶与灯笼，铺开节庆光影。','609996600'],
  [41,'天涯共此时','节庆灯会','圆月主题灯饰与“天涯共此时”字样，记录团圆时刻。','609996600'],
  [42,'彩灯长廊','节庆灯会','一盏盏彩灯在长廊上方交错垂落。','609996600'],
  [43,'灯影层叠','节庆灯会','走近长廊，细看不同形制与色彩的花灯。','609996600'],
  [44,'满室花灯','节庆灯会','灯饰与反光墙面相映，呈现层叠的节庆空间。','609996600'],
  [45,'夜空烟花','节庆灯会','烟花划过夜空，留下节庆的一瞬。','609996600'],
  [46,'宴席主题演出','节庆灯会','演员端碗登台，以宴席场景演绎地方生活。','609996600'],
  [47,'街巷闲趣组照','街巷生活','组照记录石板街边悠闲休息的小猫。','609996600'],
  [48,'竹椅与午后光影','茶馆慢饮','阳光落在竹椅与木桌上，茶馆里一隅安静。','63800326386'],
  [49,'一席茶与点心','茶馆慢饮','盖碗、坚果与点心，摆成一席慢悠悠的茶叙。','63800326386'],
  [50,'盖碗茶香','茶馆慢饮','揭盖后的茶叶与一旁的茶点，记录吃茶日常。','63800326386'],
  [51,'茶点小食','茶馆慢饮','小巧茶点与坚果盘，为一席茶添上甜香。','63800326386']
].map(([id,title,category,description,account])=>({id,title,category,description,
  credit:`用户提供 · ${account?'来源账号：小红书 '+account:'原始来源待核'}`}));

townPhotos.push(...foodPhotos);

const nineBowls = [
  ['头碗大菜','以油酥瘦肉等食材开场，承载宴席的郑重心意。'],
  ['排骨酥肉汤','排骨与酥肉入汤，蒸出酥软与醇香。'],
  ['干盐豇豆土鸡汤','腌渍豇豆的咸鲜，与鸡汤的香气相遇。'],
  ['甜酸鲫鱼','鱼肉配上甜酸风味，为宴席添一味鲜。'],
  ['酸萝卜鸭汤','酸萝卜与鸭肉相配，汤味酸香。'],
  ['香糯猪肘','肘皮软糯、肉质酥软，是热闹家宴的一道大菜。'],
  ['夹沙肉','糯米与甜馅相伴，咸甜之间见老宴席风味。'],
  ['荷包蛋','朴实的一碗蛋菜，留住家常滋味。'],
  ['烧白','肉片与配菜同蒸，咸香软嫩，为一席收尾。']
];

const foodStories = [
  {id:'banquet',title:'九大碗',category:'地方宴席',photo:21,more:[22],tag:'一席团圆 · 九碗情长',
    intro:'没吃过九大碗，不算来过松溉古镇。九大碗又称九斗碗，以一桌热腾腾的蒸菜与汤品，盛起巴渝人家的待客心意。“九”寄寓吉祥与长久，吃的是乡味，也是相聚的仪式。',
    note:'慢蒸入味，咸甜相间。传统宴席常有蒸制数小时、头碗上桌致辞等礼俗，做法和上菜仪式随人家、店铺及宴席场合而异。',
    detailsTitle:'展开九碗风味',details:()=>`<p class="food-small">以下按所提供的文字介绍整理，为一种菜式组合；实拍中的鱼糕、丸子等呈现另一种搭配，到店菜单以店家为准。</p><ol class="nine-bowls">${nineBowls.map(([name,desc],i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><div><h3>${name}</h3><p>${desc}</p></div></li>`).join('')}</ol>`,query:'松溉古镇 九大碗'},
  {id:'ricecake',title:'猪儿粑',category:'街头小吃',photo:23,more:[24,25],tag:'一片叶香 · 甜咸双生',
    intro:'圆润莹白，形似小猪，这是关于“猪儿粑”名字的一种民间说法。它也曾是农忙时便于携带的吃食，如今在老街的蒸笼里，依然冒着熟悉的热气。',
    note:'糯米外皮裹住馅料，叶片托底。甜口与咸口各有拥趸，刚出笼时热食，更能尝到叶香与米香。',
    detailsTitle:'展开叶香与馅料',details:()=>`<div class="food-flavours"><div><h3>叶子里的风土</h3><p>柑子叶带着清香；黄粑叶气息温和；也有随季节选用的叶片。具体包叶与做法，依铺子和时令而异。</p></div><div><h3>鸳鸯甜香</h3><p>鲜肉搭配糖、花生、芝麻或桔红等，咸甜交融，各家比例不同。</p></div><div><h3>咸香饱满</h3><p>鲜肉与芽菜、豆干、大头菜或干豇豆等相配，留下朴实家常的味道。</p></div></div>`,query:'松溉古镇 猪儿粑'},
  {id:'fish',title:'鲜鱼家常味',category:'江鲜火锅',photo:28,more:[29],tag:'临江餐桌 · 一味鲜香',
    intro:'在临江古镇吃一顿家常鱼，葱椒的清香与热汤相伴。照片记录了两道鲜鱼菜品，一锅、一盘，各有滋味。',
    note:'鱼种、食材来源、口味和计价方式，点菜时向店家确认；可按同行人的口味选择辣度。',query:'松溉古镇 鲜鱼 餐饮'},
  {id:'hotpot',title:'老街火锅',category:'江鲜火锅',photo:31,more:[30],tag:'围桌而坐 · 热气腾腾',
    intro:'走过青石老街，找一处小院围桌而坐。红汤翻滚，荤素食材依次入锅，火锅让一趟古镇漫游，多了一份热闹的收尾。',
    note:'锅底辣度、菜品分量与价格以到店菜单为准，食材煮熟后再食用。',query:'松溉古镇 火锅'},
  {id:'tea',title:'在松溉，吃一碗茶',category:'茶馆慢饮',photo:49,more:[33,34,35,36,37,48,50,51],tag:'竹椅盖碗 · 江风作伴',
    intro:'“吃茶”是慢下来的好理由。临江竹椅上坐一会儿，揭开盖碗，配几样小食；木廊、茶牌和窗外的江风，把时间交还给日常。',
    note:'可以选一席临江茶座，也可以走进老街茶馆。茶品、茶点、营业时间及长嘴壶表演安排，请向店家当日确认。',query:'松溉古镇 茶馆'}
];

let foodCategory='全部风味';
function foodImageButton(id,cls='') {
  const photo=townPhotos.find(p=>p.id===id);
  return `<button class="food-photo ${cls}" data-photo-open="${id}" aria-label="查看${photo.title}大图"><img src="${photoFile(id)}" alt="${photo.title}：${photo.description}" loading="lazy" decoding="async"><span class="photo-open-icon">${icon('expand')}</span></button>`;
}
function foodMapUrl(query) {
  return 'https://uri.amap.com/search?keyword='+encodeURIComponent(query)+'&city='+encodeURIComponent('重庆');
}
function renderFood() {
  const list=foodStories.filter(f=>foodCategory==='全部风味'||f.category===foodCategory);
  return heading('松溉美食','A TASTE OF SONGJI','一席九大碗，一笼猪儿粑，再吃一碗江风里的茶。')+
    `<section class="page-content wrap food-content"><div class="toolbar"><div class="filter-group" aria-label="美食分类">${['全部风味','地方宴席','街头小吃','江鲜火锅','茶馆慢饮'].map(c=>`<button class="filter-btn ${c===foodCategory?'active':''}" data-food-category="${c}" aria-pressed="${c===foodCategory}">${c}</button>`).join('')}</div><span class="toolbar-note">${list.length} 道风味与茶叙</span></div><div class="food-stories">${list.map(f=>`<article class="food-story" id="food-${f.id}"><div class="food-story-media">${foodImageButton(f.photo)}<div class="food-thumbnails">${f.more.map(id=>{const p=townPhotos.find(p=>p.id===id);return `<button data-photo-open="${id}" aria-label="查看${p.title}大图"><img src="${photoFile(id,true)}" alt="${p.title}" loading="lazy" decoding="async"></button>`;}).join('')}</div></div><div class="food-copy"><span class="eyebrow">${f.category} / ${f.tag}</span><h2>${f.title}</h2><p>${f.intro}</p><p>${f.note}</p>${f.details?`<details class="food-details"><summary>${f.detailsTitle}${icon('chevron-down')}</summary>${f.details()}</details>`:''}<a class="text-btn food-map" href="${foodMapUrl(f.query)}" target="_blank" rel="noopener">${icon('map-pin')}地图找店 ${icon('arrow-up-right')}</a></div></article>`).join('')}</div><div class="food-walk"><span class="eyebrow">从早茶，到夜色</span><h2>把一日松溉，慢慢尝遍</h2><ol><li><span>上午</span><p>老街漫步，尝一份猪儿粑。</p></li><li><span>午间</span><p>多人聚餐可提前询问九大碗；也可选家常鲜鱼。</p></li><li><span>午后</span><p>在临江茶馆坐下，吃茶、歇脚。</p></li><li><span>傍晚</span><p>围炉吃火锅；有节庆活动时，再去看一场灯彩。</p></li></ol><div class="action-row"><a class="text-btn" href="#routes">${icon('route')}挑选古镇游线 ${icon('arrow-right')}</a><a class="text-btn" href="#photos" data-food-album="节庆灯会">${icon('lamp')}看看松溉灯会 ${icon('arrow-right')}</a></div></div><p class="photo-source-note">风味故事根据用户提供的介绍整理。食谱与宴席菜式因店家而异，照片为提供时的实景记录。图片来源及处理记录见<a href="assets/photos/food-credits.json" target="_blank" rel="noopener">新增照片索引</a>。</p></section>`;
}
function foodHomeMarkup() {
  return `<section class="section food-home"><div class="wrap"><div class="section-head"><div><span class="eyebrow">A TASTE OF SONGJI</span><h2>松溉美食 <em>一席乡味 · 一碗茶香</em></h2><p>把古镇的烟火，留在这一餐里。</p></div><a class="text-btn" href="#food">尝遍松溉风味 ${icon('arrow-up-right')}</a></div><div class="food-home-grid">${[foodStories[0],foodStories[1],foodStories[4]].map(f=>`<article><a href="#food" data-food-focus="${f.category}"><img src="${photoFile(f.photo,true)}" alt="${f.title}" loading="lazy"><h3>${f.title} ${icon('arrow-up-right')}</h3><p>${f.tag}</p></a></article>`).join('')}</div></div></section>`;
}
function installFoodFeatures() {
  renderers.food=renderFood;
  const home=renderers.home;
  renderers.home=()=>home().replace('<section class="route-teaser">',foodHomeMarkup()+'<section class="route-teaser">');
  for(const [craftId,photoId] of [['bamboo',26],['umbrella',27]]) {
    const photo=townPhotos.find(p=>p.id===photoId);
    Object.assign(crafts.find(c=>c.id===craftId),{image:`photos/photo-${photoId}`,caption:photo.title+' · '+photoCredit(photo)});
  }
  SOURCES.push({title:'新增 31 张美食、茶馆、手艺与灯会照片',publisher:'用户提供 · 网站副本已局部修复角落水印，原始文件未修改',url:'assets/photos/food-credits.json'});
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button,a');if(!button)return;
  if(button.dataset.foodCategory){foodCategory=button.dataset.foodCategory;render(false);$$('[data-food-category]').find(b=>b.dataset.foodCategory===foodCategory)?.focus({preventScroll:true});}
  if(button.dataset.foodFocus){foodCategory=button.dataset.foodFocus;if(currentPage==='food')render();}
  if(button.dataset.foodAlbum){photoCategory=button.dataset.foodAlbum;if(currentPage==='photos')render();}
});
