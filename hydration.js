(() => {
  const STYLE_ID='daily-os-hydration-v7';
  const AMOUNT_PREFIX='daily-os-water-ml:';
  const TARGET_KEY='daily-os-water-target-ml';
  const STEP=250, DEFAULT_TARGET=2000;
  let queued=false;

  const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const amountKey=()=>`${AMOUNT_PREFIX}${dateKey()}`;
  function readNum(key,fallback=0){try{const raw=localStorage.getItem(key);if(raw==null)return fallback;const n=Number(raw);return Number.isFinite(n)&&n>=0?n:fallback;}catch{return fallback;}}
  const readAmount=()=>Math.max(0,Math.round(readNum(amountKey(),0)/STEP)*STEP);
  const readTarget=()=>{const n=readNum(TARGET_KEY,DEFAULT_TARGET);return n>=STEP?Math.round(n/STEP)*STEP:DEFAULT_TARGET;};
  function writeAmount(v){try{localStorage.setItem(amountKey(),String(Math.max(0,v)));}catch{}}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .water-card{position:relative;overflow:hidden;isolation:isolate}
      .water-card:before{content:"";position:absolute;z-index:-1;inset:-50% 44% 28% -18%;background:radial-gradient(circle,rgba(216,255,99,.08),transparent 68%);pointer-events:none}
      .water-card.complete{border-color:rgba(119,227,159,.40);background:linear-gradient(145deg,rgba(119,227,159,.055),transparent 60%),var(--surface)}
      .water-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.water-copy{min-width:0;flex:1}
      .water-kicker{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:11px}.water-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px rgba(216,255,99,.07)}
      .water-value{font-size:28px;line-height:1;letter-spacing:-.04em;font-weight:850;margin-top:7px}.water-value small{font-size:12px;color:var(--muted);font-weight:650;letter-spacing:0}
      .water-percent{display:inline-flex;margin-top:9px;padding:5px 8px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:10px;font-weight:750}
      .water-plus{min-width:98px;min-height:50px;border:0;border-radius:15px;background:var(--accent);color:var(--accent-ink);font-weight:850;cursor:pointer;position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:transform .13s ease,filter .18s ease}
      .water-plus:active{transform:scale(.965)}.water-plus:hover{filter:brightness(1.03)}
      .water-track{height:12px;background:var(--surface-2);border-radius:999px;overflow:hidden;margin-top:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
      .water-fill{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--accent),#bfe85a);transition:width .34s cubic-bezier(.2,.8,.2,1);position:relative;overflow:hidden}
      .water-fill:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 25%,rgba(255,255,255,.22) 45%,transparent 65%);transform:translateX(-120%);animation:water-shine 2.8s ease-in-out infinite}
      @keyframes water-shine{0%,58%{transform:translateX(-120%)}82%,100%{transform:translateX(120%)}}
      .water-glasses{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin-top:11px}.water-glass{height:8px;border-radius:999px;background:var(--surface-2);transition:transform .2s cubic-bezier(.2,.9,.25,1.2),background .18s ease}.water-glass.filled{background:var(--accent);transform:translateY(-1px)}
      .water-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}.water-status{color:var(--muted);font-size:12px;line-height:1.4}.water-undo{border:0;background:var(--surface-2);color:#c7d0db;border-radius:10px;min-height:36px;padding:7px 11px;cursor:pointer}.water-undo:disabled{opacity:.32;cursor:default}
      .water-celebrate{animation:water-pop .38s cubic-bezier(.2,.9,.2,1)}@keyframes water-pop{0%{transform:scale(.985)}55%{transform:scale(1.014)}100%{transform:scale(1)}}
      .water-drop-burst{position:absolute;width:9px;height:12px;border-radius:60% 60% 70% 70%;background:rgba(16,21,10,.5);pointer-events:none;left:50%;top:50%;animation:water-drop .55s ease-out forwards}
      @keyframes water-drop{0%{opacity:.85;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(1.3)}}
      @media(max-width:420px){.water-value{font-size:25px}.water-plus{min-width:88px}}
      @media(prefers-reduced-motion:reduce){.water-fill,.water-glass,.water-plus{transition:none}.water-fill:after,.water-celebrate,.water-drop-burst{animation:none!important}}
    `;document.head.appendChild(s);
  }

  function toast(msg){const root=document.querySelector('#toastRoot');if(!root)return;root.innerHTML=`<div class="toast">${msg}</div>`;setTimeout(()=>{if(root.textContent.includes(msg))root.innerHTML='';},2000);}
  function anchor(){const main=document.querySelector('#main');if(!main)return null;const routine=[...main.children].find(el=>el.querySelector?.('.section-title')?.textContent.trim().toLowerCase()==='daily routine');if(routine)return routine;const card=main.querySelector(':scope > .card');return card?.nextElementSibling||null;}
  function build(){const section=document.createElement('section');section.className='section water-section';section.innerHTML=`
    <div class="section-head"><div><h2 class="section-title">Air Minum</h2><p class="section-sub">250 ml per tap · target default 2 L</p></div></div>
    <article class="card water-card">
      <div class="water-top"><div class="water-copy"><div class="water-kicker"><span class="water-dot"></span><span>Hydration hari ini</span></div><div class="water-value"><span data-water-current>0</span> ml <small>/ <span data-water-target>2000</span> ml</small></div><span class="water-percent" data-water-percent>0%</span></div><button type="button" class="water-plus" data-water-add>+250 ml</button></div>
      <div class="water-track" aria-label="Progress air minum"><div class="water-fill" data-water-fill></div></div>
      <div class="water-glasses" data-water-glasses aria-hidden="true"></div>
      <div class="water-bottom"><div class="water-status" data-water-status>0 dari 8 kali minum</div><button type="button" class="water-undo" data-water-sub>−250 ml</button></div>
    </article>`;return section;}

  function burst(button){if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;[-1,0,1].forEach((n,i)=>{const d=document.createElement('span');d.className='water-drop-burst';d.style.setProperty('--x',`${n*22}px`);d.style.setProperty('--y',`${-22-Math.abs(n)*8}px`);d.style.animationDelay=`${i*25}ms`;button.appendChild(d);setTimeout(()=>d.remove(),700);});}
  function render(section,before=null){
    const amount=readAmount(),target=readTarget(),card=section.querySelector('.water-card'),doneBefore=before!=null&&before>=target,done=amount>=target,count=Math.round(amount/STEP),targetCount=Math.max(1,Math.round(target/STEP)),pct=Math.min(100,Math.round(amount/target*100)),remaining=Math.max(0,target-amount);
    section.querySelector('[data-water-current]').textContent=amount.toLocaleString('id-ID');section.querySelector('[data-water-target]').textContent=target.toLocaleString('id-ID');section.querySelector('[data-water-percent]').textContent=`${pct}%`;section.querySelector('[data-water-fill]').style.width=`${pct}%`;section.querySelector('[data-water-sub]').disabled=amount===0;card.classList.toggle('complete',done);
    section.querySelector('[data-water-status]').textContent=done?(amount>target?`Target tercapai · +${(amount-target).toLocaleString('id-ID')} ml di atas target`:`Target tercapai · ${count} kali minum`):`Sisa ${remaining.toLocaleString('id-ID')} ml · ${count}/${targetCount} kali`;
    const glasses=section.querySelector('[data-water-glasses]'),slots=Math.min(12,Math.max(8,targetCount));glasses.style.gridTemplateColumns=`repeat(${slots},minmax(0,1fr))`;glasses.innerHTML=Array.from({length:slots},(_,i)=>`<span class="water-glass ${i<Math.min(count,slots)?'filled':''}"></span>`).join('');
    if(done&&!doneBefore){card.classList.remove('water-celebrate');void card.offsetWidth;card.classList.add('water-celebrate');toast('Target air hari ini tercapai.');}
  }
  function bind(section){const add=section.querySelector('[data-water-add]');add.addEventListener('click',()=>{const before=readAmount();writeAmount(before+STEP);burst(add);render(section,before);});section.querySelector('[data-water-sub]').addEventListener('click',()=>{const before=readAmount();writeAmount(Math.max(0,before-STEP));render(section,before);});}
  function enhance(){queued=false;injectStyles();const main=document.querySelector('#main');if(!main||document.querySelector('#pageTitle')?.textContent.trim().toLowerCase()!=='today'||main.querySelector('.water-section'))return;const a=anchor();if(!a)return;const section=build();main.insertBefore(section,a);bind(section);render(section);}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(enhance);}
  const observer=new MutationObserver(queue);function start(){injectStyles();const main=document.querySelector('#main');if(main)observer.observe(main,{childList:true,subtree:true});queue();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
