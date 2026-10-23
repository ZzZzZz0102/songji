'use strict';

const STAY_GUEST_URL = 'https://ncnpslasgzvs.doubao.link/app/app_17g9a0p30sq';
const STAY_HOST_URL = 'https://ncnpslasgzvs.doubao.link/app/app_17g8y69scvd';

function stayGuestLink(label, extraClass = '') {
  return `<a class="btn small ${extraClass}" href="${STAY_GUEST_URL}" target="_blank" rel="noopener noreferrer" data-stay-guest>${icon('bed-double')}${label}${icon('external-link')}</a>`;
}

function stayServiceMarkup() {
  return `<section class="stay-service" id="stay-services" aria-labelledby="stay-service-title"><div class="stay-section-heading"><h2 id="stay-service-title">${icon('bed-double')}民宿住宿</h2><span class="status-label neutral">外部民宿平台</span></div><p>想在古镇多留一晚，可以前往松溉古镇民宿平台查看房型、订房及入住服务。</p><div class="stay-service-facts"><div><h3>房型与价格</h3><p>房源位置、实景、当日房价和可订日期，请以平台与商户确认为准。</p></div><div><h3>订单与入住</h3><p>预订、付款、取消及入住安排在外部平台处理，不与本站“我的行程”自动同步。</p></div></div><div class="action-row">${stayGuestLink('查看房型与订房入口')}<a class="text-btn" href="#routes">搭配古镇游线 ${icon('arrow-right')}</a></div><p class="stay-platform-note">房源真实性及实时预订、自助入住能力尚未由本站核验；本入口不代表已完成预约或获得房间。</p></section>`;
}

function stayHomeMarkup() {
  return `<section class="stay-home-band"><div class="wrap stay-home-layout"><figure><img src="${photoFile(5)}" alt="松溉古镇临江青瓦建筑风光，非民宿房源照片" loading="lazy"><figcaption>古镇临江实景 · 非民宿房源照片</figcaption></figure><div><span class="eyebrow">留宿松溉</span><h2>在松溉，住一晚</h2><p>把老街的白日与江边的夜色，留进同一趟行程。前往民宿平台看看房型，为古镇之旅多留一点时间。</p><div class="action-row">${stayGuestLink('前往民宿平台')}<a class="text-btn" href="#visit" data-stay-entry>住宿与出行信息 ${icon('arrow-right')}</a></div><p class="stay-platform-note">外部平台 · 房源、房价和可订状态需确认；订单不在本站保存。</p></div></div></section>`;
}

function stayOperationsMarkup() {
  return `<section class="service-band wrap stay-host-service" aria-labelledby="stay-host-title"><span class="eyebrow">经营者服务</span><h2 id="stay-host-title">民宿管家</h2><p>房型发布、渠道分销、订房、入住、会员及团券核销，可前往外部民宿管家处理。</p><div class="action-row"><a class="btn secondary small" href="${STAY_HOST_URL}" target="_blank" rel="noopener noreferrer" data-stay-host>${icon('building-2')}进入民宿管家 ${icon('external-link')}</a></div><p class="stay-platform-note">外部管理平台，与本站本机台账分别管理，未接入数据同步。正式运营前请在外部平台配置管理账号和访问权限。</p></section>`;
}

const stayVisitBase = renderers.visit;
renderers.visit = () => stayVisitBase().replace('<div class="travel-grid">', stayServiceMarkup() + '<div class="travel-grid">');
const stayHomeBase = renderers.home;
renderers.home = () => stayHomeBase() + stayHomeMarkup();
const stayOperationsBase = renderers.operations;
renderers.operations = () => stayOperationsBase() + stayOperationsMarkup();

// The assistant routes accommodation questions to the external service, without inventing availability.
const stayAgentBase = localAgent;
localAgent = function(question, role) {
  if (/民宿|住宿|订房|酒店|住一晚|住哪里|住房|客房/.test(question)) {
    return {
      answer: '可以前往“出行服务”中的“民宿住宿”，打开松溉古镇民宿平台，查看房型、订房和入住服务。\n\n这是用户提供的外部平台。本站没有同步其真实房源、价格、房态、订单、支付或门锁数据，不能确认具体房间可订，也不能代为完成预约。请在平台向商户核对位置、房源实景、日期、费用、取消规则和入住方式。\n\n民宿订单在外部平台查看，不会自动出现在本站“我的行程”。',
      actions: [{kind:'page', id:'visit', label:'查看民宿住宿入口'}]
    };
  }
  return stayAgentBase(question, role);
};

let pendingStayScroll = false;
function scrollToStayService() {
  document.getElementById('stay-services')?.scrollIntoView({block:'start', behavior:'instant'});
}
document.addEventListener('click', event => {
  const entry = event.target.closest('a[data-stay-entry]');
  if (!entry || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  if (currentPage === 'visit') {
    event.preventDefault();
    scrollToStayService();
  } else pendingStayScroll = true;
});
window.addEventListener('hashchange', () => {
  if (pendingStayScroll) {
    if (currentPage === 'visit') scrollToStayService();
    pendingStayScroll = false;
  }
});

if (['home','visit','operations','agent'].includes(currentPage)) render(false);
