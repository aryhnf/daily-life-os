(() => {
  const STYLE_ID = 'daily-os-polish-v6';
  const EXTRA_PREFIXES = ['daily-os-water-', 'daily-os-routine-order:'];
  let queued = false;
  let completionTarget = null;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body{background:radial-gradient(900px 420px at 50% -180px,rgba(216,255,99,.055),transparent 64%),var(--bg)}
      .topbar{box-shadow:0 12px 40px rgba(0,0,0,.10)}
      .main>section,.main>.grid-2{animation:ui-section-in .34s cubic-bezier(.2,.8,.2,1) both}
      .main>section:nth-child(2),.main>.grid-2:nth-child(2){animation-delay:30ms}
      .main>section:nth-child(3),.main>.grid-2:nth-child(3){animation-delay:55ms}
      .main>section:nth-child(4),.main>.grid-2:nth-child(4){animation-delay:80ms}
      .main>section:nth-child(n+5),.main>.grid-2:nth-child(n+5){animation-delay:100ms}
      @keyframes ui-section-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .card{background:linear-gradient(145deg,rgba(255,255,255,.018),rgba(255,255,255,0)),var(--surface);transition:border-color .18s ease,background .18s ease,transform .16s ease,box-shadow .18s ease}
      .today-item:active{transform:scale(.994)}
      .today-item.done{border-color:rgba(216,255,99,.22);background:linear-gradient(145deg,rgba(216,255,99,.05),transparent 58%),var(--surface)}
      .check-btn{position:relative;transition:transform .16s ease,background .18s ease,border-color .18s ease}
      .today-item.done .check-btn{animation:ui-check-pop .32s cubic-bezier(.2,.9,.25,1.25)}
      @keyframes ui-check-pop{0%{transform:scale(.72)}60%{transform:scale(1.14)}100%{transform:scale(1)}}
      .today-item.just-completed{animation:ui-card-complete .42s cubic-bezier(.2,.8,.2,1)}
      @keyframes ui-card-complete{0%{transform:scale(.985)}52%{transform:scale(1.012);border-color:rgba(216,255,99,.48)}100%{transform:scale(1)}}
      .score-ring{animation:ui-ring-in .42s cubic-bezier(.2,.85,.2,1) both}
      @keyframes ui-ring-in{from{opacity:.35;transform:scale(.88) rotate(-10deg)}to{opacity:1;transform:scale(1) rotate(0)}}
      .nav-item{position:relative;transition:color .18s ease,background .18s ease,transform .16s ease}.nav-item:active{transform:scale(.94)}
      .nav-item.active span{animation:ui-nav-pop .28s cubic-bezier(.2,.9,.25,1.25)}
      @keyframes ui-nav-pop{from{transform:translateY(2px) scale(.82)}to{transform:translateY(0) scale(1)}}
      .icon-btn,.primary-btn,.ghost-btn,.danger-btn,.action-btn,.chip,.day-chip{transition:transform .13s ease,filter .13s ease,background .18s ease,border-color .18s ease}
      .icon-btn:active,.primary-btn:active,.ghost-btn:active,.danger-btn:active,.action-btn:active,.chip:active,.day-chip:active{transform:scale(.965)}
      .modal-backdrop{animation:ui-backdrop-in .18s ease both}.modal{animation:ui-sheet-in .28s cubic-bezier(.2,.82,.2,1) both}
      @keyframes ui-backdrop-in{from{opacity:0}to{opacity:1}}@keyframes ui-sheet-in{from{opacity:.6;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      .toast{animation:ui-toast-in .22s cubic-bezier(.2,.9,.2,1),ui-toast-out .18s ease 1.72s forwards}
      @keyframes ui-toast-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes ui-toast-out{to{opacity:0;transform:translateY(4px) scale(.99)}}
      .tap-ripple{position:fixed;z-index:9999;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:rgba(216,255,99,.30);pointer-events:none;animation:ui-ripple .48s ease-out forwards}
      @keyframes ui-ripple{to{opacity:0;transform:scale(8)}}
      .ui-data-note{margin-top:10px;color:var(--muted);font-size:11px;line-height:1.45}
      @media (hover:hover) and (pointer:fine){.card:hover{border-color:#33404f}.today-item:hover{transform:translateY(-1px);box-shadow:0 13px 32px rgba(0,0,0,.16)}}
      @media (prefers-reduced-motion:reduce){.main>section,.main>.grid-2,.today-item.done .check-btn,.today-item.just-completed,.score-ring,.nav-item.active span,.modal-backdrop,.modal,.toast,.tap-ripple{animation:none!important}*{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function maybeRipple(event) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const target = event.target.closest('button,.ghost-btn,.primary-btn,.action-btn,.chip,.day-chip');
    if (!target || target.disabled || target.closest('.bottom-nav')) return;
    const dot = document.createElement('span');
    dot.className = 'tap-ripple';
    dot.style.left = `${event.clientX}px`;
    dot.style.top = `${event.clientY}px`;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 520);
  }

  function isExtraKey(key) { return !!key && EXTRA_PREFIXES.some(prefix => key.startsWith(prefix)); }
  function collectExtras() {
    const extras = {};
    try { for (let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(isExtraKey(key))extras[key]=localStorage.getItem(key);} } catch {}
    return extras;
  }
  function clearModuleExtras() {
    try { const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(isExtraKey(key))keys.push(key);}keys.forEach(key=>localStorage.removeItem(key)); } catch {}
  }
  function clearAllExtras() { clearModuleExtras(); try{localStorage.removeItem('daily-os-state');}catch{} }

  function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('daily-os-db',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function readState(){try{const db=await openDB();return await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readonly'),req=tx.objectStore('kv').get('state');req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error);});}catch{try{const raw=localStorage.getItem('daily-os-state');return raw?JSON.parse(raw):null;}catch{return null;}}}
  async function writeState(value){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(value,'state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{localStorage.setItem('daily-os-state',JSON.stringify(value));}}
  async function deleteState(){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').delete('state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{}}

  function localDateKey(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
  function downloadJSON(value,filename){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  async function exportAll(event){event.preventDefault();event.stopImmediatePropagation();downloadJSON({dailyOSBackupVersion:2,exportedAt:new Date().toISOString(),state:await readState(),localExtras:collectExtras()},`daily-os-backup-${localDateKey()}.json`);}
  async function importAll(event){
    event.stopImmediatePropagation();
    const file=event.target.files?.[0];if(!file)return;
    try{
      const raw=JSON.parse(await file.text()),state=raw?.dailyOSBackupVersion?raw.state:raw;
      if(!state||typeof state!=='object')throw new Error('invalid-state');
      clearModuleExtras();
      if(raw?.localExtras&&typeof raw.localExtras==='object')Object.entries(raw.localExtras).forEach(([key,value])=>{if(isExtraKey(key)&&typeof value==='string')try{localStorage.setItem(key,value);}catch{}});
      await writeState(state);
      location.reload();
    }catch{const root=document.querySelector('#toastRoot');if(root)root.innerHTML='<div class="toast">File backup tidak valid.</div>';}
  }
  async function resetAll(event){event.preventDefault();event.stopImmediatePropagation();if(!confirm('Hapus seluruh data lokal Daily OS, termasuk tracker air dan urutan harian?'))return;await deleteState();clearAllExtras();location.reload();}

  function polishSettings(){const card=document.querySelector('#exportData')?.closest('.card');if(card&&!card.querySelector('.ui-data-note')){const note=document.createElement('p');note.className='ui-data-note';note.textContent='Backup mencakup routine, body, skincare, plan, history, tracker air, dan urutan Daily Routine.';card.appendChild(note);}}
  function clarifyDayType(){if(document.querySelector('#pageTitle')?.textContent.trim().toLowerCase()!=='today')return;const meta=document.querySelector('#dayType')?.closest('.card')?.querySelector('.card-meta');if(meta)meta.textContent='Label untuk konteks hari ini. Tidak mengubah template otomatis.';}
  async function capImpossibleStreak(){if(document.querySelector('#pageTitle')?.textContent.trim().toLowerCase()!=='consistency')return;const state=await readState();if(!state?.createdAt)return;const created=new Date(state.createdAt);if(Number.isNaN(created.getTime()))return;const ageDays=Math.max(1,Math.floor((Date.now()-created.getTime())/86400000)+1),cards=[...document.querySelectorAll('.stat-card')],card=cards.find(x=>x.querySelector('span')?.textContent.trim().toLowerCase()==='current streak'),strong=card?.querySelector('strong'),current=parseInt(strong?.textContent||'',10);if(strong&&Number.isFinite(current)&&current>ageDays)strong.textContent=`${ageDays}d`;}

  function enhance(){queued=false;injectStyles();polishSettings();clarifyDayType();capImpossibleStreak();if(completionTarget){const card=document.querySelector(`.today-item[data-today-id="${CSS.escape(completionTarget)}"]`);if(card?.classList.contains('done')){card.classList.add('just-completed');setTimeout(()=>card.classList.remove('just-completed'),500);}completionTarget=null;}}
  function queueEnhance(){if(queued)return;queued=true;requestAnimationFrame(enhance);}

  document.addEventListener('pointerdown',event=>{const check=event.target.closest('[data-action="toggle"]');if(check)completionTarget=check.dataset.id||null;maybeRipple(event);},true);
  document.addEventListener('click',event=>{if(event.target.closest('#exportData'))exportAll(event);else if(event.target.closest('#resetData'))resetAll(event);},true);
  document.addEventListener('change',event=>{if(event.target.matches('#importData'))importAll(event);},true);

  const observer=new MutationObserver(queueEnhance);
  function start(){injectStyles();const main=document.querySelector('#main'),modal=document.querySelector('#modalRoot');if(main)observer.observe(main,{childList:true,subtree:true});if(modal)observer.observe(modal,{childList:true,subtree:true});queueEnhance();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
