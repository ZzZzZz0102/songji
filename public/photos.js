'use strict';

const townPhotos = [
  {id:1,title:'魁星阁正面',category:'古建景观',description:'沿石阶仰望层叠飞檐，红灯笼点缀楼阁。',sight:'kuixing'},
  {id:2,title:'窗中戏台',category:'古建景观',description:'从木窗向外望去，院落与戏台相映成景。'},
  {id:3,title:'青石巷道',category:'街巷生活',description:'青石板路、木门和檐下灯笼，串起老街日常。'},
  {id:4,title:'永川县署',category:'古建景观',description:'石阶尽头的县署门楼，匾额上书“永川县署”。',sight:'county'},
  {id:5,title:'临江瓦舍',category:'江畔风光',description:'青瓦屋顶层层铺展，远处是长江与对岸山色。'},
  {id:6,title:'午后老油坊',category:'街巷生活',description:'松溉老油坊的木门与石阶，留住街巷的午后时光。'},
  {id:7,title:'灯笼门楼',category:'古建景观',description:'悬挂“松溉”匾额的门楼与彩灯，连接两侧街巷。'},
  {id:8,title:'牌坊与楼阁',category:'古建景观',description:'透过“松溉”牌坊，望见石阶上方的楼阁。',sight:'kuixing'},
  {id:9,title:'玉皇观院落组照',category:'古建景观',description:'一张组照呈现院落两端的戏台与玉皇殿。',sight:'yuhuang'},
  {id:10,title:'圆窗飞檐',category:'建筑细部',description:'圆窗框住蓝天、飞檐与一串红灯笼。'},
  {id:11,title:'楼阁侧影',category:'古建景观',description:'木廊、飞檐与红墙，在光影中层叠展开。'},
  {id:12,title:'溉水阁倒影',category:'江畔风光',description:'溉水阁临水而立，楼阁与天空映入池中。'},
  {id:13,title:'红灯笼老街',category:'街巷生活',description:'沿着石板坡道缓缓向下，两侧灯笼点亮木屋檐下。'},
  {id:14,title:'玉皇殿',category:'古建景观',description:'“玉皇殿”匾额、盘龙石柱与传统屋脊细节。',sight:'yuhuang'},
  {id:15,title:'秦家大院',category:'古建景观',description:'穿过“秦家大院”门楼，望见石阶与内院。'},
  {id:16,title:'长永商号',category:'街巷生活',description:'长永商号的门面，保留着老街商贸生活的线索。'},
  {id:17,title:'临江街巷',category:'江畔风光',description:'临江建筑、墙绘和灯笼，构成古镇的生活一角。'},
  {id:18,title:'青瓦楼阁',category:'古建景观',description:'层叠青瓦、马头墙与高处楼阁，一同沐浴晴日。'},
  {id:19,title:'木构仰望',category:'建筑细部',description:'仰视木构内部，梁柱、栏杆与窗棂呈现几何秩序。'},
  {id:20,title:'青瓦灯笼巷',category:'街巷生活',description:'青瓦与红灯笼沿石板路延伸，转角处又见老街。'}
];
let photoCategory='全部照片';
let activePhotoId=1;
let activePhotoIds=[];
const photoFile=(id,small=false)=>`assets/photos/photo-${String(id).padStart(2,'0')}${small?'-small':''}.webp`;
const photoCredit=p=>p.credit||`用户提供 · 原图水印：小红书号 ${p.id<=17?'606064696':'670502100'}`;

