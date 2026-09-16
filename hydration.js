(() => {
  const STYLE_ID = 'daily-os-hydration-style';
  const AMOUNT_KEY_PREFIX = 'daily-os-water-ml:';
  const TARGET_KEY = 'daily-os-water-target-ml';
  const STEP_ML = 250;
  const DEFAULT_TARGET_ML = 2000;
  let enhanceQueued = false;

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function amountKey() {
    return `${AMOUNT_KEY_PREFIX}${localDateKey()}`;
  }

  function readNumber(key, fallback = 0) {
    try {
      const raw = Number(localStorage.getItem(key));
      return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
    } catch {
      return fallback;
    }
  }

  function readAmount() {
    return Math.max(0, Math.round(readNumber(amountKey(), 0) / STEP_ML) * STEP_ML);
  }

  function readTarget() {
    const target = readNumber(TARGET_KEY, DEFAULT_TARGET_ML);
    return target >= STEP_ML ? Math.round(target / STEP_ML) * STEP_ML : DEFAULT_TARGET_ML;
  }

  function writeAmount(value) {
    try { localStorage.setItem(amountKey(), String(Math.max(0, value))); } catch {}
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .water-card {
        overflow: hidden;
        position: relative;
      }
      .water-card.complete {
        border-color: rgba(119,227,159,.42);
      }
      .water-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
      }
      .water-value {
        font-size: 27px;
        line-height: 1;
        letter-spacing: -.035em;
        font-weight: 850;
        margin-top: 5px;
      }
      .water-value small {
        font-size: 12px;
        color: var(--muted);
        font-weight: 650;
        letter-spacing: 0;
      }
      .water-plus {
        min-width: 94px;
        min-height: 48px;
        border: 0;
        border-radius: 14px;
        background: var(--accent);
        color: var(--accent-ink);
        font-weight: 850;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .water-plus:active { transform: scale(.97); }
      .water-track {
        height: 10px;
        background: var(--surface-2);
        border-radius: 999px;
        overflow: hidden;
        margin-top: 15px;
      }
      .water-fill {
        height: 100%;
        width: 0;
        border-radius: inherit;
        background: var(--accent);
        transition: width .28s cubic-bezier(.2,.8,.2,1);
      }
      .water-glasses {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 5px;
        margin-top: 11px;
      }
      .water-glass {
        height: 9px;
        border-radius: 999px;
        background: var(--surface-2);
        transition: transform .18s ease, background .18s ease;
      }
      .water-glass.filled {
        background: var(--accent);
        transform: translateY(-1px);
      }
      .water-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 12px;
      }
      .water-status {
        color: var(--muted);
        font-size: 12px;
      }
      .water-undo {
        border: 0;
        background: var(--surface-2);
        color: #c7d0db;
        border-radius: 10px;
        min-height: 34px;
        padding: 7px 10px;
        cursor: pointer;
      }
      .water-undo:disabled {
        opacity: .35;
        cursor: default;
      }
      .water-celebrate {
        animation: water-pop .34s cubic-bezier(.2,.9,.2,1);
      }
      @keyframes water-pop {
        0% { transform: scale(.985); }
        55% { transform: scale(1.012); }
        100% { transform: scale(1); }
      }
      @media (max-width: 420px) {
        .water-value { font-size: 24px; }
        .water-plus { min-width: 86px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .water-fill, .water-glass, .water-plus { transition: none; }
        .water-celebrate { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    const root = document.querySelector('#toastRoot');
    if (!root) return;
    root.innerHTML = `<div class="toast">${message}</div>`;
    window.setTimeout(() => {
      if (root.textContent.includes(message)) root.innerHTML = '';
    }, 2000);
  }

  function findTodayAnchor() {
    const main = document.querySelector('#main');
    if (!main) return null;
    const sections = [...main.children];
    const routine = sections.find(el => el.querySelector?.('.section-title')?.textContent.trim().toLowerCase() === 'daily routine');
    if (routine) return routine;
    const dayTypeCard = main.querySelector(':scope > .card');
    return dayTypeCard?.nextElementSibling || null;
  }

  function buildCard() {
    const section = document.createElement('section');
    section.className = 'section water-section';
    section.innerHTML = `
      <div class="section-head">
        <div>
          <h2 class="section-title">Air Minum</h2>
          <p class="section-sub">1 kali minum = 250 ml · target default 2 L</p>
        </div>
      </div>
      <article class="card water-card">
        <div class="water-top">
          <div>
            <p class="card-meta" style="margin-top:0">Hari ini</p>
            <div class="water-value"><span data-water-current>0</span> ml <small>/ <span data-water-target>2000</span> ml</small></div>
          </div>
          <button type="button" class="water-plus" data-water-add>+250 ml</button>
        </div>
        <div class="water-track" aria-hidden="true"><div class="water-fill" data-water-fill></div></div>
        <div class="water-glasses" data-water-glasses aria-label="Progress gelas air"></div>
        <div class="water-bottom">
          <div class="water-status" data-water-status>0 dari 8 gelas</div>
          <button type="button" class="water-undo" data-water-sub>−250 ml</button>
        </div>
      </article>
    `;
    return section;
  }

  function render(section, previousAmount = null) {
    const amount = readAmount();
    const target = readTarget();
    const card = section.querySelector('.water-card');
    const completedBefore = previousAmount != null && previousAmount >= target;
    const completedNow = amount >= target;
    const count = Math.round(amount / STEP_ML);
    const targetCount = Math.max(1, Math.round(target / STEP_ML));
    const pct = Math.min(100, Math.round(amount / target * 100));

    section.querySelector('[data-water-current]').textContent = amount.toLocaleString('id-ID');
    section.querySelector('[data-water-target]').textContent = target.toLocaleString('id-ID');
    section.querySelector('[data-water-fill]').style.width = `${pct}%`;
    section.querySelector('[data-water-status]').textContent = completedNow
      ? `Target tercapai · ${count} kali minum`
      : `${count} dari ${targetCount} kali minum`;
    section.querySelector('[data-water-sub]').disabled = amount === 0;
    card.classList.toggle('complete', completedNow);

    const glasses = section.querySelector('[data-water-glasses]');
    const visibleSlots = Math.min(12, Math.max(8, targetCount));
    glasses.style.gridTemplateColumns = `repeat(${visibleSlots}, minmax(0, 1fr))`;
    glasses.innerHTML = Array.from({ length: visibleSlots }, (_, i) =>
      `<span class="water-glass ${i < Math.min(count, visibleSlots) ? 'filled' : ''}"></span>`
    ).join('');

    if (completedNow && !completedBefore) {
      card.classList.remove('water-celebrate');
      void card.offsetWidth;
      card.classList.add('water-celebrate');
      showToast('Target air hari ini tercapai.');
    }
  }

  function bind(section) {
    section.querySelector('[data-water-add]').addEventListener('click', () => {
      const before = readAmount();
      writeAmount(before + STEP_ML);
      render(section, before);
    });
    section.querySelector('[data-water-sub]').addEventListener('click', () => {
      const before = readAmount();
      writeAmount(Math.max(0, before - STEP_ML));
      render(section, before);
    });
  }

  function enhance() {
    enhanceQueued = false;
    injectStyles();
    const main = document.querySelector('#main');
    if (!main) return;
    const pageTitle = document.querySelector('#pageTitle')?.textContent.trim().toLowerCase();
    if (pageTitle !== 'today') return;
    if (main.querySelector('.water-section')) return;

    const anchor = findTodayAnchor();
    if (!anchor) return;
    const section = buildCard();
    main.insertBefore(section, anchor);
    bind(section);
    render(section);
  }

  function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
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
