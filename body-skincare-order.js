(() => {
  const BODY_KEY = 'daily-os-body-template-order';
  const SKIN_KEYS = { am: 'daily-os-skincare-order-am', pm: 'daily-os-skincare-order-pm' };
  const STYLE_ID = 'daily-os-body-skincare-order-style';
  let queued = false;
  let dragging = false;

  function readOrder(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  function writeOrder(key, ids) {
    try { localStorage.setItem(key, JSON.stringify(ids)); } catch {}
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bs-order-handle{width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;border:0;border-radius:11px;background:var(--surface-2);color:#7b8876;font-size:18px;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent}
      .bs-order-handle:active{cursor:grabbing;color:#5f780f;background:rgba(185,230,59,.18);transform:scale(.96)}
      .bs-order-placeholder{border:1px dashed rgba(111,142,20,.38);border-radius:var(--radius,18px);background:rgba(185,230,59,.10);margin-top:9px}
      .bs-order-dragging{z-index:1250!important;opacity:.95!important;box-shadow:0 22px 56px rgba(55,72,48,.20)!important;border-color:rgba(111,142,20,.42)!important;pointer-events:none!important}
      body.bs-order-active .bottom-nav{pointer-events:none}
      .skin-original-card{display:none!important}
      .skin-groups{display:grid;gap:18px;margin-top:4px}
      .skin-group{min-width:0}
      .skin-group-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:0 2px 9px}
      .skin-group-title{font-size:13px;font-weight:850;letter-spacing:.04em;margin:0}
      .skin-group-sub{font-size:11px;color:var(--muted);margin:3px 0 0}
      .skin-order-list>.card+.card{margin-top:9px}
      .skin-modal-note{padding:10px 12px;border-radius:12px;background:rgba(185,230,59,.12);color:#53663c;font-size:12px;line-height:1.45}
      @media(min-width:700px){.skin-groups{grid-template-columns:1fr 1fr;align-items:start}}
      @media(prefers-reduced-motion:reduce){.bs-order-handle{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function pageTitle() { return document.querySelector('#pageTitle')?.textContent.trim().toLowerCase() || ''; }
  function sectionTitle(section) { return section?.querySelector('.section-title')?.textContent.trim().toLowerCase() || ''; }
  function findSection(title) { return [...document.querySelectorAll('#main > .section')].find(s => sectionTitle(s) === title) || null; }

  function idFromTemplateCard(card, type) {
    const btn = card.querySelector(`[data-edit-template^="${type}:"]`);
    const raw = btn?.dataset.editTemplate || '';
    return raw.startsWith(`${type}:`) ? raw.slice(type.length + 1) : null;
  }

  function sorted(cards, idFn, order) {
    if (!order.length) return cards;
    const rank = new Map(order.map((id, i) => [id, i]));
    const fallback = new Map(cards.map((c, i) => [c, i]));
    return [...cards].sort((a, b) => {
      const ai = idFn(a), bi = idFn(b);
      return (rank.has(ai) ? rank.get(ai) : 10000 + fallback.get(a)) - (rank.has(bi) ? rank.get(bi) : 10000 + fallback.get(b));
    });
  }

  function animateLayout(cards, before) {
    cards.forEach(card => {
      const oldTop = before.get(card);
      if (oldTop == null) return;
      const dy = oldTop - card.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      card.style.transition = 'none';
      card.style.transform = `translateY(${dy}px)`;
      card.getBoundingClientRect();
      requestAnimationFrame(() => {
        card.style.transition = 'transform 170ms cubic-bezier(.2,.82,.2,1)';
        card.style.transform = '';
      });
    });
  }

  function showToast(message) {
    const root = document.querySelector('#toastRoot');
    if (!root) return;
    root.innerHTML = `<div class="toast">${message}</div>`;
    setTimeout(() => { if (root.textContent.includes(message)) root.innerHTML = ''; }, 2000);
  }

  function beginDrag(event, options) {
    if (dragging || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const { card, container, cardsFn, idFn, storageKey, successMessage } = options;
    if (!card || !container || cardsFn().length < 2) return;

    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    document.body.classList.add('bs-order-active');

    const rect = card.getBoundingClientRect();
    const grabOffset = event.clientY - rect.top;
    const placeholder = document.createElement('div');
    placeholder.className = 'bs-order-placeholder';
    placeholder.style.height = `${rect.height}px`;
    container.insertBefore(placeholder, card);
    document.body.appendChild(card);

    card.classList.add('bs-order-dragging');
    Object.assign(card.style, { position:'fixed', left:`${rect.left}px`, top:`${rect.top}px`, width:`${rect.width}px`, margin:'0', transition:'none' });

    const move = ev => {
      ev.preventDefault();
      card.style.top = `${ev.clientY - grabOffset}px`;
      if (ev.clientY < 82) window.scrollBy(0, -9);
      else if (ev.clientY > window.innerHeight - 92) window.scrollBy(0, 9);

      const cards = cardsFn();
      const before = new Map(cards.map(c => [c, c.getBoundingClientRect().top]));
      let target = null;
      for (const candidate of cards) {
        const r = candidate.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { target = candidate; break; }
      }
      if (target) container.insertBefore(placeholder, target);
      else {
        const last = cards[cards.length - 1];
        if (last) last.after(placeholder);
      }
      animateLayout(cards, before);
    };

    const finish = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
      const visualTop = parseFloat(card.style.top) || rect.top;
      placeholder.replaceWith(card);
      card.classList.remove('bs-order-dragging');
      document.body.classList.remove('bs-order-active');
      Object.assign(card.style, { position:'', left:'', top:'', width:'', margin:'', transition:'' });
      const finalTop = card.getBoundingClientRect().top;
      card.style.transition = 'none';
      card.style.transform = `translateY(${visualTop - finalTop}px)`;
      card.getBoundingClientRect();
      requestAnimationFrame(() => { card.style.transition = 'transform 190ms cubic-bezier(.2,.85,.2,1)'; card.style.transform = ''; });
      writeOrder(storageKey, cardsFn().map(idFn).filter(Boolean));
      dragging = false;
      showToast(successMessage);
    };

    document.addEventListener('pointermove', move, { passive:false });
    document.addEventListener('pointerup', finish, { once:true });
    document.addEventListener('pointercancel', finish, { once:true });
  }

  function enhanceBodyPage() {
    const section = findSection('daily workout');
    if (!section) return;
    const cards = [...section.children].filter(el => el.matches?.('.card') && idFromTemplateCard(el, 'body'));
    const ordered = sorted(cards, c => idFromTemplateCard(c, 'body'), readOrder(BODY_KEY));
    if (ordered.some((c, i) => c !== cards[i])) ordered.forEach(c => section.appendChild(c));
    const sub = section.querySelector('.section-sub');
    if (sub) sub.textContent = 'Atur hari, target, dan waktu bila perlu. Tahan ⋮⋮ untuk urutan permanen.';

    ordered.forEach(card => {
      if (card.querySelector('.bs-order-handle')) return;
      const row = card.querySelector('.card-row');
      if (!row) return;
      const handle = document.createElement('button');
      handle.type = 'button'; handle.className = 'bs-order-handle'; handle.textContent = '⋮⋮';
      handle.setAttribute('aria-label', 'Ubah urutan Body permanen');
      handle.addEventListener('pointerdown', event => beginDrag(event, {
        card,
        container: section,
        cardsFn: () => [...section.children].filter(el => el.matches?.('.card') && idFromTemplateCard(el, 'body')),
        idFn: c => idFromTemplateCard(c, 'body'),
        storageKey: BODY_KEY,
        successMessage: 'Urutan Body disimpan permanen.'
      }));
      row.appendChild(handle);
    });
  }

  function skinPeriodsFromCard(card) {
    const text = card.querySelector('.card-meta')?.textContent.toLowerCase() || '';
    const periods = [];
    if (text.includes('morning')) periods.push('am');
    if (text.includes('night')) periods.push('pm');
    return periods.length ? periods : ['am'];
  }

  function skinClone(original, id, period) {
    const clone = original.cloneNode(true);
    clone.classList.remove('skin-original-card');
    clone.classList.add('skin-order-card');
    clone.dataset.skinTemplateId = id;
    clone.dataset.skinPeriod = period;
    clone.style.display = '';

    const row = clone.querySelector('.card-row');
    if (row) {
      const handle = document.createElement('button');
      handle.type = 'button'; handle.className = 'bs-order-handle'; handle.textContent = '⋮⋮';
      handle.setAttribute('aria-label', `Ubah urutan ${period === 'am' ? 'Morning' : 'Night'} Skincare`);
      row.appendChild(handle);
    }

    const edit = clone.querySelector('[data-edit-template]');
    if (edit) edit.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      original.querySelector('[data-edit-template]')?.click();
    });
    const archive = clone.querySelector('[data-archive-template]');
    if (archive) archive.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      original.querySelector('[data-archive-template]')?.click();
    });
    return clone;
  }

  function enhanceSkincarePage() {
    const section = findSection('skincare schedule');
    if (!section || section.querySelector('.skin-groups')) return;
    const originals = [...section.children].filter(el => el.matches?.('.card') && idFromTemplateCard(el, 'skincare'));
    if (!originals.length) return;
    originals.forEach(card => card.classList.add('skin-original-card'));

    const groups = document.createElement('div');
    groups.className = 'skin-groups';
    const makeGroup = (period, title, subtitle) => {
      const group = document.createElement('div');
      group.className = 'skin-group';
      group.dataset.skinGroup = period;
      group.innerHTML = `<div class="skin-group-head"><div><h3 class="skin-group-title">${title}</h3><p class="skin-group-sub">${subtitle}</p></div></div><div class="skin-order-list" data-skin-list="${period}"></div>`;
      return group;
    };
    const amGroup = makeGroup('am', 'Morning', 'Urutan pemakaian pagi.');
    const pmGroup = makeGroup('pm', 'Night', 'Urutan pemakaian malam.');
    groups.append(amGroup, pmGroup);

    const byId = new Map(originals.map(card => [idFromTemplateCard(card, 'skincare'), card]));
    for (const period of ['am','pm']) {
      const list = (period === 'am' ? amGroup : pmGroup).querySelector('.skin-order-list');
      const candidates = originals.filter(card => skinPeriodsFromCard(card).includes(period));
      const ordered = sorted(candidates, c => idFromTemplateCard(c, 'skincare'), readOrder(SKIN_KEYS[period]));
      ordered.forEach(original => {
        const id = idFromTemplateCard(original, 'skincare');
        const clone = skinClone(original, id, period);
        list.appendChild(clone);
        clone.querySelector('.bs-order-handle')?.addEventListener('pointerdown', event => beginDrag(event, {
          card: clone,
          container: list,
          cardsFn: () => [...list.children].filter(el => el.matches?.('.skin-order-card')),
          idFn: c => c.dataset.skinTemplateId,
          storageKey: SKIN_KEYS[period],
          successMessage: `Urutan ${period === 'am' ? 'Morning' : 'Night'} Skincare disimpan.`
        }));
      });
      if (!ordered.length) list.innerHTML = '<div class="list-empty">Belum ada produk.</div>';
    }

    const head = section.querySelector('.section-head');
    if (head) head.after(groups); else section.prepend(groups);
    const sub = section.querySelector('.section-sub');
    if (sub) sub.textContent = 'Skincare memakai Morning/Night dan urutan permanen, tanpa jam spesifik.';
  }

  function hideSkincareTimesInModal() {
    const modal = document.querySelector('#modalRoot .modal');
    const title = modal?.querySelector('.modal-head h2')?.textContent.toLowerCase() || '';
    if (!modal || !title.includes('skincare')) return;
    modal.querySelectorAll('.field').forEach(field => {
      const label = field.querySelector('label')?.textContent.trim().toLowerCase() || '';
      if (label === 'morning time' || label === 'night time') field.style.display = 'none';
    });
    if (!modal.querySelector('.skin-modal-note')) {
      const form = modal.querySelector('.form');
      if (form) {
        const note = document.createElement('p');
        note.className = 'skin-modal-note';
        note.textContent = 'Tidak perlu jam spesifik. Pilih Morning/Night dan hari aktif; urutan diatur dari halaman Skincare.';
        form.appendChild(note);
      }
    }
  }

  function applyTodayOrders() {
    const bodySection = document.querySelector('[data-layout-section="body"]');
    if (bodySection) {
      const cards = [...bodySection.querySelectorAll(':scope > .today-item[data-today-id^="body:"]')];
      const ordered = sorted(cards, c => c.dataset.todayId.replace(/^body:/,''), readOrder(BODY_KEY));
      if (ordered.some((c,i) => c !== cards[i])) ordered.forEach(c => bodySection.appendChild(c));
    }
    for (const period of ['am','pm']) {
      const section = document.querySelector(`[data-layout-section="skin-${period}"]`);
      if (!section) continue;
      const cards = [...section.querySelectorAll(`:scope > .today-item[data-today-id^="skin:"][data-today-id$=":${period}"]`)];
      const idFn = card => {
        const raw = card.dataset.todayId || '';
        return raw.replace(/^skin:/,'').replace(new RegExp(`:${period}$`),'');
      };
      const ordered = sorted(cards, idFn, readOrder(SKIN_KEYS[period]));
      if (ordered.some((c,i) => c !== cards[i])) ordered.forEach(c => section.appendChild(c));
    }
  }

  function enhance() {
    queued = false;
    if (dragging) return;
    injectStyles();
    hideSkincareTimesInModal();
    const page = pageTitle();
    if (page === 'body') enhanceBodyPage();
    else if (page === 'skincare') enhanceSkincarePage();
    else if (page === 'today') applyTodayOrders();
  }

  function queue() {
    if (queued || dragging) return;
    queued = true;
    requestAnimationFrame(enhance);
  }

  const observer = new MutationObserver(queue);
  function start() {
    injectStyles();
    const main = document.querySelector('#main');
    const modal = document.querySelector('#modalRoot');
    if (main) observer.observe(main, { childList:true, subtree:true });
    if (modal) observer.observe(modal, { childList:true, subtree:true });
    queue();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
