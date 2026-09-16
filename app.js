import { loadState, saveState, clearState } from './db.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const ROUTINE_PRESETS = [
  ['Bangun Tidur','🌅','morning','06:00'], ['Minum Air','💧','morning','06:05'], ['Berjemur','☀️','morning','07:00'],
  ['Stretching','🧘','morning','07:15'], ['Mandi','🚿','morning','07:30'], ['Sarapan','🍳','morning','08:00'],
  ['Deep Work','◫','day','09:00'], ['Makan Siang','🍚','day','12:30'], ['Masak','♨️','day','18:00'],
  ['Reading','📖','evening','20:30'], ['Planning Besok','✓','evening','21:30'], ['Tidur','🌙','evening','22:30']
];
const BODY_TYPES = ['Gym','Running','Walking','Cycling','Swimming','Yoga','Calisthenics','Hiking','Sports','Other'];
const SKIN_PRESETS = ['Cleanser','Toner','Serum','Moisturizer','Sunscreen','Retinol','Exfoliant','Eye Cream'];

let state = null;
let route = 'today';
let onboardingDraft = new Set(['Bangun Tidur','Berjemur','Sarapan','Tidur']);

function defaultState() {
  return {
    version: 1,
    onboarded: false,
    routines: [],
    body: [],
    skincare: [],
    plans: [],
    overrides: {},
    logs: {},
    settings: { weekStartsMonday: true, defaultDayType: 'auto' },
    createdAt: new Date().toISOString()
  };
}

