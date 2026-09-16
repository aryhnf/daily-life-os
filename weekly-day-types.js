(() => {
  const STORAGE_KEY = 'daily-os-weekly-day-types';
  const STYLE_ID = 'daily-os-weekly-day-types-style';
  const DAYS = [
    { dow: 1, name: 'Senin', short: 'Sen' },
    { dow: 2, name: 'Selasa', short: 'Sel' },
    { dow: 3, name: 'Rabu', short: 'Rab' },
    { dow: 4, name: 'Kamis', short: 'Kam' },
    { dow: 5, name: 'Jumat', short: 'Jum' },
    { dow: 6, name: 'Sabtu', short: 'Sab' },
    { dow: 0, name: 'Minggu', short: 'Min' }
  ];
  const TYPES = [
    ['work', 'Work'],
    ['weekend', 'Weekend'],
    ['holiday', 'Holiday'],
    ['travel', 'Travel'],
    ['sick', 'Sick']
  ];
  let queued = false;

  function defaults() {
    return { 0:'weekend', 1:'work', 2:'work', 3:'work', 4:'work', 5:'work', 6:'weekend' };
  }

  function readTypes() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...defaults(), ...(raw && typeof raw === 'object' ? raw : {}) };
    } catch {
      return defaults();
    }
  }

  function writeTypes(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {}
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .weekly-day-card{overflow:hidden}
      .weekly-day-base{display:none!important}
      .weekly-day-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:13px}
      .weekly-day-title{font-size:12px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;margin:0;color:var(--text)}
      .weekly-day-sub{font-size:11px;color:var(--muted);margin:4px 0 0;line-height:1.4}
      .weekly-day-current{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:rgba(185,230,59,.18);color:#5f780f;font-size:10px;font-weight:800;white-space:nowrap}
      .weekly-day-current:before{content:"";width:6px;height:6px;border-radius:50%;background:#86a91b}
      .weekly-day-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}
      .weekly-day-item{min-width:0;padding:9px 7px 8px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.62);transition:border-color .16s ease,background .16s ease,transform .14s ease}
      .weekly-day-item.is-today{border-color:rgba(134,169,27,.48);background:rgba(185,230,59,.13);box-shadow:0 7px 18px rgba(96,122,22,.08)}
      .weekly-day-name{display:block;text-align:center;font-size:10px;font-weight:850;color:var(--text);margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .weekly-day-select{width:100%;min-width:0;height:31px;border:0;border-radius:9px;background:var(--surface-2);color:#43503f;font:inherit;font-size:9px;font-weight:750;text-align:center;padding:0 3px;outline:none;cursor:pointer}
      .weekly-day-select:focus{box-shadow:0 0 0 2px rgba(185,230,59,.25)}
      @media(max-width:720px){
        .weekly-day-grid{display:flex;overflow-x:auto;gap:8px;padding-bottom:3px;scrollbar-width:none;scroll-snap-type:x proximity}
        .weekly-day-grid::-webkit-scrollbar{display:none}
        .weekly-day-item{flex:0 0 92px;scroll-snap-align:start;padding:10px 8px}
        .weekly-day-name{font-size:11px}
        .weekly-day-select{font-size:10px;height:34px}
      }
      @media(prefers-reduced-motion:reduce){.weekly-day-item{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    const root = document.querySelector('#toastRoot');
    if (!root) return;
    root.innerHTML = `<div class="toast">${message}</div>`;
    setTimeout(() => { if (root.textContent.includes(message)) root.innerHTML = ''; }, 1800);
  }

  function typeLabel(value) {
    return TYPES.find(([key]) => key === value)?.[1] || value;
  }

  function syncTodayToBase(card, types) {
    const baseSelect = card.querySelector('#dayType');
    if (!baseSelect) return;
    const todayType = types[new Date().getDay()] || 'work';
    if (baseSelect.value !== todayType) {
      baseSelect.value = todayType;
      baseSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function render(card) {
    const types = readTypes();
    const todayDow = new Date().getDay();
    const content = card.querySelector('.weekly-day-ui');
    if (!content) return;

    content.innerHTML = `
      <div class="weekly-day-head">
        <div>
          <p class="weekly-day-title">Day</p>
          <p class="weekly-day-sub">Senin–Minggu · satu type untuk setiap hari</p>
        </div>
        <span class="weekly-day-current">Hari ini: ${DAYS.find(d => d.dow === todayDow)?.name || ''}</span>
      </div>
      <div class="weekly-day-grid">
        ${DAYS.map(day => `
          <label class="weekly-day-item ${day.dow === todayDow ? 'is-today' : ''}" title="${day.name}">
            <span class="weekly-day-name">${day.name}</span>
            <select class="weekly-day-select" data-weekday-type="${day.dow}" aria-label="Type ${day.name}">
              ${TYPES.map(([value,label]) => `<option value="${value}" ${types[day.dow] === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>`).join('')}
      </div>`;

    content.querySelectorAll('[data-weekday-type]').forEach(select => {
      select.addEventListener('change', event => {
        const current = readTypes();
        const dow = Number(event.target.dataset.weekdayType);
        current[dow] = event.target.value;
        writeTypes(current);
        if (dow === new Date().getDay()) syncTodayToBase(card, current);
        showToast(`${DAYS.find(d => d.dow === dow)?.name}: ${typeLabel(event.target.value)}`);
      });
    });

    syncTodayToBase(card, types);
  }

  function enhance() {
    queued = false;
    injectStyles();
    if (document.querySelector('#pageTitle')?.textContent.trim().toLowerCase() !== 'today') return;
    const baseSelect = document.querySelector('#dayType');
    const card = baseSelect?.closest('.card');
    if (!card) return;

    card.classList.add('weekly-day-card');
    const base = baseSelect.closest('.flex') || baseSelect.parentElement;
    if (base) base.classList.add('weekly-day-base');

    let ui = card.querySelector('.weekly-day-ui');
    if (!ui) {
      ui = document.createElement('div');
      ui.className = 'weekly-day-ui';
      card.appendChild(ui);
    }
    render(card);
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(enhance);
  }

  const observer = new MutationObserver(queue);
  function start() {
    injectStyles();
    const main = document.querySelector('#main');
    if (main) observer.observe(main, { childList:true, subtree:true });
    queue();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
