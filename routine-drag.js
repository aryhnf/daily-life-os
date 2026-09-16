(() => {
  const STYLE_ID = 'daily-os-routine-drag-style';
  const KEY_PREFIX = 'daily-os-routine-order:';
  let dragActive = false;
  let enhanceQueued = false;

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function storageKey() {
    return `${KEY_PREFIX}${localDateKey()}`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .routine-reorder-handle {
        width: 34px;
        height: 34px;
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #687584;
        font-size: 18px;
        line-height: 1;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }
      .routine-reorder-handle:active { cursor: grabbing; color: var(--accent); background: rgba(216,255,99,.08); }
      .routine-sort-placeholder {
        border: 1px dashed rgba(216,255,99,.32);
        border-radius: var(--radius, 18px);
        background: rgba(216,255,99,.035);
        margin-top: 9px;
        transition: height .15s ease, opacity .15s ease;
      }
      .section-head + .routine-sort-placeholder { margin-top: 0; }
      .routine-sort-dragging {
        z-index: 1000 !important;
        opacity: .92 !important;
        box-shadow: 0 22px 55px rgba(0,0,0,.42) !important;
        border-color: rgba(216,255,99,.48) !important;
        transform: scale(1.018);
        pointer-events: none !important;
      }
      body.routine-drag-active { cursor: grabbing; }
      body.routine-drag-active .bottom-nav { pointer-events: none; }
      @media (hover:hover) {
        .routine-reorder-handle:hover { color: var(--accent); background: rgba(216,255,99,.06); }
      }
    `;
    document.head.appendChild(style);
  }

  function getRoutineSection() {
    return [...document.querySelectorAll('.section')].find(section => {
      const title = section.querySelector('.section-title');
      return title && title.textContent.trim().toLowerCase() === 'daily routine';
    }) || null;
  }

  function routineCards(section) {
    if (!section) return [];
    return [...section.children].filter(el =>
      el.matches?.('.today-item[data-today-id^="routine:"]')
    );
  }

  function readOrder() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey()) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeOrder(ids) {
    try { localStorage.setItem(storageKey(), JSON.stringify(ids)); } catch {}
  }

  function showToast(message) {
    const root = document.querySelector('#toastRoot');
    if (!root) return;
    root.innerHTML = `<div class="toast">${message}</div>`;
    window.setTimeout(() => {
      if (root.textContent.includes(message)) root.innerHTML = '';
    }, 1900);
  }

  function applySavedOrder(section) {
    const cards = routineCards(section);
    if (cards.length < 2) return;
    const order = readOrder();
    if (!order.length) return;
    const rank = new Map(order.map((id, index) => [id, index]));
    const originalRank = new Map(cards.map((card, index) => [card.dataset.todayId, index]));
    const sorted = [...cards].sort((a, b) => {
      const ar = rank.has(a.dataset.todayId) ? rank.get(a.dataset.todayId) : 10000 + originalRank.get(a.dataset.todayId);
      const br = rank.has(b.dataset.todayId) ? rank.get(b.dataset.todayId) : 10000 + originalRank.get(b.dataset.todayId);
      return ar - br;
    });
    const changed = sorted.some((card, index) => card !== cards[index]);
    if (changed) sorted.forEach(card => section.appendChild(card));
  }

  function animateLayout(cards, before) {
    cards.forEach(card => {
      const oldTop = before.get(card);
      if (oldTop == null) return;
      const newTop = card.getBoundingClientRect().top;
      const delta = oldTop - newTop;
      if (Math.abs(delta) < 1) return;
      card.style.transition = 'none';
      card.style.transform = `translateY(${delta}px)`;
      card.getBoundingClientRect();
      requestAnimationFrame(() => {
        card.style.transition = 'transform 160ms cubic-bezier(.2,.8,.2,1), opacity .16s ease';
        card.style.transform = '';
      });
    });
  }

  function movePlaceholder(section, placeholder, clientY) {
    const cards = routineCards(section);
    const beforePositions = new Map(cards.map(card => [card, card.getBoundingClientRect().top]));
    let beforeCard = null;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        beforeCard = card;
        break;
      }
    }

    if (beforeCard) {
      if (placeholder.nextElementSibling !== beforeCard) section.insertBefore(placeholder, beforeCard);
    } else {
      const lastCard = cards[cards.length - 1];
      if (lastCard) {
        if (lastCard.nextElementSibling !== placeholder) lastCard.after(placeholder);
      } else if (!placeholder.isConnected) {
        section.appendChild(placeholder);
      }
    }
    animateLayout(cards, beforePositions);
  }

  function beginDrag(event, handle) {
    if (dragActive) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const card = handle.closest('.today-item[data-today-id^="routine:"]');
    const section = getRoutineSection();
    if (!card || !section) return;
    const cards = routineCards(section);
    if (cards.length < 2) return;

    event.preventDefault();
    event.stopPropagation();
    dragActive = true;
    document.body.classList.add('routine-drag-active');

    const rect = card.getBoundingClientRect();
    const grabOffsetY = event.clientY - rect.top;
    const placeholder = document.createElement('div');
    placeholder.className = 'routine-sort-placeholder';
    placeholder.style.height = `${rect.height}px`;

    section.insertBefore(placeholder, card);
    document.body.appendChild(card);

    card.classList.add('routine-sort-dragging');
    Object.assign(card.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      margin: '0',
      transition: 'none',
      transform: 'scale(1.018)'
    });

    const move = ev => {
      ev.preventDefault();
      card.style.top = `${ev.clientY - grabOffsetY}px`;

      const edge = 76;
      if (ev.clientY < edge) window.scrollBy(0, -9);
      else if (ev.clientY > window.innerHeight - edge) window.scrollBy(0, 9);

      movePlaceholder(section, placeholder, ev.clientY);
    };

    const finish = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);

      const visualTop = parseFloat(card.style.top) || rect.top;
      placeholder.replaceWith(card);
      card.classList.remove('routine-sort-dragging');
      document.body.classList.remove('routine-drag-active');

      Object.assign(card.style, {
        position: '', left: '', top: '', width: '', margin: '', zIndex: '', pointerEvents: ''
      });

      const finalRect = card.getBoundingClientRect();
      card.style.transition = 'none';
      card.style.transform = `translateY(${visualTop - finalRect.top}px) scale(1.018)`;
      card.getBoundingClientRect();
      requestAnimationFrame(() => {
        card.style.transition = 'transform 180ms cubic-bezier(.2,.85,.2,1), opacity .16s ease';
        card.style.transform = '';
      });

      const order = routineCards(section).map(item => item.dataset.todayId);
      writeOrder(order);
      dragActive = false;
      showToast('Urutan Daily Routine diubah untuk hari ini.');
    };

    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', finish, { once: true });
    document.addEventListener('pointercancel', finish, { once: true });
  }

  function enhance() {
    enhanceQueued = false;
    if (dragActive) return;
    injectStyles();

    const section = getRoutineSection();
    if (!section) return;
    applySavedOrder(section);

    const sub = section.querySelector('.section-sub');
    if (sub) sub.textContent = 'Tahan ⋮⋮ lalu drag untuk ubah urutan hari ini · swipe kiri untuk skip.';

    routineCards(section).forEach(card => {
      if (card.querySelector('.routine-reorder-handle')) return;
      const row = card.querySelector('.card-row');
      if (!row) return;
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'routine-reorder-handle';
      handle.setAttribute('aria-label', 'Ubah urutan routine');
      handle.setAttribute('title', 'Drag untuk ubah urutan hari ini');
      handle.textContent = '⋮⋮';
      handle.addEventListener('pointerdown', event => beginDrag(event, handle));
      row.appendChild(handle);
    });
  }

  function queueEnhance() {
    if (enhanceQueued || dragActive) return;
    enhanceQueued = true;
    requestAnimationFrame(enhance);
  }

  const observer = new MutationObserver(queueEnhance);
  const start = () => {
    injectStyles();
    const main = document.querySelector('#main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    queueEnhance();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