function mergeState(raw) {
  const base = defaultState();
  return {
    ...base,
    ...(raw || {}),
    settings: { ...base.settings, ...(raw?.settings || {}) },
    routines: raw?.routines || [], body: raw?.body || [], skincare: raw?.skincare || [], plans: raw?.plans || [],
    overrides: raw?.overrides || {}, logs: raw?.logs || {}
  };
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function parseDateKey(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); }
function fmtDate(date = new Date()) { return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long'}).format(date); }
function fmtShortDate(key) { return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short'}).format(parseDateKey(key)); }
function todayKey() { return localDateKey(new Date()); }
function esc(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function allDays() { return [0,1,2,3,4,5,6]; }
function getLog(dateKey) { return state.logs[dateKey] ||= { items:{}, note:'', mood:null }; }
function getOverride(dateKey) { return state.overrides[dateKey] ||= { times:{}, quickItems:[], dayType:'auto' }; }
function scheduleTime(item, date) {
  const dow = date.getDay();
  if (item.timesByDay && item.timesByDay[dow]) return item.timesByDay[dow];
  return item.time || null;
}
function dueStage(plan, dateKey) {
  if (plan.doneAt) return 'done';
  if (plan.stage === 'idea') return 'idea';
  if (plan.stage === 'must') return 'must';
  if (plan.stage === 'planned' && plan.dueDate && plan.dueDate <= dateKey) return 'must';
  return plan.stage;
}
function timeToMinutes(t) { if (!t) return null; const [h,m] = t.split(':').map(Number); return h*60+m; }
function minutesToTime(min) { min = ((min % 1440)+1440)%1440; return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`; }
function isScheduledOn(item, date) { return item.active !== false && (!item.days || item.days.includes(date.getDay())); }

function generatedItems(dateKey = todayKey()) {
  const date = parseDateKey(dateKey);
  const ov = state.overrides[dateKey] || {times:{},quickItems:[],dayType:'auto'};
  const items = [];

  state.routines.filter(x => isScheduledOn(x,date)).forEach((r, order) => {
    const id = `routine:${r.id}`;
    // Daily Routine sengaja tidak memakai jam. Waktu lama dari versi sebelumnya diabaikan.
    items.push({id, source:'routine', sourceId:r.id, title:r.name, subtitle:r.notes || (r.minimum ? `Minimum: ${r.minimum}` : ''), time:null, tracked:r.tracked !== false, category:r.category || 'routine', order});
  });
  for (const b of state.body.filter(x => isScheduledOn(x,date))) {
    const id = `body:${b.id}`;
    const target = b.targetValue ? `${b.targetValue}${b.targetUnit ? ' '+b.targetUnit : ''}` : '';
    items.push({id, source:'body', sourceId:b.id, title:b.name || b.type, subtitle:target ? `Target ${target}${b.minimum ? ` · Minimum ${b.minimum}`:''}` : (b.minimum ? `Minimum ${b.minimum}`:''), time:ov.times?.[id] ?? scheduleTime(b,date), tracked:b.tracked !== false, category:'body', metricUnit:b.targetUnit || ''});
  }
  for (const s of state.skincare.filter(x => isScheduledOn(x,date))) {
    for (const period of (s.periods || ['am'])) {
      const id = `skin:${s.id}:${period}`;
      const defaultTime = period === 'am' ? '07:30' : '21:00';
      items.push({id, source:'skincare', sourceId:s.id, title:s.name, subtitle:period === 'am' ? 'Morning skincare' : 'Night skincare', time:ov.times?.[id] ?? (s.time?.[period] || defaultTime), tracked:s.tracked !== false, category:period === 'am' ? 'morning' : 'evening'});
    }
  }
  for (const p of state.plans) {
    if (dueStage(p,dateKey) === 'must' && !p.doneAt) {
      const id = `plan:${p.id}`;
      items.push({id, source:'plan', sourceId:p.id, title:p.title, subtitle:p.notes || (p.dueDate && p.dueDate < dateKey ? `Overdue · ${fmtShortDate(p.dueDate)}` : 'Must do'), time:ov.times?.[id] ?? p.time ?? null, tracked:true, category:'plan', overdue:!!(p.dueDate && p.dueDate < dateKey)});
    }
  }
  for (const q of (ov.quickItems || [])) {
    items.push({id:`quick:${q.id}`, source:'quick', sourceId:q.id, title:q.title, subtitle:q.notes || 'Today only', time:q.time || null, tracked:q.tracked !== false, category:q.category || 'quick'});
  }

  return items.sort((a,b) => {
    if (a.source === 'routine' && b.source === 'routine') return (a.order ?? 0) - (b.order ?? 0);
    const am = timeToMinutes(a.time), bm = timeToMinutes(b.time);
    if (am == null && bm == null) return a.title.localeCompare(b.title);
    if (am == null) return 1;
    if (bm == null) return -1;
    return am - bm;
  });
}

function itemStatus(dateKey,id) { return state.logs[dateKey]?.items?.[id]?.status || 'pending'; }
function completionForDate(dateKey) {
  const scheduled = generatedItems(dateKey).filter(i => i.tracked);
  if (!scheduled.length) return {percent:100, done:0, total:0, skipped:0};
  let done=0, skipped=0, denominator=0;
  for (const item of scheduled) {
    const st = itemStatus(dateKey,item.id);
    if (st === 'skipped') { skipped++; continue; }
    denominator++;
    if (st === 'done') done++;
  }
  return { percent: denominator ? Math.round(done/denominator*100) : 100, done, total:denominator, skipped };
}

async function persist(render = true) { await saveState(state); if (render) renderApp(); }
function toast(msg) {
  const root = $('#toastRoot'); root.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  setTimeout(() => { if (root) root.innerHTML=''; }, 2200);
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
function modal(title, html, footer='') {
  $('#modalRoot').innerHTML = `<div class="modal-backdrop" data-close-modal><div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" data-close>×</button></div>${html}${footer ? `<div class="modal-footer">${footer}</div>`:''}
  </div></div>`;
  $('[data-close]').onclick = closeModal;
  $('[data-close-modal]').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
}

function renderApp() {
  const titles = {today:'Today', routine:'Routine', body:'Body', skincare:'Skincare', plan:'Plan', consistency:'Consistency', settings:'Settings'};
  $('#pageTitle').textContent = titles[route];
  $('#quickAddBtn').style.display = route === 'today' ? '' : 'none';
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === route));
  const main = $('#main');
  const renderers = {today:renderToday, routine:renderRoutine, body:renderBody, skincare:renderSkincare, plan:renderPlan, consistency:renderConsistency, settings:renderSettings};
  main.innerHTML = renderers[route]();
  bindRouteActions();
  if (route === 'today') installTodayGestures();
  if (route === 'plan') installPlanDrag();
}

function renderToday() {
  const key = todayKey(), date = new Date(), items = generatedItems(key), c = completionForDate(key), log = getLog(key), ov = getOverride(key);
  const routineItems = items.filter(i => i.source === 'routine');
  const timed = items.filter(i => i.source !== 'routine' && i.time);
  const anytime = items.filter(i => i.source !== 'routine' && !i.time);
  const dayTypeAuto = [0,6].includes(date.getDay()) ? 'weekend' : 'work';
  const dayType = ov.dayType === 'auto' ? dayTypeAuto : ov.dayType;
  const card = item => {
    const st = itemStatus(key,item.id);
    const hasTime = item.source !== 'routine' && !!item.time;
    return `<article class="card today-item ${st}" data-today-id="${item.id}" data-time="${item.time || ''}">
      <div class="card-row">
        <button class="check-btn" data-action="toggle" data-id="${item.id}" aria-label="Toggle">${st==='done'?'✓':st==='skipped'?'–':''}</button>
        ${hasTime ? `<div class="item-time" data-action="time" data-id="${item.id}">${item.time}</div>` : ''}
        <div class="card-main" data-action="detail" data-id="${item.id}">
          <p class="card-title">${item.overdue?'<span style="color:var(--danger)">!</span> ':''}${esc(item.title)}</p>
          ${item.subtitle?`<p class="card-meta">${esc(item.subtitle)}</p>`:''}
        </div>
        ${hasTime?`<div class="drag-handle" data-drag-time="${item.id}">⋮⋮</div>`:''}
      </div>
      <div class="item-actions">
        ${st!=='skipped'?`<button class="action-btn warning" data-action="skip" data-id="${item.id}">Skip today</button>`:`<button class="action-btn" data-action="undo" data-id="${item.id}">Undo skip</button>`}
        ${item.source !== 'plan' && item.source !== 'quick'?`<button class="action-btn" data-action="edit-source" data-id="${item.id}">Edit schedule</button>`:''}
      </div>
    </article>`;
  };
  return `<section class="hero"><div><p class="hero-date">${esc(fmtDate(date))}</p><p class="hero-big">${greeting()}</p></div><div class="score-ring" style="--p:${c.percent}"><strong>${c.percent}%</strong></div></section>
    <section class="card"><div class="flex between center gap"><div><div class="section-title">Day type</div><p class="card-meta">Override hanya berlaku hari ini</p></div>
      <select id="dayType" class="select" style="width:auto"><option value="auto" ${ov.dayType==='auto'?'selected':''}>Auto (${dayType})</option><option value="work" ${ov.dayType==='work'?'selected':''}>Work day</option><option value="weekend" ${ov.dayType==='weekend'?'selected':''}>Weekend</option><option value="holiday" ${ov.dayType==='holiday'?'selected':''}>Holiday</option><option value="travel" ${ov.dayType==='travel'?'selected':''}>Travel</option><option value="sick" ${ov.dayType==='sick'?'selected':''}>Sick day</option></select>
    </div></section>
    <section class="section"><div class="section-head"><div><h2 class="section-title">Daily Routine</h2><p class="section-sub">Tanpa jam. Cukup checklist; swipe kiri untuk skip hari ini.</p></div></div>
      ${routineItems.length ? routineItems.map(card).join('') : '<div class="list-empty">Belum ada daily routine untuk hari ini.</div>'}
    </section>
    <section class="section"><div class="section-head"><div><h2 class="section-title">Scheduled</h2><p class="section-sub">Jam hanya dipakai untuk Body, Skincare, Plan, atau quick item jika diperlukan.</p></div></div>
      ${timed.length ? timed.map(card).join('') : '<div class="list-empty">Tidak ada aktivitas berjam hari ini.</div>'}
    </section>
    <section class="section"><div class="section-head"><h2 class="section-title">Anytime</h2></div>${anytime.length?anytime.map(card).join(''):'<div class="list-empty">Tidak ada item anytime.</div>'}</section>
    <section class="section"><div class="section-head"><h2 class="section-title">Daily note</h2></div><div class="card form">
      <div class="field"><label>Mood</label><div class="chips">${[1,2,3,4,5].map(n=>`<button class="chip ${log.mood===n?'active':''}" data-mood="${n}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>Catatan hari ini</label><textarea id="dailyNote" class="textarea" placeholder="Singkat saja…">${esc(log.note||'')}</textarea></div>
      <button id="saveDailyNote" class="ghost-btn">Save note</button>
    </div></section>`;
}
function greeting() { const h = new Date().getHours(); return h<11?'Good morning.':h<17?'Good afternoon.':'Good evening.'; }

function renderRoutine() {
  return `<section class="section"><div class="section-head"><div><h2 class="section-title">Routine templates</h2><p class="section-sub">Pilih aktivitas dan hari aktif. Daily Routine tidak memakai jam.</p></div><button class="primary-btn small-btn" data-add-routine>+ Add</button></div>
    ${state.routines.filter(r=>r.active!==false).map(r=>templateCard(r,'routine')).join('') || '<div class="list-empty">Belum ada routine.</div>'}
  </section>
  ${state.routines.some(r=>r.active===false)?`<section class="section"><h2 class="section-title">Archived</h2>${state.routines.filter(r=>r.active===false).map(r=>templateCard(r,'routine')).join('')}</section>`:''}`;
}

function renderBody() {
  return `<section class="section"><div class="section-head"><div><h2 class="section-title">Daily workout</h2><p class="section-sub">Gym, running, walking, cycling dan aktivitas fisik lain.</p></div><button class="primary-btn small-btn" data-add-body>+ Add</button></div>
    ${state.body.filter(x=>x.active!==false).map(b=>templateCard(b,'body')).join('') || '<div class="list-empty">Tambahkan aktivitas tubuh pertama.</div>'}
  </section>${state.body.some(x=>x.active===false)?`<section class="section"><h2 class="section-title">Archived</h2>${state.body.filter(x=>x.active===false).map(b=>templateCard(b,'body')).join('')}</section>`:''}`;
}

function renderSkincare() {
  return `<section class="section"><div class="section-head"><div><h2 class="section-title">Skincare schedule</h2><p class="section-sub">Pilih produk, pagi/malam, dan hari aktif.</p></div><button class="primary-btn small-btn" data-add-skin>+ Add</button></div>
    ${state.skincare.filter(x=>x.active!==false).map(s=>templateCard(s,'skincare')).join('') || '<div class="list-empty">Belum ada skincare.</div>'}
  </section>${state.skincare.some(x=>x.active===false)?`<section class="section"><h2 class="section-title">Archived</h2>${state.skincare.filter(x=>x.active===false).map(s=>templateCard(s,'skincare')).join('')}</section>`:''}`;
}

function templateCard(x,type) {
  const days = (x.days||allDays()).map(d=>DAYS[d]).join(' ');
  let meta = days;
  if (type==='routine') meta = `${days}${x.minimum?` · min ${x.minimum}`:''}`;
  if (type==='body') meta = `${x.time||'Anytime'} · ${days}${x.targetValue?` · ${x.targetValue} ${x.targetUnit||''}`:''}`;
  if (type==='skincare') meta = `${(x.periods||[]).map(p=>p==='am'?'Morning':'Night').join(' + ')} · ${days}`;
  return `<article class="card"><div class="card-row"><div class="card-main"><p class="card-title">${esc(x.name||x.type)}</p><p class="card-meta">${esc(meta)}</p>${x.notes?`<p class="card-note">${esc(x.notes)}</p>`:''}</div><span class="pill ${x.tracked===false?'':'accent'}">${x.tracked===false?'not tracked':'tracked'}</span></div><div class="item-actions"><button class="action-btn" data-edit-template="${type}:${x.id}">Edit</button><button class="action-btn" data-archive-template="${type}:${x.id}">${x.active===false?'Restore':'Archive'}</button></div></article>`;
}
function renderPlan() {
  const key=todayKey();
  const lanes = [
    ['idea','Idea','Belum dikomitmenkan'],['planned','Akan Dilakukan','Bisa diberi tanggal'],['must','Harus Dilakukan','Due hari ini / overdue']
  ];
  return `<section class="section"><div class="section-head"><div><h2 class="section-title">Plan board</h2><p class="section-sub">Drag kartu antar kolom. Planned dengan tanggal yang tiba otomatis tampil sebagai Must Do.</p></div><button class="primary-btn small-btn" data-add-plan>+ Add</button></div>
    <div class="plan-board">${lanes.map(([stage,title,sub])=>{
      const cards = state.plans.filter(p=>!p.doneAt && dueStage(p,key)===stage);
      return `<div class="plan-lane" data-plan-lane="${stage}"><div class="plan-lane-head"><div><strong>${title}</strong><div class="card-meta">${sub}</div></div><span class="pill">${cards.length}</span></div>${cards.map(planCard).join('') || '<div class="list-empty">Kosong</div>'}</div>`;
    }).join('')}</div></section>
    <section class="section"><div class="section-head"><h2 class="section-title">Done</h2></div>${state.plans.filter(p=>p.doneAt).slice().sort((a,b)=>b.doneAt.localeCompare(a.doneAt)).slice(0,10).map(planCard).join('') || '<div class="list-empty">Belum ada task selesai.</div>'}</section>`;
}
function planCard(p) {
  const stage = dueStage(p,todayKey());
  const overdue = p.dueDate && p.dueDate < todayKey() && !p.doneAt;
  return `<article class="card plan-card" data-plan-id="${p.id}"><div class="card-row"><div class="plan-drag" data-plan-drag="${p.id}">⋮⋮</div><div class="card-main"><p class="card-title">${overdue?'<span style="color:var(--danger)">!</span> ':''}${esc(p.title)}</p><p class="card-meta">${p.dueDate?`${overdue?'Overdue · ':''}${fmtShortDate(p.dueDate)}`:stage==='idea'?'No date':'No due date'}</p>${p.notes?`<p class="card-note">${esc(p.notes)}</p>`:''}</div></div><div class="item-actions">${!p.doneAt?`<button class="action-btn" data-plan-done="${p.id}">Complete</button><button class="action-btn" data-edit-plan="${p.id}">Edit</button>`:`<button class="action-btn" data-plan-restore="${p.id}">Restore</button>`}</div></article>`;
}

function renderConsistency() {
  const days=[]; for(let i=29;i>=0;i--){const d=new Date(); d.setDate(d.getDate()-i); const k=localDateKey(d); days.push([k,completionForDate(k)]);} 
  const last7=days.slice(-7); const avg=Math.round(last7.reduce((s,[,c])=>s+c.percent,0)/7);
  const routineStats = statsForSource('routine',30), bodyStats=statsForSource('body',30), skinStats=statsForSource('skincare',30);
  const donePlans=state.plans.filter(p=>p.doneAt).length, overdue=state.plans.filter(p=>!p.doneAt&&p.dueDate&&p.dueDate<todayKey()).length;
  return `<section class="grid-2"><div class="stat-card"><span>Last 7 days</span><strong>${avg}%</strong></div><div class="stat-card"><span>Tasks done</span><strong>${donePlans}</strong></div><div class="stat-card"><span>Overdue</span><strong>${overdue}</strong></div><div class="stat-card"><span>Current streak</span><strong>${overallStreak()}d</strong></div></section>
    <section class="section"><div class="section-head"><div><h2 class="section-title">30 day heatmap</h2><p class="section-sub">Skipped bersifat netral dan tidak masuk denominator.</p></div></div><div class="card"><div class="heatmap">${days.map(([k,c])=>`<div class="heat-day" data-l="${c.percent===100?4:c.percent>=75?3:c.percent>=40?2:c.percent>0?1:0}" title="${k}: ${c.percent}%">${parseDateKey(k).getDate()}</div>`).join('')}</div></div></section>
    ${trackerSection('Routine',routineStats)}${trackerSection('Body',bodyStats)}${trackerSection('Skincare',skinStats)}
    <section class="section"><div class="section-head"><h2 class="section-title">Weekly review</h2></div><div class="card"><p class="card-title">7-day consistency: ${avg}%</p><p class="card-meta">Routine ${avgForSource('routine',7)}% · Body ${avgForSource('body',7)}% · Skincare ${avgForSource('skincare',7)}%</p><div class="divider"></div><p class="card-meta">Gunakan tracker untuk melihat kebiasaan yang sering terlewat, lalu edit template minggu berikutnya dari halaman terkait.</p></div></section>`;
}
function statsForSource(source, n=30) {
  const map=new Map();
  for(let i=0;i<n;i++){
    const d=new Date(); d.setDate(d.getDate()-i); const k=localDateKey(d);
    for(const item of generatedItems(k).filter(x=>x.source===source&&x.tracked)){
      const row=map.get(item.sourceId)||{name:item.title,scheduled:0,done:0,skipped:0}; row.scheduled++;
      const st=itemStatus(k,item.id); if(st==='done')row.done++; if(st==='skipped')row.skipped++; map.set(item.sourceId,row);
    }
  }
  return [...map.values()].map(r=>({...r, percent:(r.scheduled-r.skipped)?Math.round(r.done/(r.scheduled-r.skipped)*100):100})).sort((a,b)=>b.percent-a.percent);
}
function trackerSection(title, rows) { return `<section class="section"><div class="section-head"><h2 class="section-title">${title}</h2></div><div class="card">${rows.length?rows.map(r=>`<div class="tracker-row"><div><strong>${esc(r.name)}</strong><small>${r.done} done · ${r.skipped} skipped · ${r.scheduled} scheduled</small></div><strong>${r.percent}%</strong></div>`).join(''):'<div class="muted">Belum cukup data.</div>'}</div></section>`; }
function avgForSource(source,n) { let done=0,total=0; for(let i=0;i<n;i++){const d=new Date();d.setDate(d.getDate()-i);const k=localDateKey(d);for(const item of generatedItems(k).filter(x=>x.source===source&&x.tracked)){const st=itemStatus(k,item.id);if(st==='skipped')continue;total++;if(st==='done')done++;}} return total?Math.round(done/total*100):100; }
function overallStreak() { let streak=0; for(let i=0;i<365;i++){const d=new Date();d.setDate(d.getDate()-i);const c=completionForDate(localDateKey(d));if(c.total===0||c.percent>=80)streak++;else break;} return streak; }

function renderSettings() {
  return `<section class="section"><div class="card"><p class="card-title">Local-first storage</p><p class="card-meta">Data utama disimpan di IndexedDB pada perangkat ini. Backup tetap direkomendasikan karena storage browser dapat dihapus oleh sistem atau user.</p></div></section>
    <section class="section"><div class="section-head"><h2 class="section-title">Data</h2></div><div class="card form"><button id="exportData" class="primary-btn">Export backup (.json)</button><label class="ghost-btn" style="text-align:center;cursor:pointer">Import backup<input id="importData" type="file" accept="application/json" hidden></label><button id="resetData" class="danger-btn">Reset all local data</button></div></section>
    <section class="section"><div class="section-head"><h2 class="section-title">Install on iPhone</h2></div><div class="card"><p class="card-meta">Setelah deploy via GitHub Pages: buka URL di Safari → Share → Add to Home Screen. Aplikasi akan memakai manifest dan service worker untuk pengalaman PWA/offline.</p></div></section>`;
}

function bindRouteActions() {
  if (route==='today') bindToday();
  if (route==='routine') $('[data-add-routine]')?.addEventListener('click',()=>openRoutineModal());
  if (route==='body') $('[data-add-body]')?.addEventListener('click',()=>openBodyModal());
  if (route==='skincare') $('[data-add-skin]')?.addEventListener('click',()=>openSkinModal());
  if (route==='plan') bindPlan();
  if (route==='settings') bindSettings();
  $$('[data-edit-template]').forEach(b=>b.onclick=()=>{const [type,id]=b.dataset.editTemplate.split(':'); if(type==='routine')openRoutineModal(state.routines.find(x=>x.id===id)); if(type==='body')openBodyModal(state.body.find(x=>x.id===id)); if(type==='skincare')openSkinModal(state.skincare.find(x=>x.id===id));});
  $$('[data-archive-template]').forEach(b=>b.onclick=async()=>{const [type,id]=b.dataset.archiveTemplate.split(':'); const arr=type==='routine'?state.routines:type==='body'?state.body:state.skincare; const x=arr.find(v=>v.id===id); x.active=x.active===false?true:false; await persist();});
}

function bindToday() {
  const key=todayKey();
  $$('[data-action="toggle"]').forEach(b=>b.onclick=async()=>{const log=getLog(key); const rec=log.items[b.dataset.id] ||= {}; rec.status=rec.status==='done'?'pending':'done'; rec.completedAt=rec.status==='done'?new Date().toISOString():null; if(b.dataset.id.startsWith('plan:')&&rec.status==='done'){const p=state.plans.find(x=>x.id===b.dataset.id.split(':')[1]);if(p)p.doneAt=new Date().toISOString();} await persist();});
  $$('[data-action="skip"]').forEach(b=>b.onclick=()=>skipToday(b.dataset.id));
  $$('[data-action="undo"]').forEach(b=>b.onclick=async()=>{getLog(key).items[b.dataset.id]={status:'pending'};await persist();});
  $$('[data-action="time"]').forEach(b=>b.onclick=()=>changeTodayTime(b.dataset.id));
  $$('[data-action="detail"]').forEach(b=>b.onclick=()=>openTodayDetail(b.dataset.id));
  $$('[data-action="edit-source"]').forEach(b=>b.onclick=()=>openSourceFromToday(b.dataset.id));
  $('#dayType')?.addEventListener('change',async e=>{getOverride(key).dayType=e.target.value;await persist(false);toast('Day type disimpan untuk hari ini.');});
  $$('[data-mood]').forEach(b=>b.onclick=async()=>{getLog(key).mood=Number(b.dataset.mood);await persist();});
  $('#saveDailyNote')?.addEventListener('click',async()=>{getLog(key).note=$('#dailyNote').value.trim();await persist(false);toast('Daily note saved.');});
}
async function skipToday(id) { getLog(todayKey()).items[id]={...(getLog(todayKey()).items[id]||{}),status:'skipped'}; await persist(); toast('Skipped today. Template tidak berubah.'); }
function changeTodayTime(id) {
  const item=generatedItems().find(x=>x.id===id); if(!item)return;
  if (item.source === 'routine') { toast('Daily Routine tidak memakai jam.'); return; }
  const t=prompt('Waktu untuk hari ini (HH:MM). Kosongkan untuk Anytime:',item.time||''); if(t===null)return;
  const v=t.trim(); if(v && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)){toast('Format waktu harus HH:MM.');return;}
  getOverride(todayKey()).times[id]=v||null; persist().then(()=>toast('Waktu berubah hanya untuk hari ini.'));
}
function openTodayDetail(id) {
  const item=generatedItems().find(x=>x.id===id); if(!item)return; const rec=getLog(todayKey()).items[id]||{};
  const actualField=item.source==='body'?`<div class="field"><label>Actual ${esc(item.metricUnit||'result')}</label><input id="detailActual" class="input" value="${esc(rec.actual||'')}" placeholder="contoh 5.2"></div>`:'';
  modal(item.title,`<div class="form"><div class="field"><label>Status</label><select id="detailStatus" class="select"><option value="pending" ${rec.status==='pending'||!rec.status?'selected':''}>Pending</option><option value="done" ${rec.status==='done'?'selected':''}>Done</option><option value="skipped" ${rec.status==='skipped'?'selected':''}>Skipped / neutral</option></select></div>${actualField}<div class="field"><label>Notes</label><textarea id="detailNotes" class="textarea">${esc(rec.notes||'')}</textarea></div></div>`,`<button class="primary-btn" id="saveDetail">Save</button>`);
  $('#saveDetail').onclick=async()=>{const r=getLog(todayKey()).items[id] ||= {};r.status=$('#detailStatus').value;r.notes=$('#detailNotes').value.trim();if($('#detailActual'))r.actual=$('#detailActual').value.trim();r.completedAt=r.status==='done'?new Date().toISOString():null;if(item.source==='plan'&&r.status==='done'){const p=state.plans.find(x=>x.id===item.sourceId);if(p)p.doneAt=new Date().toISOString();}closeModal();await persist();};
}
function openSourceFromToday(id){const [type,sourceId]=id.split(':');if(type==='routine')openRoutineModal(state.routines.find(x=>x.id===sourceId));if(type==='body')openBodyModal(state.body.find(x=>x.id===sourceId));if(type==='skin')openSkinModal(state.skincare.find(x=>x.id===sourceId));}

function installTodayGestures() {
  $$('[data-drag-time]').forEach(handle=>{
    handle.onpointerdown=e=>{
      e.preventDefault(); const id=handle.dataset.dragTime; const card=handle.closest('.today-item'); const startY=e.clientY; const item=generatedItems().find(x=>x.id===id); if(!item?.time)return; const base=timeToMinutes(item.time); handle.setPointerCapture(e.pointerId); card.classList.add('dragging');
      const move=ev=>{const dy=ev.clientY-startY;card.style.transform=`translateY(${dy}px) scale(1.015)`;};
      const up=async ev=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);card.classList.remove('dragging');card.style.transform='';const slots=Math.round((ev.clientY-startY)/34);if(slots!==0){getOverride(todayKey()).times[id]=minutesToTime(base+slots*30);await persist();toast('Waktu diubah hanya untuk hari ini.');}};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up,{once:true});
    };
  });
  $$('.today-item').forEach(card=>{let sx=0,sy=0;card.addEventListener('touchstart',e=>{if(e.target.closest('.drag-handle,button'))return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});card.addEventListener('touchend',e=>{if(!sx)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(dx<-80&&Math.abs(dx)>Math.abs(dy)*1.5)skipToday(card.dataset.todayId);sx=sy=0;},{passive:true});});
}

function openRoutineModal(existing=null) {
  const r=existing||{id:uid(),name:'',category:'morning',days:allDays(),tracked:true,minimum:'',notes:'',active:true};
  modal(existing?'Edit routine':'Add routine',`<div class="form"><div class="field"><label>Name</label><input id="rName" class="input" value="${esc(r.name)}" placeholder="Contoh: Bangun Tidur"></div><div class="field"><label>Category</label><select id="rCat" class="select"><option value="morning" ${r.category==='morning'?'selected':''}>Morning</option><option value="day" ${r.category==='day'?'selected':''}>Day</option><option value="evening" ${r.category==='evening'?'selected':''}>Evening</option><option value="anytime" ${r.category==='anytime'?'selected':''}>Anytime</option></select></div>${daysEditor(r.days)}<div class="inline-fields"><div class="field"><label>Minimum version</label><input id="rMin" class="input" value="${esc(r.minimum||'')}" placeholder="contoh 5 menit"></div><div class="field"><label>Track consistency</label><select id="rTrack" class="select"><option value="yes" ${r.tracked!==false?'selected':''}>Yes</option><option value="no" ${r.tracked===false?'selected':''}>No</option></select></div></div><div class="field"><label>Notes</label><textarea id="rNotes" class="textarea">${esc(r.notes||'')}</textarea></div><p class="card-meta">Daily Routine tidak memakai jam. Cukup tentukan hari aktif.</p></div>`,`<button class="primary-btn" id="saveRoutine">Save</button>`);
  bindDayEditor(r.days); $('#saveRoutine').onclick=async()=>{r.name=$('#rName').value.trim();if(!r.name)return toast('Nama wajib diisi.');r.category=$('#rCat').value;r.days=selectedDays();r.minimum=$('#rMin').value.trim();r.tracked=$('#rTrack').value==='yes';r.notes=$('#rNotes').value.trim();r.time=null;r.timesByDay={};if(!existing)state.routines.push(r);closeModal();await persist();};
}
function openBodyModal(existing=null) {
  const b=existing||{id:uid(),type:'Gym',name:'Gym',days:[1,3,5],time:'17:00',targetValue:'',targetUnit:'',minimum:'',tracked:true,notes:'',active:true};
  modal(existing?'Edit body activity':'Add body activity',`<div class="form"><div class="inline-fields"><div class="field"><label>Activity</label><select id="bType" class="select">${BODY_TYPES.map(x=>`<option ${b.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Display name</label><input id="bName" class="input" value="${esc(b.name||b.type)}"></div></div>${daysEditor(b.days)}<div class="inline-fields"><div class="field"><label>Time</label><input id="bTime" type="time" class="input" value="${esc(b.time||'')}"></div><div class="field"><label>Unit</label><input id="bUnit" class="input" value="${esc(b.targetUnit||'')}" placeholder="km / min / session"></div></div><div class="inline-fields"><div class="field"><label>Default target</label><input id="bTarget" class="input" value="${esc(b.targetValue||'')}" placeholder="5"></div><div class="field"><label>Minimum version</label><input id="bMin" class="input" value="${esc(b.minimum||'')}" placeholder="1 km"></div></div><div class="field"><label>Track consistency</label><select id="bTrack" class="select"><option value="yes" ${b.tracked!==false?'selected':''}>Yes</option><option value="no" ${b.tracked===false?'selected':''}>No</option></select></div><div class="field"><label>Notes</label><textarea id="bNotes" class="textarea">${esc(b.notes||'')}</textarea></div></div>`,`<button class="primary-btn" id="saveBody">Save</button>`);
  bindDayEditor(b.days);$('#bType').onchange=e=>{if(!existing||$('#bName').value===b.name)$('#bName').value=e.target.value;};$('#saveBody').onclick=async()=>{b.type=$('#bType').value;b.name=$('#bName').value.trim()||b.type;b.days=selectedDays();b.time=$('#bTime').value||null;b.targetValue=$('#bTarget').value.trim();b.targetUnit=$('#bUnit').value.trim();b.minimum=$('#bMin').value.trim();b.tracked=$('#bTrack').value==='yes';b.notes=$('#bNotes').value.trim();if(!existing)state.body.push(b);closeModal();await persist();};
}

function openSkinModal(existing=null) {
  const s=existing||{id:uid(),name:'Cleanser',periods:['am','pm'],days:allDays(),time:{am:'07:30',pm:'21:00'},tracked:true,notes:'',active:true};
  modal(existing?'Edit skincare':'Add skincare',`<div class="form"><div class="field"><label>Product / step</label><input id="sName" class="input" list="skinPresets" value="${esc(s.name)}"><datalist id="skinPresets">${SKIN_PRESETS.map(x=>`<option value="${x}">`).join('')}</datalist></div><div class="field"><label>When</label><div class="chips"><button class="chip ${s.periods.includes('am')?'active':''}" data-period="am">Morning</button><button class="chip ${s.periods.includes('pm')?'active':''}" data-period="pm">Night</button></div></div>${daysEditor(s.days)}<div class="inline-fields"><div class="field"><label>Morning time</label><input id="sAm" type="time" class="input" value="${esc(s.time?.am||'07:30')}"></div><div class="field"><label>Night time</label><input id="sPm" type="time" class="input" value="${esc(s.time?.pm||'21:00')}"></div></div><div class="field"><label>Notes</label><textarea id="sNotes" class="textarea">${esc(s.notes||'')}</textarea></div></div>`,`<button class="primary-btn" id="saveSkin">Save</button>`);
  bindDayEditor(s.days);$$('[data-period]').forEach(b=>b.onclick=()=>b.classList.toggle('active'));$('#saveSkin').onclick=async()=>{s.name=$('#sName').value.trim();if(!s.name)return toast('Nama produk wajib diisi.');s.periods=$$('[data-period].active').map(x=>x.dataset.period);if(!s.periods.length)return toast('Pilih Morning dan/atau Night.');s.days=selectedDays();s.time={am:$('#sAm').value||'07:30',pm:$('#sPm').value||'21:00'};s.notes=$('#sNotes').value.trim();if(!existing)state.skincare.push(s);closeModal();await persist();};
}

function daysEditor(selected=allDays()) { return `<div class="field"><label>Active days</label><div class="days">${allDays().map(d=>`<button type="button" class="day-chip ${selected.includes(d)?'active':''}" data-day-chip="${d}">${DAYS[d]}</button>`).join('')}</div></div>`; }
function bindDayEditor(){ $$('[data-day-chip]').forEach(b=>b.onclick=()=>b.classList.toggle('active')); }
function selectedDays(){ return $$('[data-day-chip].active').map(b=>Number(b.dataset.dayChip)); }

function openPlanModal(existing=null, presetStage='idea') {
  const p=existing||{id:uid(),title:'',notes:'',stage:presetStage,dueDate:'',time:null,createdAt:new Date().toISOString(),doneAt:null};
  modal(existing?'Edit plan':'Add plan',`<div class="form"><div class="field"><label>Title</label><input id="pTitle" class="input" value="${esc(p.title)}" placeholder="Apa yang ingin dilakukan?"></div><div class="field"><label>Stage</label><select id="pStage" class="select"><option value="idea" ${p.stage==='idea'?'selected':''}>Idea</option><option value="planned" ${p.stage==='planned'?'selected':''}>Akan Dilakukan</option><option value="must" ${p.stage==='must'?'selected':''}>Harus Dilakukan</option></select></div><div class="inline-fields"><div class="field"><label>Date (optional)</label><input id="pDue" type="date" class="input" value="${esc(p.dueDate||'')}"></div><div class="field"><label>Time (optional)</label><input id="pTime" type="time" class="input" value="${esc(p.time||'')}"></div></div><div class="field"><label>Keterangan</label><textarea id="pNotes" class="textarea" placeholder="Detail, konteks, link, reminder…">${esc(p.notes||'')}</textarea></div></div>`,`<button class="primary-btn" id="savePlan">Save</button>`);
  $('#savePlan').onclick=async()=>{p.title=$('#pTitle').value.trim();if(!p.title)return toast('Title wajib diisi.');p.stage=$('#pStage').value;p.dueDate=$('#pDue').value||null;p.time=$('#pTime').value||null;p.notes=$('#pNotes').value.trim();if(p.stage==='must'&&!p.dueDate)p.dueDate=todayKey();if(!existing)state.plans.push(p);closeModal();await persist();};
}
function bindPlan(){ $('[data-add-plan]')?.addEventListener('click',()=>openPlanModal());$$('[data-edit-plan]').forEach(b=>b.onclick=()=>openPlanModal(state.plans.find(p=>p.id===b.dataset.editPlan)));$$('[data-plan-done]').forEach(b=>b.onclick=async()=>{const p=state.plans.find(x=>x.id===b.dataset.planDone);p.doneAt=new Date().toISOString();await persist();});$$('[data-plan-restore]').forEach(b=>b.onclick=async()=>{const p=state.plans.find(x=>x.id===b.dataset.planRestore);p.doneAt=null;await persist();});}
function installPlanDrag() {
  $$('[data-plan-drag]').forEach(handle=>{handle.onpointerdown=e=>{e.preventDefault();const id=handle.dataset.planDrag,card=handle.closest('.plan-card');handle.setPointerCapture(e.pointerId);card.classList.add('dragging');const move=ev=>{$$('.plan-lane').forEach(l=>l.classList.remove('drag-over'));const el=document.elementFromPoint(ev.clientX,ev.clientY)?.closest?.('.plan-lane');if(el)el.classList.add('drag-over');};const up=async ev=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);card.classList.remove('dragging');const lane=document.elementFromPoint(ev.clientX,ev.clientY)?.closest?.('.plan-lane');$$('.plan-lane').forEach(l=>l.classList.remove('drag-over'));if(lane){const p=state.plans.find(x=>x.id===id),stage=lane.dataset.planLane;p.stage=stage;if(stage==='must'&&!p.dueDate)p.dueDate=todayKey();if(stage==='idea')p.dueDate=null;await persist();toast(`Moved to ${stage}.`);}};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up,{once:true});};});
}

function bindSettings(){
  $('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`daily-os-backup-${todayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  $('#importData').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const raw=JSON.parse(await file.text());state=mergeState(raw);await persist();toast('Backup imported.');}catch{toast('File backup tidak valid.');}};
  $('#resetData').onclick=async()=>{if(!confirm('Hapus seluruh data lokal Daily OS?'))return;await clearState();state=defaultState();renderApp();openOnboarding();};
}

function openQuickAdd() {
  modal('Quick add for today',`<div class="form"><div class="field"><label>Title</label><input id="qTitle" class="input" placeholder="Contoh: Dentist"></div><div class="inline-fields"><div class="field"><label>Time</label><input id="qTime" type="time" class="input"></div><div class="field"><label>Category</label><select id="qCat" class="select"><option value="quick">Other</option><option value="body">Body</option><option value="morning">Morning</option><option value="evening">Evening</option></select></div></div><div class="field"><label>Notes</label><textarea id="qNotes" class="textarea"></textarea></div></div>`,`<button class="primary-btn" id="saveQuick">Add today</button>`);
  $('#saveQuick').onclick=async()=>{const title=$('#qTitle').value.trim();if(!title)return toast('Title wajib diisi.');getOverride(todayKey()).quickItems.push({id:uid(),title,time:$('#qTime').value||null,category:$('#qCat').value,notes:$('#qNotes').value.trim(),tracked:true});closeModal();await persist();};
}

function openOnboarding() {
  renderOnboardingStep1();
}
function renderOnboardingStep1(){
  modal('Build your routine',`<div class="onboard"><p>Pilih aktivitas yang ingin masuk Daily Routine. Tidak perlu atur jam; nanti cukup checklist sesuai hari aktif.</p><div class="preset-grid">${ROUTINE_PRESETS.map(([name,emoji,cat])=>`<div class="preset ${onboardingDraft.has(name)?'active':''}" data-onboard-preset="${esc(name)}"><span class="emoji">${emoji}</span><strong>${esc(name)}</strong><small>${cat}</small></div>`).join('')}</div></div>`,`<button class="ghost-btn" id="skipOnboard">Skip</button><button class="primary-btn" id="finishOnboard">Finish</button>`);
  $$('[data-onboard-preset]').forEach(c=>c.onclick=()=>{const n=c.dataset.onboardPreset;onboardingDraft.has(n)?onboardingDraft.delete(n):onboardingDraft.add(n);c.classList.toggle('active');});
  $('#skipOnboard').onclick=async()=>{state.onboarded=true;closeModal();await persist();};
  $('#finishOnboard').onclick=async()=>{
    state.routines=ROUTINE_PRESETS.filter(([n])=>onboardingDraft.has(n)).map(([name,,category])=>({id:uid(),name,category,time:null,days:allDays(),timesByDay:{},tracked:true,minimum:'',notes:'',active:true}));
    state.onboarded=true;closeModal();await persist();toast('Routine siap. Tanpa jam, tinggal checklist.');
  };
}

function dayTypeLabel(v){return ({work:'Work day',weekend:'Weekend',holiday:'Holiday',travel:'Travel',sick:'Sick day'})[v]||v;}

async function init() {
  state=mergeState(await loadState());
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>{route=b.dataset.route;renderApp();window.scrollTo({top:0,behavior:'smooth'});}));
  $('#quickAddBtn').addEventListener('click',openQuickAdd);
  renderApp();
  if(!state.onboarded)openOnboarding();
  if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('./sw.js');}catch(e){console.warn('SW registration failed',e);}}
}

init();
