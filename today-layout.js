(() => {
  let queued = false;
  let arranging = false;

  function pageIsToday() {
    return document.querySelector('#pageTitle')?.textContent.trim().toLowerCase() === 'today';
  }

  function sectionTitle(section) {
    return section?.querySelector('.section-title')?.textContent.trim().toLowerCase() || '';
  }

  function sectionByTitle(title) {
    return [...document.querySelectorAll('#main > .section')].find(section => sectionTitle(section) === title) || null;
  }

  function makeSection(key, title, subtitle = '') {
    const section = document.createElement('section');
    section.className = 'section dailyos-layout-section';
    section.dataset.layoutSection = key;
    section.innerHTML = `<div class="section-head"><div><h2 class="section-title">${title}</h2>${subtitle ? `<p class="section-sub">${subtitle}</p>` : ''}</div></div>`;
    return section;
  }

  function cardType(card) {
    const id = card?.dataset?.todayId || '';
    if (id.startsWith('body:')) return 'body';
    if (id.startsWith('skin:')) return id.endsWith(':am') ? 'skin-am' : 'skin-pm';
    if (id.startsWith('plan:') || id.startsWith('quick:')) return 'task';
    return 'other';
  }

  function cleanSkincareCard(card) {
    card.querySelector('.item-time')?.remove();
    card.querySelector('.drag-handle')?.remove();
    const edit = card.querySelector('[data-action="edit-source"]');
    if (edit) edit.textContent = 'Edit skincare';
  }

  function taskPriority(card) {
    const text = card.textContent.toLowerCase();
    return text.includes('overdue') || !!card.querySelector('.card-title span') ? 0 : 1;
  }

  function direct(main, selector) {
    return [...main.children].find(el => el.matches?.(selector)) || null;
  }

  function placeFlow(main) {
    const hero = direct(main, '.hero');
    const water = direct(main, '.water-section');
    const dayType = [...main.children].find(el => el.matches?.('.card') && el.querySelector?.('#dayType')) || null;
    const routine = sectionByTitle('daily routine');
    const body = direct(main, '[data-layout-section="body"]');
    const morning = direct(main, '[data-layout-section="skin-am"]');
    const night = direct(main, '[data-layout-section="skin-pm"]');
    const misc = direct(main, '[data-layout-section="other"]');
    const note = sectionByTitle('daily note');
    const tasks = direct(main, '[data-layout-section="tasks"]');

    let cursor = hero;
    const place = node => {
      if (!node) return;
      if (!cursor) {
        main.prepend(node);
        cursor = node;
        return;
      }
      if (cursor.nextElementSibling !== node) cursor.after(node);
      cursor = node;
    };

    // Air Minum paling atas, Today Tasks langsung di bawahnya.
    place(water);
    place(tasks);
    place(dayType);
    place(routine);
    place(body);
    place(morning);
    place(night);
    place(misc);
    place(note);
  }

  function buildFromBase(main, scheduled, anytime) {
    const sourceCards = [
      ...(scheduled ? [...scheduled.querySelectorAll(':scope > .today-item')] : []),
      ...(anytime ? [...anytime.querySelectorAll(':scope > .today-item')] : [])
    ];

    const bodyCards = [];
    const morningSkin = [];
    const nightSkin = [];
    const taskCards = [];
    const otherCards = [];

    for (const card of sourceCards) {
      const type = cardType(card);
      if (type === 'body') bodyCards.push(card);
      else if (type === 'skin-am') { cleanSkincareCard(card); morningSkin.push(card); }
      else if (type === 'skin-pm') { cleanSkincareCard(card); nightSkin.push(card); }
      else if (type === 'task') taskCards.push(card);
      else otherCards.push(card);
    }

    const bodySection = makeSection('body', 'Body', 'Workout hari ini. Waktu hanya tampil kalau memang kamu set.');
    const morningSection = makeSection('skin-am', 'Morning Skincare', 'Checklist berurutan, tanpa jam.');
    const nightSection = makeSection('skin-pm', 'Night Skincare', 'Checklist berurutan, tanpa jam.');
    const taskSection = makeSection('tasks', 'Today Tasks', 'Overdue ditaruh paling atas.');
    const miscSection = otherCards.length ? makeSection('other', 'Other', 'Item lain untuk hari ini.') : null;

    bodyCards.forEach(card => bodySection.appendChild(card));
    morningSkin.forEach(card => morningSection.appendChild(card));
    nightSkin.forEach(card => nightSection.appendChild(card));
    otherCards.forEach(card => miscSection?.appendChild(card));
    taskCards.sort((a, b) => taskPriority(a) - taskPriority(b)).forEach(card => taskSection.appendChild(card));

    if (!bodyCards.length) bodySection.insertAdjacentHTML('beforeend', '<div class="list-empty">Tidak ada aktivitas Body hari ini.</div>');
    if (!morningSkin.length) morningSection.insertAdjacentHTML('beforeend', '<div class="list-empty">Tidak ada Morning Skincare hari ini.</div>');
    if (!nightSkin.length) nightSection.insertAdjacentHTML('beforeend', '<div class="list-empty">Tidak ada Night Skincare hari ini.</div>');
    if (!taskCards.length) taskSection.insertAdjacentHTML('beforeend', '<div class="list-empty">Tidak ada task yang harus dikerjakan hari ini.</div>');

    // Tempel section baru dulu. Source baru dihapus setelah semua kartu aman dipindahkan.
    main.append(bodySection, morningSection, nightSection);
    if (miscSection) main.append(miscSection);
    main.append(taskSection);

    scheduled?.remove();
    anytime?.remove();

    // Hapus derived section lama, tetapi jangan yang baru dibuat.
    main.querySelectorAll(':scope > .dailyos-layout-section').forEach(section => {
      if (![bodySection, morningSection, nightSection, miscSection, taskSection].includes(section)) section.remove();
    });
  }

  function ensureSections(main) {
    const required = [
      ['body', 'Body', 'Workout hari ini. Waktu hanya tampil kalau memang kamu set.', 'Tidak ada aktivitas Body hari ini.'],
      ['skin-am', 'Morning Skincare', 'Checklist berurutan, tanpa jam.', 'Tidak ada Morning Skincare hari ini.'],
      ['skin-pm', 'Night Skincare', 'Checklist berurutan, tanpa jam.', 'Tidak ada Night Skincare hari ini.'],
      ['tasks', 'Today Tasks', 'Overdue ditaruh paling atas.', 'Tidak ada task yang harus dikerjakan hari ini.']
    ];
    for (const [key, title, subtitle, empty] of required) {
      if (direct(main, `[data-layout-section="${key}"]`)) continue;
      const section = makeSection(key, title, subtitle);
      section.insertAdjacentHTML('beforeend', `<div class="list-empty">${empty}</div>`);
      main.appendChild(section);
    }
  }

  function arrange() {
    queued = false;
    if (arranging || !pageIsToday()) return;
    const main = document.querySelector('#main');
    if (!main) return;

    const routine = sectionByTitle('daily routine');
    if (!routine) return;

    const scheduled = sectionByTitle('scheduled');
    const anytime = sectionByTitle('anytime');

    arranging = true;
    try {
      if (scheduled || anytime) buildFromBase(main, scheduled, anytime);
      else ensureSections(main);
      placeFlow(main);
    } finally {
      arranging = false;
    }
  }

  function queue() {
    if (queued || arranging) return;
    queued = true;
    requestAnimationFrame(arrange);
  }

  const observer = new MutationObserver(queue);
  function start() {
    const main = document.querySelector('#main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    queue();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();