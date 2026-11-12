import { getLanguage, setLanguage, startTranslations, translate } from './i18n.js';

const el = (id) => document.getElementById(id);
const requireElement = (id) => {
  const node = el(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node;
};
const inputValue = (id) => {
  const node = el(id);
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ? node.value : '';
};
const safeRead = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
};
const safeWrite = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('浏览器未允许本地存储，本次设置不会持久保存'); }
};
const statusLabels = { available: '在售', reserved: '已预订', sold: '已售', model: '样板间' };
const colors = { available: '#458fff', reserved: '#cfaa6d', sold: '#586a81', model: '#52d7df' };
const storedFavorites = safeRead('nexus-favorites', []);
const favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites.filter((id) => typeof id === 'string') : []);
let activeView = 'homes';
let statusFilter = 'all';
let ascending = true;
let sorting = false;
let selectedId = '';
let zoom = 1;
let panX = 0;
let panY = 0;
let demoBearing = 0;
let tilted = true;
let pitch = 55;
let heightMultiplier = 2;
let currentStyle = 'dark';
let activeMap = null;
let mapFailed = false;
let toastTimer;
let mapTimer;
const amenities = [
  { name: '社区中央公园', en: 'UNIVERSITY PARK', category: '开放绿地 · 步行可达', minutes: '3 min', icon: '♧', x: 555, y: 650 },
  { name: 'Sandpoint 城市中心', en: 'DOWNTOWN SANDPOINT', category: '餐饮购物 · 城市生活', minutes: '12 min', icon: '⌂', x: 820, y: 720 },
  { name: 'Pend Oreille 湖畔', en: 'LAKE PEND OREILLE', category: '湖滨休闲 · 自然探索', minutes: '8 min', icon: '≋', x: 895, y: 195 },
  { name: '社区教育资源', en: 'LEARNING & GROWING', category: '学校配套 · 成长相伴', minutes: '5 min', icon: '◇', x: 220, y: 400 }
];
const lots = Array.from({ length: 48 }, (_, i) => {
  const row = Math.floor(i / 8);
  const col = i % 8;
  const block = Math.floor(i / 12) + 1;
  const number = i % 12 + 1;
  const status = i === 19 ? 'model' : i % 9 === 0 || i % 11 === 0 ? 'sold' : i % 7 === 0 ? 'reserved' : 'available';
  const area = 188 + (i * 17 % 89);
  const x = 327 + col * 47 + (col > 3 ? 35 : 0);
  const y = 260 + row * 48 + Math.floor(row / 2) * 32;
  return { id: `up-${block}-${number}`, number: `${String(block).padStart(2, '0')}—${String(number).padStart(2, '0')}`, block, status, area, height: 7 + (i % 4) * 3, beds: i % 3 === 0 ? 4 : 3, baths: i % 4 === 0 ? 3 : 2, price: 589000 + i * 3750 + (i % 4) * 9500, land: 510 + i * 13 % 230, x, y, name: ['The Aspen', 'The Cedar', 'The Juniper', 'The Willow'][i % 4], address: `${1200 + i * 4} University Park Way`, index: i };
});
const money = (amount) => '$' + amount.toLocaleString('en-US');
const houseArt = (index = 0) => {
  const sky = ['#293b50', '#344a60', '#2d4357', '#33495a'][index % 4];
  const wall = ['#b1ada3', '#a0a9ad', '#b7b0a2', '#9caaa9'][index % 4];
  return `<svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sky${index}" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#72838e"/></linearGradient><linearGradient id="glass${index}" x2="1" y2="1"><stop stop-color="#193447"/><stop offset=".5" stop-color="#688d9a"/><stop offset="1" stop-color="#203744"/></linearGradient></defs><path fill="url(#sky${index})" d="M0 0h400v240H0z"/><path d="M0 121L35 50 70 116 92 68 124 130 170 103 230 135 280 90 323 125 358 52 400 114V240H0" fill="#263f42"/><path d="M0 173Q190 140 400 165V240H0" fill="#52634f"/><path d="M44 160V102L165 55l99 39v71z" fill="${wall}"/><path d="M34 104L163 44l113 46-11 12-102-43L43 114z" fill="#28323b"/><path d="M166 62l89 34v69h-89z" fill="#8a918f"/><path d="M238 164V115l92-13 42 21v54z" fill="#a5a8a0"/><path d="M229 118l102-24 50 25-7 8-44-20-99 21z" fill="#28323b"/><path d="M64 113h71v43H64zM181 98h51v61h-51zM270 127h77v42h-77z" fill="url(#glass${index})" stroke="#d0c8b3" stroke-width="3"/><path d="M100 114v42m106-58v61m102-31v41" stroke="#b0b5b0" stroke-width="2"/><path d="M142 115h24v52h-24z" fill="#393b37"/><path d="M269 173l88 1 43 66H182z" fill="#8a8d86"/><path d="M156 167l20 0 28 73h-70z" fill="#aaafa5"/><path d="M0 195q70-40 131-12l-7 57H0M213 186q27-14 49-3l-30 57h-42z" fill="#4d6552"/><g fill="#213d3c"><path d="M10 171L27 103l18 68zM355 172l19-85 21 85z"/><ellipse cx="57" cy="179" rx="23" ry="10"/><ellipse cx="229" cy="175" rx="18" ry="9"/></g><path d="M0 228h400" stroke="#a5aaa2" stroke-width="6"/><path d="M0 236h400" stroke="#35424a" stroke-width="9"/><path d="M154 169v-10" stroke="#f7d8a1" stroke-width="3"/></svg>`;
};
function toast(message) {
  requireElement('toast').textContent = message;
  requireElement('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => requireElement('toast').classList.remove('show'), 3500);
}
function visibleLots() {
  const query = inputValue('search').trim().toLowerCase();
  let result = lots.filter((lot) => (statusFilter === 'all' || lot.status === statusFilter) && (activeView !== 'saved' || favorites.has(lot.id)) && `${lot.id} ${lot.number} ${lot.name} ${lot.address} ${lot.beds}室 ${lot.beds} beds`.toLowerCase().includes(query));
  if (sorting) result = result.sort((a, b) => ascending ? a.price - b.price : b.price - a.price);
  return result;
}
function renderList() {
  requireElement('saved-count').textContent = String(favorites.size);
  document.querySelectorAll('.panel-tabs button').forEach((button) => button.classList.toggle('active', button.getAttribute('data-view') === activeView));
  document.querySelectorAll('.header nav [data-view]').forEach((button) => button.classList.toggle('nav-active', button.getAttribute('data-view') === (activeView === 'saved' ? 'homes' : activeView)));
  document.querySelectorAll('.filter').forEach((button) => button.classList.toggle('active', button.getAttribute('data-status') === statusFilter));
  const search = el('search');
  if (search instanceof HTMLInputElement) search.placeholder = activeView === 'amenities' ? '搜索公园、学校、生活配套…' : '搜索地块编号、户型…';
  if (activeView === 'amenities') {
    const query = inputValue('search').trim().toLowerCase();
    const result = amenities.filter((item) => `${item.name} ${item.en} ${item.category} ${translate(item.name)} ${translate(item.category)}`.toLowerCase().includes(query));
    requireElement('result-title').innerHTML = `周边生活 <b>${result.length}</b>`;
    requireElement('listing').innerHTML = result.length ? result.map((item) => `<button class="amenity-card" data-amenity="${amenities.indexOf(item)}"><span class="amenity-icon">${item.icon}</span><div><h3>${item.name}</h3><p>${item.category}</p></div><span>${item.minutes} ↗</span></button>`).join('') : '<div class="empty">暂无匹配配套<br>试试搜索「公园」或「学校」</div>';
    return;
  }
  const result = visibleLots();
  requireElement('result-title').innerHTML = `${activeView === 'saved' ? '我的收藏' : '社区房源'} <b>${result.length}</b>`;
  requireElement('listing').innerHTML = result.length ? result.map((lot) => `<article tabindex="0" role="button" aria-label="查看 ${lot.name} ${lot.number}" class="lot-card ${selectedId === lot.id ? 'selected' : ''}" data-lot="${lot.id}"><div class="house-thumb">${houseArt(lot.index)}</div><div class="card-body"><div class="card-top"><h3>${lot.name} <span style="font-size:9px;color:#7f95b3">${lot.number}</span></h3><span class="status ${lot.status}">${statusLabels[lot.status]}</span></div><p class="card-address">${lot.address}</p><div class="card-meta">${lot.beds} 卧室 &nbsp;·&nbsp; ${lot.baths} 卫浴 &nbsp;·&nbsp; ${lot.area} m²</div><span class="card-price">${money(lot.price)}<small>起</small></span></div><button class="save-btn ${favorites.has(lot.id) ? 'saved' : ''}" data-save="${lot.id}" aria-label="${favorites.has(lot.id) ? '取消收藏' : '收藏'}" aria-pressed="${favorites.has(lot.id)}">${favorites.has(lot.id) ? '♥' : '♡'}</button></article>`).join('') : `<div class="empty">${activeView === 'saved' ? '还没有收藏房源，点击房源上的 ♡ 收藏。' : '未找到符合条件的房源，请调整筛选。'}</div>`;
  const visibleIds = new Set(result.map((lot) => lot.id));
  document.querySelectorAll('.plot').forEach((node) => node.classList.toggle('filtered', !visibleIds.has(node.getAttribute('data-lot') || '')));
  updateMapSelection();
}
function toggleSave(id) {
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  safeWrite('nexus-favorites', [...favorites]);
  renderList();
  if (selectedId) renderDetail();
}
function selectLot(id, move = true) {
  const lot = lots.find((item) => item.id === id);
  if (!lot) return;
  selectedId = id;
  const url = new URL(location.href);
  url.searchParams.set('lot', id);
  history.replaceState(null, '', url);
  renderList();
  renderDetail();
  document.querySelectorAll('.plot,.lot-label').forEach((node) => node.classList.toggle('selected', node.getAttribute('data-lot') === id));
  if (activeMap && move) activeMap.flyTo({ center: coordinates(lot.x + 20, lot.y + 20), zoom: 16.7, duration: 900 });
}
function renderDetail() {
  const lot = lots.find((item) => item.id === selectedId);
  const detail = requireElement('detail');
  if (!lot) { detail.hidden = true; return; }
  detail.hidden = false;
  detail.innerHTML = `<div class="detail-image">${houseArt(lot.index)}<button class="detail-close" data-action="close-detail" aria-label="关闭房源详情">×</button></div><div class="detail-content"><div class="detail-eyebrow"><span>HOMESITE ${lot.number}</span><span style="color:${colors[lot.status]}">● ${statusLabels[lot.status]}</span></div><h3>${lot.name}</h3><p>${lot.address} · 地块 ${lot.land} m²</p><div class="detail-price">${money(lot.price)}<span style="font-size:10px;color:#7a93b2"> 起</span></div><div class="detail-specs"><div><b>${lot.beds}</b><span>卧室 BEDROOMS</span></div><div><b>${lot.baths}</b><span>卫浴 BATHROOMS</span></div><div><b>${lot.area}<small style="font-size:9px"> m²</small></b><span>建筑面积 AREA</span></div></div><div class="detail-actions"><button data-action="inquire">${lot.status === 'sold' ? '咨询相似房源' : '预约了解此房源'} &nbsp; ↗</button><button data-save="${lot.id}" aria-label="收藏房源" aria-pressed="${favorites.has(lot.id)}">${favorites.has(lot.id) ? '♥' : '♡'}</button></div></div>`;
}
function closeDetail() {
  selectedId = '';
  requireElement('detail').hidden = true;
  document.querySelectorAll('.plot,.lot-label').forEach((node) => node.classList.remove('selected'));
  const url = new URL(location.href);
  url.searchParams.delete('lot');
  history.replaceState(null, '', url);
  renderList();
}
function showView(view) {
  activeView = view;
  const search = el('search');
  if (search instanceof HTMLInputElement) search.value = '';
  statusFilter = 'all';
  renderList();
  if (view === 'amenities') { closeDetail(); toast('示例通勤时间仅用于演示，点击配套查看位置'); }
}
function buildIllustration() {
  const trees = Array.from({ length: 190 }, (_, i) => {
    const x = (i * 137.51 + 17) % 1100;
    const y = (i * 83.97 + 63) % 850;
    if (x > 280 && x < 790 && y > 205 && y < 640) return '';
    const r = 5 + i % 7;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 ? '#24403f' : '#2e4945'}" opacity=".38"/><circle cx="${x - 2}" cy="${y - 2}" r="${r * .6}" fill="#3b5650" opacity=".2"/>`;
  }).join('');
  const city = Array.from({ length: 65 }, (_, i) => {
    const x = (i * 113.3 + 12) % 1100;
    const y = (i * 181.7 + 15) % 900;
    if (x > 260 && x < 800 && y > 190 && y < 655) return '';
    return `<rect x="${x}" y="${y}" width="${16 + i % 21}" height="${11 + i % 12}" fill="#203244" stroke="#2b4152" stroke-width=".6" opacity=".65"/>`;
  }).join('');
  const plots = lots.map((lot) => {
    const roof = lot.index % 2 ? '#36546d' : '#3e5c74';
    return `<g><rect class="plot" role="button" tabindex="0" aria-label="地块 ${lot.number} ${statusLabels[lot.status]}" data-lot="${lot.id}" x="${lot.x}" y="${lot.y}" width="43" height="44" rx="1" fill="${colors[lot.status]}30" stroke="${colors[lot.status]}" stroke-opacity=".65" stroke-width=".9"/><g pointer-events="none"><path d="M${lot.x + 9} ${lot.y + 12}h24v17h-24z" fill="${roof}" opacity=".55"/><path d="M${lot.x + 7} ${lot.y + 12}l14-7 14 7-14 7z" fill="#4f6e86" opacity=".6"/><path d="M${lot.x + 21} ${lot.y + 19}v10" stroke="#183349" stroke-width="1"/><path d="M${lot.x + 18} ${lot.y + 29}v12h8V29" fill="#496176" opacity=".5"/><text class="lot-label" data-lot="${lot.id}" x="${lot.x + 21.5}" y="${lot.y + 39}">${lot.index + 1}</text></g></g>`;
  }).join('');
  requireElement('illustrated-map').innerHTML = `<svg id="site-svg" viewBox="0 0 1100 850" preserveAspectRatio="xMidYMid slice" aria-label="可交互社区规划示意地图"><defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#44627c" stroke-opacity=".07" stroke-width=".5"/></pattern><radialGradient id="vignette"><stop offset=".3" stop-color="#080f18" stop-opacity="0"/><stop offset="1" stop-color="#080f18" stop-opacity=".7"/></radialGradient><pattern id="park-grid" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 9L9 0" stroke="#44705e" stroke-opacity=".12"/></pattern><filter id="glow"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="1100" height="850" fill="url(#grid)"/><g id="map-world"><g transform="rotate(-24 560 440)"><g fill="none" stroke="#223748" stroke-width="1" opacity=".45"><path d="M-50 40Q400 180 1180-10M-50 75Q400 215 1180 25M-50 110Q400 250 1180 60M-50 740Q600 620 1160 830M-50 770Q600 650 1160 860M-50 800Q600 680 1160 890"/></g><path d="M850-80Q760 120 900 270T1190 420L1250-100Z" fill="#102c41"/><path d="M850-80Q760 120 900 270T1190 420" fill="none" stroke="#35556c" stroke-width="2"/><path d="M871-80Q781 120 921 270T1211 420" fill="none" stroke="#284559" stroke-width=".6"/>${trees}<g fill="none" stroke-linecap="round"><path d="M-40 170H1200M-40 690H1200M220-40V940M850-40V940" stroke="#263b4e" stroke-width="20"/><path d="M-40 170H1200M-40 690H1200M220-40V940M850-40V940" stroke="#122230" stroke-width="15"/><path d="M-40 170H1200M-40 690H1200M220-40V940M850-40V940" stroke="#4a6073" stroke-opacity=".4" stroke-width="1" stroke-dasharray="8 12"/><path d="M-50 50H750M-50 805H1200M100-50V900M970-50V900" stroke="#1c3042" stroke-width="11"/></g>${city}<rect x="298" y="228" width="476" height="393" rx="24" fill="#132a36" stroke="#517986" stroke-width="1" stroke-dasharray="5 4"/><path d="M314 243H756V605H314ZM314 371H756M314 500H756M530 243V605" fill="none" stroke="#345066" stroke-width="17"/><path d="M314 243H756V605H314ZM314 371H756M314 500H756M530 243V605" fill="none" stroke="#1c3040" stroke-width="14"/><path d="M314 243H756V605H314ZM314 371H756M314 500H756M530 243V605" fill="none" stroke="#698398" stroke-width=".7" stroke-dasharray="5 8" opacity=".4"/>${plots}<g font-family="Space Grotesk, sans-serif" font-size="8" letter-spacing="2" fill="#6b849b" text-anchor="middle"><text x="545" y="247">UNIVERSITY PARK WAY</text><text x="555" y="374">ASPEN LANE</text><text x="555" y="503">CEDAR LANE</text><text x="545" y="608">WILLOW DRIVE</text><text x="525" y="175">UNIVERSITY AVENUE</text><text x="530" y="695">SCHWEITZER CUTOFF ROAD</text><text x="845" y="470" transform="rotate(-90 845 470)">N BOYER AVENUE</text></g><path d="M350 629H713Q731 667 707 672H365Q342 667 350 629" fill="#20443c" opacity=".65"/><path d="M350 629H713Q731 667 707 672H365Q342 667 350 629" fill="url(#park-grid)"/><path d="M369 650q150-17 323 0" stroke="#567b65" stroke-dasharray="3 3" fill="none"/><g fill="#426957"><circle cx="383" cy="640" r="7"/><circle cx="416" cy="661" r="8"/><circle cx="637" cy="640" r="8"/><circle cx="677" cy="661" r="8"/></g><text x="540" y="654" font-family="Space Grotesk" font-size="9" letter-spacing="3" text-anchor="middle" fill="#78a095">UNIVERSITY PARK</text><text x="962" y="155" font-family="Space Grotesk" font-size="13" letter-spacing="4" text-anchor="middle" fill="#4d7895" transform="rotate(35 962 155)">PEND OREILLE</text><g data-amenity="0" role="button" tabindex="0" aria-label="社区中央公园" style="cursor:pointer"><circle cx="555" cy="631" r="14" fill="#1b3d3e" stroke="#64a18d"/><text x="555" y="636" fill="#9bc8b3" text-anchor="middle" font-size="17">♧</text></g><g><circle cx="291" cy="243" r="4" fill="#5b9ffa"/><circle cx="774" cy="621" r="4" fill="#5b9ffa"/><path d="M291 227v-13h13M774 637v13h-13" stroke="#4a7eaf" fill="none"/></g></g></g><rect width="1100" height="850" fill="url(#vignette)" pointer-events="none"/></svg>`;
  bindPan();
}
function updateIllustration() {
  const world = el('map-world');
  if (world) world.setAttribute('transform', `translate(${panX} ${panY}) translate(550 425) scale(${zoom} ${zoom * Math.max(.3, Math.cos(pitch * Math.PI / 180))}) rotate(${demoBearing}) translate(-550 -425)`);
  renderIllustratedBuildings();
}
function renderIllustratedBuildings() {
  const parent = document.querySelector('.plot')?.parentElement?.parentElement;
  if (!parent) return;
  let group = document.querySelector('#illustrated-buildings');
  if (!group) {
    group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = 'illustrated-buildings';
    parent.appendChild(group);
  }
  const ids = new Set(visibleLots().map((lot) => lot.id));
  group.innerHTML = lots.map((lot) => {
    const x = lot.x + 9;
    const y = lot.y + 9;
    const h = lot.height * heightMultiplier * Math.sin(pitch * Math.PI / 180) * 1.5;
    const dx = h * .44;
    const dy = -h;
    const selected = lot.id === selectedId;
    const opacity = activeView === 'amenities' || ids.has(lot.id) ? 1 : .12;
    return `<g role="button" tabindex="0" aria-label="建筑 ${lot.number}" data-lot="${lot.id}" opacity="${opacity}" style="cursor:pointer"><path d="M${x} ${y + 23}l24 0 ${dx + 13} ${h * .25} -24 0Z" fill="#020913" opacity=".5"/><path d="M${x + 24} ${y}v23l${dx} ${dy}v-23Z" fill="${selected ? '#3679bf' : '#234768'}" stroke="#518ac1" stroke-width=".6"/><path d="M${x} ${y + 23}h24l${dx} ${dy}h-24Z" fill="${selected ? '#4b97e1' : '#315c83'}" stroke="#518ac1" stroke-width=".6"/><path d="M${x + dx} ${y + dy}h24v23h-24Z" fill="${selected ? '#85c5ff' : colors[lot.status]}" fill-opacity=".9" stroke="${selected ? '#d0edff' : '#82b1d2'}" stroke-width="1"/><path d="M${x + dx + 4} ${y + dy + 5}h16v13h-16Z" fill="#172e47" opacity=".5"/></g>`;
  }).join('');
}
function updateView() {
  tilted = pitch > 0;
  requireElement('tilt').classList.toggle('active', tilted);
  requireElement('tilt').setAttribute('aria-pressed', String(tilted));
  requireElement('pitch-value').textContent = `${Math.round(pitch)}°`;
  requireElement('height-value').textContent = `${heightMultiplier.toFixed(1)}×`;
  const range = el('pitch-range');
  if (range instanceof HTMLInputElement) range.value = String(Math.round(pitch));
  if (activeMap) {
    if (Math.abs(activeMap.getPitch() - pitch) > .5) activeMap.easeTo({ pitch, duration: 0 });
    if (activeMap.getLayer('demo-buildings')) {
      activeMap.setPaintProperty('demo-buildings', 'model-scale', modelScale());
    }
    if (activeMap.getLayer('lot-volumes')) {
      activeMap.setPaintProperty('lot-volumes', 'fill-extrusion-height', ['*', ['get', 'height'], heightMultiplier]);
    }
    if (activeMap.getLayer('demo-buildings')) {
      activeMap.setPaintProperty('demo-buildings', 'model-translation', modelTranslation());
    }
  }
  updateIllustration();
}
function bindPan() {
  const svg = requireElement('site-svg');
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let distance = 0;
  let rotating = false;
  svg.addEventListener('contextmenu', (event) => event.preventDefault());
  svg.addEventListener('pointerdown', (event) => {
    if (!(event instanceof PointerEvent) || ![0, 2].includes(event.button)) return;
    rotating = event.button === 2;
    if (rotating) { event.preventDefault(); svg.setPointerCapture(event.pointerId); }
    dragging = true; lastX = event.clientX; lastY = event.clientY; distance = 0;
  });
  svg.addEventListener('pointermove', (event) => {
    if (!dragging || !(event instanceof PointerEvent)) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    distance += Math.abs(dx) + Math.abs(dy);
    lastX = event.clientX; lastY = event.clientY;
    if (rotating) {
      pitch = Math.max(0, Math.min(75, pitch - dy * .35));
      demoBearing += dx * .35;
      updateView();
    } else {
      panX += dx; panY += dy;
      updateIllustration();
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });
  svg.addEventListener('lostpointercapture', () => { dragging = false; });
  svg.addEventListener('pointerleave', () => { if (!rotating) dragging = false; });
  svg.addEventListener('click', (event) => {
    if (distance > 5) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  svg.addEventListener('wheel', (event) => {
    if (!(event instanceof WheelEvent)) return;
    event.preventDefault();
    zoom = Math.max(.65, Math.min(2.8, zoom + (event.deltaY > 0 ? -.08 : .08)));
    updateIllustration();
  }, { passive: false });
}
function coordinates(x, y) {
  const angle = -24 * Math.PI / 180;
  const rx = 560 + (x - 560) * Math.cos(angle) - (y - 440) * Math.sin(angle);
  const ry = 440 + (x - 560) * Math.sin(angle) + (y - 440) * Math.cos(angle);
  return [-116.563 + (rx - 550) * .000014, 48.298 - (ry - 425) * .0000094];
}
function featureCollection() {
  return { type: 'FeatureCollection', features: lots.map((lot) => ({ type: 'Feature', properties: { id: lot.id, label: String(lot.index + 1), color: colors[lot.status], status: lot.status, height: lot.height }, geometry: { type: 'Polygon', coordinates: [[coordinates(lot.x, lot.y), coordinates(lot.x + 43, lot.y), coordinates(lot.x + 43, lot.y + 44), coordinates(lot.x, lot.y + 44), coordinates(lot.x, lot.y)]] } })) };
}
function buildingCollection() {
  return { type: 'FeatureCollection', features: lots.map((lot) => ({ type: 'Feature', id: lot.index, properties: { id: lot.id, label: String(lot.index + 1), color: colors[lot.status], height: lot.height }, geometry: { type: 'Point', coordinates: coordinates(lot.x + 21, lot.y + 20) } })) };
}
function modelScale() {
  return ['match', ['get', 'height'], 7, ['literal', [1.1, 1.1, 7 / 11 * heightMultiplier]], 10, ['literal', [1.1, 1.1, 10 / 11 * heightMultiplier]], 13, ['literal', [1.1, 1.1, 13 / 11 * heightMultiplier]], ['literal', [1.1, 1.1, 16 / 11 * heightMultiplier]]];
}
function modelTranslation() {
  return ['match', ['get', 'height'], 7, ['literal', [0, 0, 7 * heightMultiplier]], 10, ['literal', [0, 0, 10 * heightMultiplier]], 13, ['literal', [0, 0, 13 * heightMultiplier]], ['literal', [0, 0, 16 * heightMultiplier]]];
}
function updateMapSelection() {
  renderIllustratedBuildings();
  if (!activeMap || !activeMap.getLayer('lot-fill')) return;
  activeMap.setPaintProperty('lot-fill', 'fill-opacity', ['case', ['==', ['get', 'id'], selectedId], .8, .3]);
  activeMap.setPaintProperty('lot-lines', 'line-width', ['case', ['==', ['get', 'id'], selectedId], 3, 1]);
  const ids = visibleLots().map((lot) => lot.id);
  const filter = activeView === 'amenities' ? null : ['in', ['get', 'id'], ['literal', ids]];
  ['lot-fill', 'lot-lines', 'lot-labels', 'lot-volumes', 'demo-buildings'].forEach((id) => { if (activeMap.getLayer(id)) activeMap.setFilter(id, filter); });
  if (activeMap.getLayer('lot-volumes')) {
    activeMap.setPaintProperty('lot-volumes', 'fill-extrusion-color', ['case', ['==', ['get', 'id'], selectedId], '#9bd6ff', ['get', 'color']]);
  }
  if (activeMap.getLayer('demo-buildings')) {
    activeMap.setPaintProperty('demo-buildings', 'model-color', ['case', ['==', ['get', 'id'], selectedId], '#9bd6ff', ['get', 'color']]);
    activeMap.setPaintProperty('demo-buildings', 'model-color-mix-intensity', ['case', ['==', ['get', 'id'], selectedId], .65, .2]);
  }
}
function sitePlanCollection() {
  const polygon = (kind, points, name = '') => ({ type: 'Feature', properties: { kind, name }, geometry: { type: 'Polygon', coordinates: [points.map(([x, y]) => coordinates(x, y))] } });
  const line = (points, name = '') => ({ type: 'Feature', properties: { kind: 'road', name }, geometry: { type: 'LineString', coordinates: points.map(([x, y]) => coordinates(x, y)) } });
  const features = [
    polygon('site', [[298, 228], [774, 228], [774, 621], [298, 621], [298, 228]], 'UNIVERSITY PLACE'),
    polygon('park', [[350, 629], [713, 629], [722, 655], [707, 672], [365, 672], [343, 655], [350, 629]], 'UNIVERSITY PARK'),
    line([[314, 243], [756, 243], [756, 605], [314, 605], [314, 243]]),
    line([[314, 371], [756, 371]], 'ASPEN LANE'),
    line([[314, 500], [756, 500]], 'CEDAR LANE'),
    line([[530, 243], [530, 605]]),
    line([[314, 243], [756, 243]], 'UNIVERSITY PARK WAY'),
    line([[314, 605], [756, 605]], 'WILLOW DRIVE')
  ];
  for (let i = 0; i < 24; i++) {
    features.push({ type: 'Feature', properties: { kind: 'tree', name: '' }, geometry: { type: 'Point', coordinates: coordinates(365 + i * 14, i % 2 ? 661 : 639) } });
  }
  return { type: 'FeatureCollection', features };
}
function addSitePlanLayers() {
  if (!activeMap || activeMap.getSource('site-plan')) return;
  activeMap.addSource('site-plan', { type: 'geojson', data: sitePlanCollection() });
  activeMap.addLayer({ id: 'site-ground', type: 'fill', source: 'site-plan', filter: ['==', ['get', 'kind'], 'site'], paint: { 'fill-color': '#132a36', 'fill-opacity': .62 } });
  activeMap.addLayer({ id: 'site-boundary', type: 'line', source: 'site-plan', filter: ['==', ['get', 'kind'], 'site'], paint: { 'line-color': '#79b5dd', 'line-width': 1.5, 'line-dasharray': [3, 3] } });
  activeMap.addLayer({ id: 'site-park', type: 'fill', source: 'site-plan', filter: ['==', ['get', 'kind'], 'park'], paint: { 'fill-color': '#28624d', 'fill-opacity': .8 } });
  const roadWidth = ['interpolate', ['exponential', 2], ['zoom'], 14, 2, 16, 8, 18, 32, 20, 128];
  activeMap.addLayer({ id: 'site-road-casing', type: 'line', source: 'site-plan', filter: ['==', ['get', 'kind'], 'road'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4b6d89', 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 14, 2.5, 16, 10, 18, 40, 20, 160] } });
  activeMap.addLayer({ id: 'site-roads', type: 'line', source: 'site-plan', filter: ['==', ['get', 'kind'], 'road'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#1c3040', 'line-width': roadWidth } });
  activeMap.addLayer({ id: 'site-road-center', type: 'line', source: 'site-plan', filter: ['==', ['get', 'kind'], 'road'], paint: { 'line-color': '#819ab0', 'line-width': .7, 'line-dasharray': [5, 8], 'line-opacity': .55 } });
  activeMap.addLayer({ id: 'site-trees', type: 'circle', source: 'site-plan', filter: ['==', ['get', 'kind'], 'tree'], paint: { 'circle-color': '#487d64', 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 14, 1, 16, 4, 18, 16], 'circle-stroke-color': '#70a58a', 'circle-stroke-width': .5, 'circle-pitch-alignment': 'map' } });
}
function addMapLayers() {
  if (!activeMap || activeMap.getSource('homesites')) return;
  activeMap.setProjection('mercator');
  activeMap.setLights([
    { id: 'ambient', type: 'ambient', properties: { color: '#d4eaff', intensity: .55 } },
    { id: 'sun', type: 'directional', properties: { color: '#fff1db', intensity: .8, direction: [210, 40], 'cast-shadows': true, 'shadow-intensity': .5 } }
  ]);
  activeMap.addModel('nexus-house', './models/house.gltf');
  addSitePlanLayers();
  activeMap.addSource('homesites', { type: 'geojson', data: featureCollection() });
  activeMap.addLayer({ id: 'lot-fill', type: 'fill', source: 'homesites', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': .3 } });
  activeMap.addLayer({ id: 'lot-lines', type: 'line', source: 'homesites', paint: { 'line-color': ['get', 'color'], 'line-width': 1 } });
  activeMap.addLayer({ id: 'lot-volumes', type: 'fill-extrusion', source: 'homesites', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['*', ['get', 'height'], heightMultiplier], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .75, 'fill-extrusion-vertical-gradient': true } });
  activeMap.addSource('demo-buildings', { type: 'geojson', data: buildingCollection() });
  activeMap.addLayer({ id: 'demo-buildings', type: 'model', source: 'demo-buildings', layout: { 'model-id': 'nexus-house' }, paint: { 'model-scale': modelScale(), 'model-translation': modelTranslation(), 'model-rotation': [0, 0, 24], 'model-color': ['get', 'color'], 'model-color-mix-intensity': .2, 'model-cast-shadows': true, 'model-receive-shadows': true } });
  activeMap.addLayer({ id: 'lot-labels', type: 'symbol', source: 'demo-buildings', layout: { 'symbol-placement': 'point', 'symbol-z-elevate': true, 'symbol-z-order': 'auto', 'text-field': ['get', 'label'], 'text-size': 10, 'text-anchor': 'center', 'text-offset': [0, 0], 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'viewport', 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'symbol-z-offset': 1, 'text-color': '#ddeeff', 'text-halo-color': '#0b1b2b', 'text-halo-width': 1 } });
  activeMap.addLayer({ id: 'site-road-labels', type: 'symbol', source: 'site-plan', filter: ['all', ['==', ['get', 'kind'], 'road'], ['!=', ['get', 'name'], '']], layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 9, 'text-letter-spacing': .15 }, paint: { 'text-color': '#9fb8d2', 'text-halo-color': '#122335', 'text-halo-width': 1.5 } });
  activeMap.addLayer({ id: 'site-park-label', type: 'symbol', source: 'site-plan', filter: ['==', ['get', 'kind'], 'park'], layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-letter-spacing': .15 }, paint: { 'text-color': '#a3d6bb', 'text-halo-color': '#18372c', 'text-halo-width': 1 } });
  updateMapSelection();
}
function fallbackMap(message) {
  clearTimeout(mapTimer);
  mapFailed = true;
  if (activeMap) { activeMap.remove(); activeMap = null; }
  requireElement('illustrated-map').hidden = false;
  requireElement('view-mode').textContent = '示意立体';
  updateView();
  requireElement('mode-badge').textContent = 'DEMO MAP';
  requireElement('map-note').textContent = '示意总平图 · 非真实地籍数据';
  if (message) toast(message);
}
function initMapbox(token) {
  const mapbox = Reflect.get(window, 'mapboxgl');
  if (!token) return;
  if (!mapbox || !mapbox.supported()) { fallbackMap('Mapbox 加载失败或浏览器不支持 WebGL，已使用交互示意地图'); return; }
  if (activeMap) activeMap.remove();
  mapFailed = false;
  mapbox.accessToken = token;
  try {
    activeMap = new mapbox.Map({ container: 'map', style: currentStyle === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/satellite-streets-v12', center: coordinates(550, 430), zoom: 16.2, pitch, bearing: -20, maxPitch: 75, dragRotate: true, pitchWithRotate: true, antialias: true, attributionControl: true });
    activeMap.dragRotate.enable();
    activeMap.touchZoomRotate.enableRotation();
    activeMap.getCanvas().addEventListener('contextmenu', (event) => event.preventDefault());
    mapTimer = setTimeout(() => fallbackMap('Mapbox 连接超时，已切回示意地图，可检查 Token 和网络后重试'), 18000);
    activeMap.on('load', () => {
      if (mapFailed) return;
      clearTimeout(mapTimer);
      requireElement('illustrated-map').hidden = true;
      requireElement('view-mode').textContent = '原生 glTF 3D';
      requireElement('mode-badge').textContent = 'MAPBOX LIVE';
      requireElement('map-note').textContent = 'Mapbox 实景底图 · 地块为虚构演示数据';
      addMapLayers();
    });
    activeMap.on('style.load', addMapLayers);
    activeMap.on('pitch', () => { if (activeMap) { pitch = activeMap.getPitch(); updateView(); } });
    activeMap.on('click', (event) => {
      if (!activeMap) return;
      const layers = ['demo-buildings', 'lot-volumes', 'lot-fill'].filter((id) => activeMap.getLayer(id));
      if (!layers.length) return;
      const feature = activeMap.queryRenderedFeatures(event.point, { layers })[0];
      if (feature) selectLot(feature.properties.id);
    });
    activeMap.on('mouseenter', 'demo-buildings', () => { if (activeMap) activeMap.getCanvas().style.cursor = 'pointer'; });
    activeMap.on('mouseleave', 'demo-buildings', () => { if (activeMap) activeMap.getCanvas().style.cursor = ''; });
    activeMap.on('mouseenter', 'lot-fill', () => { if (activeMap) activeMap.getCanvas().style.cursor = 'pointer'; });
    activeMap.on('mouseleave', 'lot-fill', () => { if (activeMap) activeMap.getCanvas().style.cursor = ''; });
    activeMap.on('error', (event) => {
      const status = event.error?.status;
      if (status === 401 || status === 403) fallbackMap('Mapbox Token 无效或权限不足，已切回示意地图');
    });
  } catch { fallbackMap('Mapbox 初始化失败，已使用示意地图'); }
}
function openModal(content) {
  const dialog = el('modal');
  requireElement('modal-content').innerHTML = content;
  if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
}
function closeModal() { const dialog = el('modal'); if (dialog instanceof HTMLDialogElement) dialog.close(); }
function openContact() {
  const lot = lots.find((item) => item.id === selectedId);
  openModal(`<div class="eyebrow">LET'S FIND YOUR PLACE</div><h2>预约你的理想生活</h2><p>${lot ? `感兴趣的房源：${lot.name} · ${lot.number}` : 'University Place · 期待与你相遇'}</p><form id="inquiry-form"><label>您的称呼<input name="name" autocomplete="name" required placeholder="请输入姓名" maxlength="60"></label><label>联系电话<input name="phone" type="tel" autocomplete="tel" required pattern="[+0-9 ()-]{6,25}" placeholder="请输入联系电话" maxlength="25"></label><label>备注<textarea name="message" placeholder="告诉我们你的参观时间或居住期待" rows="3" maxlength="500"></textarea></label><button class="primary" type="submit">提交预约意向 ↗</button></form><p style="font-size:10px">演示模式：不会发送或保存个人信息，也不会产生真实预约。</p>`);
}
function openSettings() {
  openModal('<div class="eyebrow">MAP ENGINE / MAPBOX GL JS</div><h2>连接真实世界</h2><p>输入 Mapbox 公共访问 Token，切换真实地图底图。地块仍为演示数据，不代表真实楼盘边界。留空可使用无需 Token 的交互示意地图。</p><form id="token-form"><label>Mapbox Public Token<input id="token-input" type="password" placeholder="pk.eyJ…" autocomplete="off" spellcheck="false"></label><button class="primary" type="submit">应用地图配置 ↗</button></form><p style="font-size:10px">只使用 pk. 公共 Token，请配置 localhost 来源限制。Token 仅保存在当前浏览器，不会上传到本地服务器。</p>');
  const form = requireElement('token-form');
  const label = document.createElement('label');
  label.textContent = '语言 / Language';
  const select = document.createElement('select');
  select.id = 'language-select';
  select.setAttribute('aria-label', '语言 / Language');
  select.innerHTML = '<option value="zh-CN">简体中文</option><option value="en">English</option>';
  select.value = getLanguage();
  label.appendChild(select);
  form.before(label);
  select.addEventListener('change', () => {
    setLanguage(select.value);
    renderList();
    if (selectedId) renderDetail();
  });
  const input = el('token-input');
  if (input instanceof HTMLInputElement) input.value = safeRead('nexus-mapbox-token', '');
}
requireElement('listing').addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const save = event.target.closest('[data-save]');
  if (save) { toggleSave(save.getAttribute('data-save') || ''); return; }
  const lot = event.target.closest('[data-lot]');
  if (lot) selectLot(lot.getAttribute('data-lot') || '');
  const amenity = event.target.closest('[data-amenity]');
  if (amenity) showAmenity(Number(amenity.getAttribute('data-amenity')));
});
requireElement('illustrated-map').addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const plot = event.target.closest('[data-lot]');
  if (plot) { selectLot(plot.getAttribute('data-lot') || ''); return; }
  const amenity = event.target.closest('[data-amenity]');
  if (amenity) showAmenity(Number(amenity.getAttribute('data-amenity')));
});
function showAmenity(index) {
  const item = amenities[index];
  if (!item) return;
  if (activeMap) {
    activeMap.flyTo({ center: coordinates(item.x, item.y), zoom: 15, duration: 900 });
    const mapbox = Reflect.get(window, 'mapboxgl');
    new mapbox.Popup().setLngLat(coordinates(item.x, item.y)).setHTML(`<b>${item.name}</b><p>${item.category} · ${item.minutes}（示例）</p>`).addTo(activeMap);
  } else {
    zoom = 1.1; panX = (550 - item.x) * .55; panY = (425 - item.y) * .55; updateIllustration();
  }
  toast(`${item.name} · ${item.minutes}，配套位置及时间仅作示意`);
}
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); requireElement('search').focus(); }
  if (event.key === 'Escape') closeDetail();
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.matches('[data-lot][role="button"], [data-amenity][role="button"]')) { event.preventDefault(); if (event.target instanceof HTMLElement || event.target instanceof SVGElement) event.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.getAttribute('data-view') || 'homes')));
document.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', () => { if (activeView === 'amenities') activeView = 'homes'; statusFilter = button.getAttribute('data-status') || 'all'; renderList(); }));
requireElement('search').addEventListener('input', renderList);
requireElement('sort').addEventListener('click', () => { sorting = true; ascending = !ascending; renderList(); toast(ascending ? '房价由低到高排列' : '房价由高到低排列'); });
requireElement('detail').addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const save = event.target.closest('[data-save]');
  if (save) toggleSave(save.getAttribute('data-save') || '');
  const action = event.target.closest('[data-action]')?.getAttribute('data-action');
  if (action === 'close-detail') closeDetail();
  if (action === 'inquire') openContact();
});
requireElement('contact').addEventListener('click', openContact);
requireElement('settings').addEventListener('click', openSettings);
requireElement('about').addEventListener('click', () => openModal('<div class="eyebrow">PROJECT OVERVIEW</div><h2>University Place</h2><p>以自然为邻，以未来为家。48 席独立住宅地块，搭配开放绿地与便捷的城市生活，探索属于你的下一章。</p><div class="metrics"><div><b>48<small>席</small></b><span>住宅地块</span></div><div><b>188–276</b><span>建筑面积 m²</span></div><div><b>3–4</b><span>卧室配置</span></div></div><p>本页面为参考社区地图交互的原创视觉 Demo。房源、价格、位置、配套及通勤时间均为虚构示例，不构成销售承诺。</p><button class="primary" id="overview-config">配置 Mapbox 地图引擎 ↗</button>'));
requireElement('modal-content').addEventListener('click', (event) => { if (event.target instanceof Element && event.target.closest('#overview-config')) openSettings(); });
requireElement('modal-content').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!(event.target instanceof HTMLFormElement)) return;
  if (event.target.id === 'inquiry-form') { closeModal(); toast('演示提交成功：未发送或保存个人信息，未创建真实预约'); }
  if (event.target.id === 'token-form') {
    const token = inputValue('token-input').trim();
    if (token && !token.startsWith('pk.')) { toast('请使用 pk. 开头的公共 Token，不要输入 sk. 私密 Token'); return; }
    safeWrite('nexus-mapbox-token', token);
    closeModal();
    if (token) initMapbox(token); else fallbackMap('已切换为无需 Token 的交互示意地图');
  }
});
const changeZoom = (delta) => { if (activeMap) activeMap.zoomTo(activeMap.getZoom() + delta, { duration: 250 }); else { zoom = Math.max(.65, Math.min(2.8, zoom + delta * .2)); updateIllustration(); } };
requireElement('zoom-in').addEventListener('click', () => changeZoom(1));
requireElement('zoom-out').addEventListener('click', () => changeZoom(-1));
const resetMap = () => { zoom = 1; panX = 0; panY = 0; demoBearing = 0; updateIllustration(); if (activeMap) activeMap.flyTo({ center: coordinates(550, 430), zoom: 16.2, bearing: -20, pitch }); };
requireElement('reset').addEventListener('click', resetMap);
requireElement('compass').addEventListener('click', resetMap);
requireElement('tilt').addEventListener('click', () => { pitch = tilted ? 0 : 55; updateView(); });
requireElement('pitch-range').addEventListener('input', () => { pitch = Number(inputValue('pitch-range')); updateView(); });
requireElement('height-range').addEventListener('input', () => { heightMultiplier = Number(inputValue('height-range')); updateView(); });
document.querySelectorAll('[data-style]').forEach((button) => button.addEventListener('click', () => {
  const style = button.getAttribute('data-style') || 'dark';
  currentStyle = style;
  document.querySelectorAll('[data-style]').forEach((node) => node.classList.toggle('active', node === button));
  if (activeMap) activeMap.setStyle(style === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/satellite-streets-v12');
  else if (style === 'satellite') { toast('卫星影像需要 Mapbox Token，请先配置'); openSettings(); currentStyle = 'dark'; document.querySelectorAll('[data-style]').forEach((node) => node.classList.toggle('active', node.getAttribute('data-style') === 'dark')); }
}));
startTranslations();
buildIllustration();
updateView();
renderList();
const initialLot = new URLSearchParams(location.search).get('lot');
if (initialLot) selectLot(initialLot, false);
try {
  const response = await fetch('./config.json', { cache: 'no-store' });
  const config = await response.json();
  const token = safeRead('nexus-mapbox-token', '') || config.mapboxToken;
  if (token) initMapbox(token);
} catch { /* 静态托管无 /api/config 时静默跳过，直接使用无需 Token 的示意地图 */ }