function photoCardsMarkup(photos) {
  return photos.map(p=>`<article class="town-photo"><button class="town-photo-open" data-photo-open="${p.id}" aria-label="查看${p.title}大图"><img src="${photoFile(p.id,true)}" alt="${p.title}：${p.description}" loading="lazy" decoding="async" width="480" height="720"><span class="photo-open-icon">${icon('expand')}</span></button><div class="town-photo-caption"><span>${String(p.id).padStart(2,'0')} / ${p.category}</span><h3><button class="text-btn" data-photo-open="${p.id}">${p.title} ${icon('arrow-up-right')}</button></h3></div></article>`).join('');
}
function renderPhotoAlbum() {
  const photos=townPhotos.filter(p=>photoCategory==='全部照片'||p.category===photoCategory);
  return heading('松溉实景相册','SONGJI THROUGH THE LENS','飞檐、街巷、江风与一桌乡味，留住一座古镇的日常。')+`<section class="page-content wrap"><div class="toolbar"><div class="filter-group" aria-label="照片分类">${['全部照片',...new Set(townPhotos.map(p=>p.category))].map(category=>`<button class="filter-btn ${category===photoCategory?'active':''}" data-photo-category="${category}" aria-pressed="${category===photoCategory}">${category}</button>`).join('')}</div><span class="toolbar-note">${photos.length} / ${townPhotos.length} 张照片</span></div><div class="town-photo-grid">${photoCardsMarkup(photos)}</div><p class="photo-source-note">照片由用户提供，图片来源与处理记录见<a href="assets/photos/credits.json" target="_blank" rel="noopener">首批照片索引</a>及<a href="assets/photos/food-credits.json" target="_blank" rel="noopener">新增照片索引</a>。节庆影像记录拍摄时的场景，活动安排以当期公告为准。</p></section>`;
}
function showTownPhoto(id,ids) {
  const photo=townPhotos.find(p=>p.id===Number(id));if(!photo)return;
  activePhotoId=photo.id;
  activePhotoIds=ids?.length?ids:townPhotos.filter(p=>currentPage!=='photos'||photoCategory==='全部照片'||p.category===photoCategory).map(p=>p.id);
  if(!activePhotoIds.includes(photo.id))activePhotoIds=townPhotos.map(p=>p.id);
  const dialog=$('#photo-dialog');
  updatePhotoViewer();
  if(!dialog.open){closeDialogs();openDialog(dialog);}
}
function updatePhotoViewer() {
  const p=townPhotos.find(p=>p.id===activePhotoId);
  const image=$('#photo-full');
  image.src=photoFile(p.id);image.alt=p.title+'：'+p.description;
  $('#photo-title').textContent=p.title;
  $('#photo-description').textContent=p.description;
  $('#photo-credit').textContent=photoCredit(p);
  $('#photo-counter').textContent=`${activePhotoIds.indexOf(p.id)+1} / ${activePhotoIds.length}`;
  $('#photo-new-tab').href=photoFile(p.id);
  $('#photo-download').href=photoFile(p.id);
  $('#photo-download').download=`松溉古镇-${p.title}.webp`;
  $('#photo-download').hidden=location.protocol==='file:';
  $('#photo-sight-link').hidden=!p.sight;
  if(p.sight){$('#photo-sight-link').dataset.photoSight=p.sight;$('#photo-sight-link').textContent='景点详情';}
}
function stepTownPhoto(direction) {
  const index=activePhotoIds.indexOf(activePhotoId);
  activePhotoId=activePhotoIds[(index+direction+activePhotoIds.length)%activePhotoIds.length];
  updatePhotoViewer();
}
document.addEventListener('click',event=>{
  const control=event.target.closest('button,a');if(!control)return;
  if(control.dataset.photoOpen)showTownPhoto(control.dataset.photoOpen);
  if(control.dataset.photoStep)stepTownPhoto(Number(control.dataset.photoStep));
  if(control.dataset.photoCategory){photoCategory=control.dataset.photoCategory;render(false);$$('[data-photo-category]').find(b=>b.dataset.photoCategory===photoCategory)?.focus({preventScroll:true});}
  if(control.dataset.photoSight){$('#photo-dialog').close();showSight(control.dataset.photoSight);}
});
document.addEventListener('keydown',event=>{
  if(!$('#photo-dialog').open||event.altKey||event.ctrlKey||event.metaKey)return;
  if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();
    if(event.key==='Home'){activePhotoId=activePhotoIds[0];updatePhotoViewer();}
    else if(event.key==='End'){activePhotoId=activePhotoIds[activePhotoIds.length-1];updatePhotoViewer();}
    else stepTownPhoto(event.key==='ArrowRight'?1:-1);
  }
});
function installPhotoFeatures() {
  for(const [sightId,photoId] of [['county',4],['kuixing',1],['yuhuang',14]]){
    const photo=townPhotos.find(p=>p.id===photoId);
    Object.assign(sights.find(s=>s.id===sightId),{image:`photos/photo-${String(photoId).padStart(2,'0')}`,caption:photo.title+' · '+photoCredit(photo)});
  }
  const picks=[8,3,5,1,14,15,6,20];
  scenes.splice(0,scenes.length,...picks.map(id=>{
    const p=townPhotos.find(p=>p.id===id);
    return {name:p.title,desc:p.description,image:`photos/photo-${String(id).padStart(2,'0')}-small`,source:photoCredit(p),photoId:id};
  }));
  for(const [routeId,photoId] of [['family',6],['team',4],['couple',13],['wellness',5]])routes.find(r=>r.id===routeId).image=`photos/photo-${String(photoId).padStart(2,'0')}`;
  SOURCES.push({title:'首批 20 张实景照片来源索引',publisher:'用户提供 · 小红书原图水印：606064696、670502100',url:'assets/photos/credits.json'});
  renderers.photos=renderPhotoAlbum;
  const homeRenderer=renderers.home;
  renderers.home=()=>homeRenderer().replace('<a class="text-btn" href="#sights">探访文化遗存',`<a class="text-btn" href="#photos">全部 ${townPhotos.length} 张实景`).replace('<div class="gallery-bottom">一品古镇 / 十里老街 / 万里长江</div>','<div class="gallery-bottom"><span>一品古镇 / 十里老街 / 万里长江</span><a class="text-btn" href="#photos">走进实景相册 '+icon('images')+'</a></div>');
}
