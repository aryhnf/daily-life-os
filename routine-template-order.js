(() => {
  const KEY = 'daily-os-routine-template-order';
  const STYLE_ID = 'daily-os-routine-template-order-style';
  let dragging = false;
  let queued = false;

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dailyOverrideKey() {
    return `daily-os-routine-order:${localDateKey()}`;
  }

  function readOrder() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeOrder(ids) {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
  }

  function hasTodayOverride() {
    try {
      const parsed = JSON.parse(localStorage.getItem(dailyOverrideKey()) || '[]');
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .template-order-handle {
        width: 36px;
        height: 36px;
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 11px;
        background: var(--surface-2);
        color: #738091;
        font-size: 18px;
        line-height: 1;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        transition: color .16s ease, background .16s ease, transform .14s ease;
      }
      .template-order-handle:active {
        cursor: grabbing;
        color: var(--accent);
        background: rgba(216,255,99,.10);
        transform: scale(.96);
      }
      .template-order-placeholder {
        border: 1px dashed rgba(216,255,99,.42);
        border-radius: var(--radius,18px);
        background: rgba(216,255,99,.045);
        margin-top: 9px;
      }
      .template-order-dragging {
        z-index: 1200 !important;
        opacity: .95 !important;
        border-color: rgba(216,255,99,.55) !important;
        box-shadow: 0 24px 60px rgba(0,0,0,.46) !important;
        pointer-events: none !important;
      }
      body.template-order-active .bottom-nav { pointer-events: none; }
      .template-order-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 5px;
        color: var(--muted);
        font-size: 11px;
      }
      @media (hover:hover) and (pointer:fine) {
        .template-order-handle:hover { color: var(--accent); background: rgba(216,255,99,.08); }
      }
      @media (prefers-reduced-motion: reduce) {
        .template-order-handle { transition: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function titleOf(section) {
    return section?.querySelector('.section-title')?.textContent.trim().toLowerCase() || '';
  }

  function getTemplateSection() {
    return [...document.querySelectorAll('#main > .section')].find(section => titleOf(section) === 'routine templates') || null;
  }

  function templateId(card) {
    const btn = card.querySelector('[data-edit-template^="routine:"]');
    const raw = btn?.dataset.editTemplate || '';
    return raw.startsWith('routine:') ? raw.slice('routine:'.length) : null;
  }

  function templateCards(section) {
    if (!section) return [];
    return [...section.children].filter(el => el.matches?.('.card') && templateId(el));
  }

  function todayRoutineCards() {
    const section = [...document.querySelectorAll('#main > .section')].find(section => titleOf(section) === 'daily routine');
    if (!section) return { section: null, cards: [] };
    return {
      section,
      cards: [...section.children].filter(el => el.matches?.('.today-item[data-today-id^="routine:"]'))
    };
  }

  function showToast(message) {
    const root = document.querySelector('#toastRoot');
    if (!root) return;
    root.innerHTML = `<div class="toast">${message}</div>`;
    setTimeout(() => {
      if (root.textContent.includes(message)) root.innerHTML = '';
    }, 2100);
  }

  function sortByOrder(cards, idForCard, order) {
    if (!order.length || cards.length < 2) return cards;
    const rank = new Map(order.map((id, index) => [id, index]));
    const original = new Map(cards.map((card, index) => [card, index]));
    return [...cards].sort((a, b) => {
      const ai = idForCard(a), bi = idForCard(b);
      const ar = rank.has(ai) ? rank.get(ai) : 10000 + original.get(a);
      const br = rank.has(bi) ? rank.get(bi) : 10000 + original.get(b);
      return ar - br;
    });
  }

  function applyTemplateOrder() {
    const section = getTemplateSection();
    if (!section) return;
    const cards = templateCards(section);
    const sorted = sortByOrder(cards, templateId, readOrder());
    if (sorted.some((card, i) => card !== cards[i])) sorted.forEach(card => section.appendChild(card));
  }

  function applyOrderToToday() {
    if (hasTodayOverride()) return;
    const order = readOrder();
    if (!order.length) return;
    const { section, cards } = todayRoutineCards();
    if (!section || cards.length < 2) return;
    const idForCard = card => (card.dataset.todayId || '').replace(/^routine:/, '');
    const sorted = sortByOrder(cards, idForCard, order);
    if (sorted.some((card, i) => card !== cards[i])) sorted.forEach(card => section.appendChild(card));
  }

  function animateLayout(cards, before) {
    cards.forEach(card => {
      const oldTop = before.get(card);
      if (oldTop == null) return;
      const newTop = card.getBoundingClientRect().top;
      const dy = oldTop - newTop;
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

  function movePlaceholder(section, placeholder, clientY) {
    const cards = templateCards(section);
    const before = new Map(cards.map(card => [card, card.getBoundingClientRect().top]));
    let target = null;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        target = card;
        break;
      }
    }
    if (target) section.insertBefore(placeholder, target);
    else {
      const last = cards[cards.length - 1];
      if (last) last.after(placeholder);
    }
    animateLayout(cards, before);
  }

  function beginDrag(event, handle) {
    if (dragging) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const card = handle.closest('.card');
    const section = getTemplateSection();
    if (!card || !section || !templateId(card) || templateCards(section).length < 2) return;

    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    document.body.classList.add('template-order-active');

    const rect = card.getBoundingClientRect();
    const grabOffset = event.clientY - rect.top;
    const placeholder = document.createElement('div');
    placeholder.className = 'template-order-placeholder';
    placeholder.style.height = `${rect.height}px`;
    section.insertBefore(placeholder, card);
    document.body.appendChild(card);

    card.classList.add('template-order-dragging');
    Object.assign(card.style, {
      position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, margin: '0', transition: 'none'
    });

    const move = ev => {
      ev.preventDefault();
      card.style.top = `${ev.clientY - grabOffset}px`;
      if (ev.clientY < 82) window.scrollBy(0, -9);
      else if (ev.clientY > window.innerHeight - 92) window.scrollBy(0, 9);
      movePlaceholder(section, placeholder, ev.clientY);
    };

    const finish = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);

      const visualTop = parseFloat(card.style.top) || rect.top;
      placeholder.replaceWith(card);
      card.classList.remove('template-order-dragging');
      document.body.classList.remove('template-order-active');
      Object.assign(card.style, { position:'', left:'', top:'', width:'', margin:'', transition:'' });

      const finalTop = card.getBoundingClientRect().top;
      card.style.transition = 'none';
      card.style.transform = `translateY(${visualTop - finalTop}px)`;
      card.getBoundingClientRect();
      requestAnimationFrame(() => {
        card.style.transition = 'transform 190ms cubic-bezier(.2,.85,.2,1)';
        card.style.transform = '';
      });

      writeOrder(templateCards(section).map(templateId).filter(Boolean));
      dragging = false;
      showToast('Urutan Routine disimpan permanen.');
    };

    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', finish, { once: true });
    document.addEventListener('pointercancel', finish, { once: true });
  }

  function enhanceTemplatePage() {
    const section = getTemplateSection();
    if (!section) return;
    applyTemplateOrder();

    const sub = section.querySelector('.section-sub');
    if (sub) sub.textContent = 'Urutan di sini menjadi urutan default setiap hari. Tahan ⋮⋮ untuk memindahkan.';

    templateCards(section).forEach(card => {
      if (card.querySelector('.template-order-handle')) return;
      const row = card.querySelector('.card-row');
      if (!row) return;
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'template-order-handle';
      handle.setAttribute('aria-label', 'Ubah urutan routine permanen');
      handle.setAttribute('title', 'Drag untuk mengubah urutan default');
      handle.textContent = '⋮⋮';
      handle.addEventListener('pointerdown', e => beginDrag(e, handle));
      row.appendChild(handle);
    });
  }

  function enhance() {
    queued = false;
    if (dragging) return;
    injectStyles();
    const page = document.querySelector('#pageTitle')?.textContent.trim().toLowerCase();
    if (page === 'routine') enhanceTemplatePage();
    if (page === 'today') applyOrderToToday();
  }

  function queueEnhance() {
    if (queued || dragging) return;
    queued = true;
    requestAnimationFrame(enhance);
  }

  const observer = new MutationObserver(queueEnhance);
  function start() {
    injectStyles();
    const main = document.querySelector('#main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    queueEnhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
