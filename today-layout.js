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
    if (id.startsWith('plan:')) return 'task';
    if (id.startsWith('quick:')) return 'task';
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
    const overdue = text.includes('overdue') || !!card.querySelector('.card-title span');
    return overdue ? 0 : 1;
  }

  function normalizeExisting(main, routine, note, water) {
    const body = main.querySelector(':scope > [data-layout-section="body"]');
    const morning = main.querySelector(':scope > [data-layout-section="skin-am"]');
    const night = main.querySelector(':scope > [data-layout-section="skin-pm"]');
    const misc = main.querySelector(':scope > [data-layout-section="other"]');
    const tasks = main.querySelector(':scope > [data-layout-section="tasks"]');
    if (!routine || !body || !morning || !night || !tasks) return false;

    arranging = true;
    try {
      if (water) routine.after(water);
      (water || routine).after(body);
      body.after(morning);
      morning.after(night);
      let cursor = night;
      if (misc) { cursor.after(misc); cursor = misc; }
      if (note) { cursor.after(note); cursor = note; }
      cursor.after(tasks);
    } finally {
      arranging = false;
    }
    return true;
  }

  function arrange() {
    queued = false;
    if (arranging || !pageIsToday()) return;
    const main = document.querySelector('#main');
    if (!main) return;

    const scheduled = sectionByTitle('scheduled');
    const anytime = sectionByTitle('anytime');
    const routine = sectionByTitle('daily routine');
    const note = sectionByTitle('daily note');
    const water = main.querySelector(':scope > .water-section');

    if (!routine) return;
    if (!scheduled && !anytime) {
      normalizeExisting(main, routine, note, water);
      return;
    }

    arranging = true;
    try {
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

      scheduled?.remove();
      anytime?.remove();
      main.querySelectorAll(':scope > .dailyos-layout-section').forEach(el => el.remove());

      const bodySection = makeSection('body', 'Body', 'Workout hari ini. Waktu hanya tampil kalau memang kamu set.');
      bodyCards.forEach(card => bodySection.appendChild(card));
      if (!bodyCards.length) bodySection.insertAdjacentHTML('beforeend', '<div class="list-empty">Tidak ada aktivitas Body hari ini.</div>');

      const morningSection = makeSection('skin-am', 'Morning Skincare', 'Checklist berurutan, tanpa jam.');
      morningSkin.forEach(card => morningSection.appendChild(card));
      if (!morningSkin.length) morningSection.insertAdjacentHTML('beforeend', '<div class="list-empty">Tidak ada Morning Skincare hari ini.</div>');

      const nightSection = makeSection('skin-pm', 'Night Skincare', 'Checklist berurutan, tanpa jam.');
      nightSkin.forEach(card => nightSection.appendChild(card));
      if (!nightSkin.length) nightSection.insertAdjacentHTML('beforeend', '<div class="list-empty">Tidak ada Night Skincare hari ini.</div>');

      const miscSection = otherCards.length ? makeSection('other', 'Other', 'Item lain untuk hari ini.') : null;
      if (miscSection) otherCards.forEach(card => miscSection.appendChild(card));

      taskCards.sort((a, b) => taskPriority(a) - taskPriority(b));
      const taskSection = makeSection('tasks', 'Today Tasks', 'Overdue ditaruh paling atas. Task tetap menjadi bagian paling bawah Today.');
      taskCards.forEach(card => taskSection.appendChild(card));
      if (!taskCards.length) taskSection.insertAdjacentHTML('beforeend', '<div class="list-empty">Tidak ada task yang harus dikerjakan hari ini.</div>');

      routine.after(water || bodySection);
      if (water) water.after(bodySection);
      bodySection.after(morningSection);
      morningSection.after(nightSection);
      if (miscSection) nightSection.after(miscSection);

      const beforeTasks = miscSection || nightSection;
      if (note) beforeTasks.after(note);
      (note || beforeTasks).after(taskSection);
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
