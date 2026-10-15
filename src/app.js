import {UNITS,UNIT_BY_ID,ENEMIES,ENEMY_BY_ID,WORLDS,TYPES,TOOLS,FACTS,UNLOCK_REWARDS,MINI_LEVELS,STORY,getLevel,levelId,unlockedUnits,levelUnlocked} from "./data.js";
import {makeGame,tick,place,collectToken,collectAll,currentProgress,scoreStars,selectAdvice,useGuard,availablePlacement} from "./engine.js";
const root=document.getElementById("app");
const KEY="just-oborona-progress-v1";
let audioContext=null;
function sound(freq=640,duration=.085){
 if(!save.settings.sound)return;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  audioContext=audioContext||new AC();
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type="sine";osc.frequency.setValueAtTime(freq,audioContext.currentTime);
  gain.gain.setValueAtTime(.035,audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start();osc.stop(audioContext.currentTime+duration);
 }catch{/* audio optional */}
}
const defaults={completed:{},settings:{sound:false,autoCollect:false,reducedMotion:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false,highContrast:false,largeText:false},mode:"normal"};
function readStore(){try{const saved=JSON.parse(localStorage.getItem(KEY));return { ...defaults,...saved,completed:saved?.completed||{},settings:{...defaults.settings,...saved?.settings}};}catch{return structuredClone(defaults);}}
let save=readStore();
let view="home",world=0,stage=1,level=getLevel(0,1),deck=[],selected="registrar",game=null;
let challenge=null;
let latestShotSound=0,lastShotSfxAt=-10;
let modal="",modalReturn="",almanacTab="units",almanacQuery="",detail=null,mini=null,focus={lane:2,col:2},speed=1,toast="",lastRender=0,prevTs=0,shownEnd=false;
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const E=escapeHtml;
const bossPartArt=(id)=>id;
const art=(id,cls="")=>`<img class="game-art ${cls}" src="./assets/sprites/${encodeURIComponent(id)}.svg" alt="" draggable="false" loading="eager" decoding="async">`;
const landscape=(w,cls="")=>`<img class="world-art ${cls}" src="./assets/worlds/world-${w+1}.svg" alt="" loading="lazy">`;
const btn=(action,label,classes="btn",props="")=>`<button type="button" class="${classes}" data-act="${action}" ${props}>${label}</button>`;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(save));}catch{/* private browsing: play without persistence */}}
function rank(){const n=Object.values(save.completed).reduce((s,x)=>s+x,0);return n>=120?"Почесний захисник прав":n>=90?"Начальник управління":n>=60?"Начальник відділу":n>=35?"Головний спеціаліст":n>=15?"Спеціаліст":"Стажер";}
function totalStars(){return Object.values(save.completed).reduce((a,b)=>a+b,0);}
function wrapper(main,active=""){
 const gameOn=view==="play";
 return `<div class="screen"><div class="shell">
 <header class="header"><div class="brand"><span class="brand-icon" aria-hidden="true">🦉</span><div><small>Правова пригодницька гра</small><strong>ЮСТ-ОБОРОНА</strong></div></div>
 <nav class="nav" aria-label="Навігація">
 ${btn("home","Головна","btn btn-quiet")}${btn("worlds","🗺️ Карта","btn btn-quiet")}${btn("almanac","📖 Альманах","btn btn-quiet")}${btn("settings","⚙️","btn btn-quiet","aria-label=\"Налаштування\"")}
 </nav></header>
 ${main}
 <footer class="footline"><span>© Ігровий прототип · Без реклами та стеження · Прогрес лише на цьому пристрої</span><span>Навчальна гра не є юридичною консультацією. Факти потребують фахової перевірки. <a href="https://just-dnipro.gov.ua/" target="_blank" rel="noopener noreferrer">Офіційний сайт ↗</a></span></footer>
 </div></div>${view==="play"?'<div class="portrait-tip">↻ Для комфортної гри поверніть телефон горизонтально. Вертикальна гра також доступна.</div>':""}`;
}
function renderHome(){
 return wrapper(`<section class="hero"><div class="hero-copy">
 <div class="eyebrow">40 справ · 4 світи · захисти свої права</div>
 <h1>Юст-<span>Оборона</span><br>Захисти домівку!</h1>
 <p>Схемники атакують майно, бізнес та державні реєстри. Створи оборону з реєстраторів, нотаріусів, виконавців і цифрових інструментів!</p>
 <div class="hero-actions">${btn("worlds","▶ Почати пригоду","btn btn-primary")}${btn("daily","📅 Справа дня","btn btn-dark")}${btn("endless","♾️ Нескінченна облога","btn")}</div>
 <div class="stat-row"><span>⭐ ${totalStars()} зірок</span><span>🎓 ${rank()}</span></div>
 </div><div class="hero-art" aria-hidden="true"><div class="hero-bubbles">🛡️ ✦ 📜</div><img class="hero-owl" src="./assets/yusya.svg" alt=""><div class="hero-paper">ПЕРЕВІРЕНО ✔</div></div></section>
 <section class="main"><div class="eyebrow">Підказка від Юсі</div><h2 class="section-title">Знай правильний інструмент!</h2>
 <div class="world-grid">${WORLDS.map((w,i)=>`<button class="world-card" data-act="world" data-world="${i}">${landscape(i,"world-art-sm")}<span class="world-emoji">${w.emoji}</span><strong>${w.name}</strong><p>${w.subtitle}</p></button>`).join("")}</div></section>`);
}
function worldCard(w,i){
 const unlocked=levelUnlocked(i,1,save.completed),done=Array.from({length:10},(_,k)=>save.completed[levelId(i,k+1)]!==undefined).filter(Boolean).length;
 return `<button type="button" class="world-card ${!unlocked?"locked":""}" data-act="world" data-world="${i}" ${!unlocked?"disabled":""}>${landscape(i,"world-art-sm")}<span class="world-emoji">${w.emoji}</span><strong>${i+1}. ${w.name}</strong><p>${w.subtitle}<br>${w.summary}</p><div class="progress-track"><div class="progress-fill" style="width:${done*10}%"></div></div><small>${unlocked?`${done}/10 справ`:"🔒 Спершу завершіть попередній світ"}</small></button>`;
}
function renderWorlds(){
 return wrapper(`<div class="main"><div class="eyebrow">Подорож родини Коваленків</div><h1 class="section-title">Оберіть світ</h1><div class="hint">🦉 ${STORY[Math.min(3,world)]}</div><div class="world-grid" style="margin-top:21px">${WORLDS.map(worldCard).join("")}</div>
 <p class="muted">Збереження автоматичне. Рівні відкриваються по черзі.</p></div>`);
}
function renderLevels(){
 const w=WORLDS[world],items=Array.from({length:10},(_,i)=>{
  const st=i+1,id=levelId(world,st),open=levelUnlocked(world,st,save.completed),n=save.completed[id];
  return `<button type="button" class="level-tile ${!open?"locked":""}" data-act="level" data-stage="${st}" ${!open?"disabled":""}>
  <strong>${world+1}·${st}</strong><span>${E(w.titles[i])}</span><em>${open?(n!==undefined?"★".repeat(n)+"☆".repeat(3-n):"▶ Грати"):"🔒"}</em></button>`;
 }).join("");
 return wrapper(`<main class="main"><div class="eyebrow">${w.emoji} Світ ${world+1} з 4</div><h1 class="section-title">${E(w.name)}: ${E(w.subtitle)}</h1><p class="hint">🦉 ${E(STORY[world])}</p><div class="level-grid" style="margin-top:20px">${items}</div>
 <div class="dialog-actions">${btn("worlds","← До карти","btn btn-quiet")}</div></main>`);
}
function slotLimit(){return 8+(totalStars()>=15?1:0)+(totalStars()>=60?1:0);}
function chooseSuggested(){
 const unlocked=challenge?UNITS:unlockedUnits(save.completed),max=slotLimit();
 const recommend=[
  ["registrar","cnap","notary","notification","senior","mine","commission","archive"],
  ["executor","cnap","limitation","trustee","private_executor","station","notary","registrar"],
  ["whistleblower","cnap","integrity","order","expert","intern","legal_aid","registrar"],
  ["twofactor","cnap","shield","notification","expert","apostille","digital_office","registrar"]
 ][world];
 const owned=new Set(unlocked.map(x=>x.id));
 deck=recommend.filter(x=>owned.has(x)).slice(0,max);
 if(!deck.length)deck=["registrar"];
 selected=deck[0];focus={lane:level.activeLanes[Math.floor(level.activeLanes.length/2)],col:2};
}
function unitCard(u,{selected=false,disabled=false,cooldown=0}={}){
 return `<button type="button" class="unit-card ${selected?"selected":""}" data-act="unit" data-unit="${u.id}" ${disabled?"disabled":""} aria-pressed="${selected}">
 <span class="cost">🟡${u.cost}</span><span class="glyph" aria-hidden="true">${art(u.id,"card-illustration")}</span><strong>${E(u.name)}</strong>
 <small>⏱ ${u.cooldown} с</small>${cooldown>.2?`<span class="cooldown">${Math.ceil(cooldown)}</span>`:""}</button>`;
}
function renderDeck(){
 const avail=challenge?UNITS:unlockedUnits(save.completed);const disabled=level.activeLanes.length===1&&level.stage===1;
 const types=[...new Set(level.enemies.map(id=>ENEMY_BY_ID[id]?.scheme).filter(Boolean))];
 const warns=types.filter(s=>!deck.some(id=>UNIT_BY_ID[id]?.tool&& (TOOLS[UNIT_BY_ID[id].tool]?.multipliers[Object.keys(TYPES).indexOf(s)]||0)>=1.5));
 return wrapper(`<main class="main"><div class="eyebrow">${challenge?"Особливий режим":"Справа "+level.id+" · "+WORLDS[world].name}</div><h1 class="section-title">${E(level.name)}</h1>
 <div class="split"><section><div class="panel"><h3>📂 Оберіть захисників</h3><p class="muted">Візьміть від 1 до 8 карток. Для встановлення потрібно заробляти печатки.</p>
 <div class="deck-grid">${avail.map(u=>unitCard(u,{selected:deck.includes(u.id)})).join("")}</div></div>
 <div class="deck-summary"><span><strong>${deck.length}/${slotLimit()}</strong> карток у справі</span>${btn("start","▶ Розпочати оборону","btn btn-primary",deck.length?'':'disabled')}</div></section>
 <aside class="panel"><h3>🕵️ Хто наступає?</h3><div style="display:grid;gap:10px">${level.enemies.map(id=>{const e=ENEMY_BY_ID[id];return `<div> <span class="tag">${TYPES[e.scheme].icon} ${TYPES[e.scheme].name}</span> <strong>${e.icon} ${E(e.name)}</strong></div>`;}).join("")}</div>
 <p class="hint" style="margin-top:16px">${warns.length?"🦉 Порада: у колоді бракує ефективних інструментів для деяких типів схем.":"🦉 Гарний вибір! Комбінуйте економіку, стіни та атакувальні картки."}</p>
 <p class="muted">${level.special.blackout?"🌙 Блекаут: потрібна зарядна станція.":""} ${level.special.fog?"🌫️ Туман приховує частину поля.":""}</p>
 <div class="eyebrow">Режим гри</div><div style="display:grid;gap:8px;margin:10px 0">
 <label><input type="radio" name="mode" value="young" ${save.mode==="young"?"checked":""}> Юний юрист</label>
 <label><input type="radio" name="mode" value="normal" ${save.mode==="normal"?"checked":""}> Звичайний</label>
 <label><input type="radio" name="mode" value="expert" ${save.mode==="expert"?"checked":""}> Експерт</label></div></aside></div></main>`);
}
function cellContent(lane,col){
 const d=game.defenders.find(x=>x.lane===lane&&x.col===col),lock=game.locks.some(x=>x.lane===lane&&x.col===col);
 let inner=lock?'<span class="locked-cell">🚫</span>':"";
 if(d)inner+=`<span class="defender ${d.shieldHp>0?"shielded":""} ${game.time<d.disabledUntil?"disabled":""} ${game.time-(d.lastShotAt??-10)<.22?"firing":""}"><span class="sprite">${art(d.id,"board-illustration")}</span><small>${E(d.name.split(" ")[0])}</small><span class="health" style="width:${Math.max(0,d.hp/d.maxHp)*96}%"></span></span>`;
 return inner;
}
function renderPlay(){
 if(!game)return renderHome();
 const remaining=game.plan.length-game.spawned,progress=currentProgress(game),status=game.phase!=="playing"?" · Завершено":"";
 const activeAttackers=game.projectiles?.length||0;
 const cards=deck.map((id,i)=>{const u=UNIT_BY_ID[id],cd=game.cooldowns[id]||0,afford=game.seal>=u.cost;
 return `<button type="button" data-act="unit" data-unit="${id}" class="unit-card ${selected===id?"selected":""}" ${cd>0?"disabled":""} title="${E(u.name)} — клавіша ${i+1}" aria-label="${E(u.name)}, ціна ${u.cost}"><span class="cost">🟡${u.cost}</span><span class="glyph">${art(u.id,"card-illustration")}</span><strong>${E(u.name)}</strong>${cd>.2?`<span class="cooldown">${Math.ceil(cd)}</span>`:""}<small>${afford?"Готово":"Бракує 🟡"}</small></button>`;}).join("");
 let cells="";
 for(let lane=0;lane<5;lane++)for(let col=0;col<9;col++){
  const active=level.activeLanes.includes(lane);
  cells+=`<button type="button" role="gridcell" data-act="cell" data-lane="${lane}" data-col="${col}" class="cell ${active?"":"out"} ${focus.lane===lane&&focus.col===col?"cursor":""}" ${active?"":"disabled"} aria-label="Ряд ${lane+1}, колонка ${col+1}">${cellContent(lane,col)}</button>`;
 }
 const tokens=game.tokens.map(t=>`<button class="token" type="button" aria-label="Зібрати 25 печаток" data-act="collect" data-id="${t.uid}" style="left:${(t.col+.3)*100/9}%;top:${(t.lane+.15)*100/5}%">✦</button>`).join("");
 const foes=game.enemies.map(e=>`<div data-enemy="${e.uid}" title="${E(e.name)}" class="enemy ${e.trait==="flying"?"flying":""} ${game.time-(e.lastHitAt??-10)<.18?"taking-hit":""} ${e.trait==="disguised_jump"&&!e.reveal?"disguised":""} ${game.time<e.frozenUntil?"frozen":""} ${e.id==="boss"?"boss":""}" style="left:${e.x*100/9}%;top:${e.lane*20+.35}%">
 <div class="enemy-inner"><span class="kind">${TYPES[e.scheme].icon}</span><span class="eicon">${art(bossPartArt(e.id==="boss"?level.bossData.id:e.id),"enemy-illustration")}</span><span class="hp-track"><b style="width:${Math.max(0,e.hp/e.maxHp)*100}%"></b></span></div></div>`).join("");
 const shots=game.projectiles.map(p=>`<span class="projectile shot-${p.kind}" data-projectile="${p.uid}" aria-hidden="true"></span>`).join("");
 const fx=game.effects.map(e=>`<span data-fx="${e.id}" style="position:absolute;left:${e.x*100/9}%;top:${e.lane*20+1}%;font-size:12px;font-weight:900;color:#fdfbf3;text-shadow:1px 2px #174563,0 0 5px #173752;white-space:nowrap">${E(e.text)}</span>`).join("");
 const guards=Array.from({length:5},(_,l)=>{
  const manual=level.boss&&level.world===0&&game.bossGuardReady&&game.enemies.some(e=>e.id==="boss"&&e.lane===l&&e.phase===3);
  return `<button type="button" class="guard ${game.usedGuards[l]?"used":""}" data-act="guard" data-lane="${l}" ${game.usedGuards[l]||!manual?"disabled":""} title="${manual?"Активувати заборону проти Барона":"Заборона спрацьовує автоматично під час прориву"}">🛑</button>`;
 }).join("");
 return wrapper(`<main class="main" style="padding:12px"><section class="game-shell">
 <div class="game-top"><div class="seal-pill">✦ ${Math.floor(game.seal)}</div>
 <div class="game-meta"><strong>${E(level.id)} · ${E(level.name)} ${status} · Хвиля ${game.stageWave}/${game.maxWave}</strong>
 <div class="progress-track"><div class="progress-fill" data-game-progress style="width:${progress}%"></div></div></div>
 <div class="game-controls">${btn("speed",speed===1?"▶ ×1":speed===2?"▶▶ ×2":"▶ ½","btn btn-quiet")}${btn("pause","⏸","btn btn-quiet","aria-label=\"Пауза\"")}</div></div>
 <div class="cardbar" aria-label="Колода захисників">${cards}</div>
 <div class="field-wrap ${level.special.blackout?"blackout":""} ${level.special.fog?"fog":""}" data-world="${level.world+1}">
 <div class="skyline" aria-hidden="true">${landscape(level.world,"scenery")}</div>
 <div class="board-frame"><div class="house-strip">${guards}</div><div class="board" role="grid" aria-label="Поле оборони, 5 рядків і 9 колонок">
 ${cells}<div class="projectile-layer" aria-hidden="true">${shots}</div><div class="enemy-layer" aria-hidden="true">${foes}</div><div class="tokens-layer">${tokens}</div><div class="vfx-layer" aria-hidden="true">${fx}</div></div></div></div>
 <div class="game-bottom"><span>🛡️ Захищено рядків: ${5-game.usedGuards.filter(Boolean).length}/5 · Схемників: ${game.enemies.length} · Пострілів: ${activeAttackers} · Залишилось: ${remaining}</span>
 <span>⌨️ 1–8: картка · Стрілки: клітинка · Enter: поставити · Пробіл: зібрати · P: пауза</span></div>
 </section><div class="owl-message" aria-live="polite"><div class="face" aria-hidden="true">🦉</div><div><strong>Сова Юся</strong>${E(toast||game.lastHint)}</div></div></main>`);
}

/** Update live sprites in place; do not rebuild the whole document every frame.
 * Preserves focused cells, touch gestures, the card strip position and CSS animations.
 */
function syncGameFrame(){
 if(view!=="play"||!game||modal)return;
 const $=(s)=>root.querySelector(s);
 const sealEl=$(".seal-pill"),waveEl=$(".game-meta strong"),bar=$("[data-game-progress]");
 if(!sealEl||!bar)return;
 sealEl.textContent="✦ "+Math.floor(game.seal);
 waveEl.textContent=level.id+" · "+level.name+" · Хвиля "+game.stageWave+"/"+game.maxWave;
 bar.style.width=currentProgress(game)+"%";
 const first=$(".game-bottom > span");
 if(first)first.textContent="🛡️ Захищено рядків: "+(5-game.usedGuards.filter(Boolean).length)+"/5 · Схемників: "+game.enemies.length+" · Пострілів: "+game.projectiles.length+" · Залишилось: "+(game.plan.length-game.spawned);
 const hint=$(".owl-message > div:last-child");
 if(hint){
  const msg=toast||game.lastHint;
  if(hint.dataset.lastMessage!==msg){
   hint.dataset.lastMessage=msg;
   hint.textContent="";
   const title=document.createElement("strong");title.textContent="Сова Юся";hint.append(title,document.createTextNode(msg));
  }
 }
 for(const card of root.querySelectorAll(".cardbar [data-unit]")){
  const id=card.dataset.unit,unit=UNIT_BY_ID[id],cd=game.cooldowns[id]||0;
  const disabled=cd>.1;card.disabled=disabled;
  card.classList.toggle("selected",selected===id);
  let mask=card.querySelector(".cooldown");
  if(disabled){
   if(!mask){mask=document.createElement("span");mask.className="cooldown";card.insertBefore(mask,card.querySelector("small"));}
   mask.textContent=String(Math.ceil(cd));
  }else if(mask)mask.remove();
  const status=card.querySelector("small");
  if(status)status.textContent=game.seal>=unit.cost?"Готово":"Бракує 🟡";
 }
 for(const cell of root.querySelectorAll(".board > .cell")){
  const row=+cell.dataset.lane,col=+cell.dataset.col;
  const html=cellContent(row,col);
  if(cell.dataset.content!==html){
   cell.innerHTML=html;cell.dataset.content=html;
  }
 }
 const board=$(".board"),layer=$(".enemy-layer"),shotLayer=$(".projectile-layer"),tokenLayer=$(".tokens-layer"),fxLayer=$(".vfx-layer");
 if(!board||!layer||!shotLayer||!tokenLayer||!fxLayer)return;
 const alive=new Set();
 for(const e of game.enemies){
  const id=String(e.uid);alive.add(id);
  let el=layer.querySelector('[data-enemy="'+id+'"]');
  if(!el){
   el=document.createElement("div");el.className="enemy";
   el.dataset.enemy=id;el.title=e.name;el.innerHTML='<div class="enemy-inner"><span class="kind"></span><span class="eicon"></span><span class="hp-track"><b></b></span></div>';
   const im=document.createElement("img");im.className="game-art enemy-illustration";
   im.alt="";im.draggable=false;im.decoding="async";im.src="./assets/sprites/"+encodeURIComponent(bossPartArt(e.id==="boss"?level.bossData.id:e.id))+".svg";
   el.querySelector(".eicon").append(im);layer.append(el);
  }
  el.style.left=(e.x*100/9)+"%";el.style.top=(e.lane*20+.35)+"%";
  el.classList.toggle("flying",e.trait==="flying"||e.air);
  el.classList.toggle("taking-hit",game.time-(e.lastHitAt??-10)<.18);
  el.classList.toggle("frozen",game.time<e.frozenUntil);
  el.classList.toggle("disguised",!e.reveal);
  el.classList.toggle("boss",e.id==="boss");
  const kind=el.querySelector(".kind");if(kind.textContent!==TYPES[e.scheme].icon)kind.textContent=TYPES[e.scheme].icon;
  el.querySelector(".hp-track b").style.width=Math.max(0,e.hp/e.maxHp)*100+"%";
 }
 for(const el of Array.from(layer.children))if(!alive.has(el.dataset.enemy))el.remove();

 const shotKinds={stamp:"✓",clip:"⌁",chain:"❄",writ:"§",dossier:"▣",dove:"✉",beam:""};
 const shotsAlive=new Set();
 const pxPerCol=board.clientWidth/9,pxPerRow=board.clientHeight/5;
 for(const p of game.projectiles){
  const id=String(p.uid);shotsAlive.add(id);
  let el=shotLayer.querySelector('[data-projectile="'+id+'"]');
  if(!el){
   el=document.createElement("span");el.className="projectile shot-"+p.kind;
   el.dataset.projectile=id;el.setAttribute("aria-hidden","true");shotLayer.append(el);
  }
  const symbol=shotKinds[p.kind]??"✦";
  if(el.textContent!==symbol)el.textContent=symbol;
  if(p.kind==="beam"){
   const dx=(p.endX-p.startX)*pxPerCol,dy=(p.endRow-p.startRow)*pxPerRow;
   el.style.left=p.startX*100/9+"%";el.style.top=p.startRow*20+"%";
   el.style.width=Math.hypot(dx,dy)+"px";
   el.style.transform="translateY(-50%) rotate("+Math.atan2(dy,dx)*180/Math.PI+"deg)";
   el.style.opacity=String(Math.max(0,1-p.age/p.duration));
  }else{
   el.style.left=p.x*100/9+"%";el.style.top=p.row*20+"%";
   el.style.transform="translate(-50%,-50%)";
  }
 }
 for(const el of Array.from(shotLayer.children))if(!shotsAlive.has(el.dataset.projectile))el.remove();
 if(save.settings.sound&&game.projectiles.length){
  const newest=game.projectiles[game.projectiles.length-1];
  if(newest.uid!==latestShotSound&&game.time-lastShotSfxAt>.14){
   latestShotSound=newest.uid;lastShotSfxAt=game.time;
   sound(newest.kind==="beam"?1160:newest.kind==="dossier"?240:newest.kind==="chain"?410:680,.055);
  }
 }
 const tokens=new Set();
 for(const t of game.tokens){
  const id=String(t.uid);tokens.add(id);
  let el=tokenLayer.querySelector('[data-id="'+id+'"]');
  if(!el){el=document.createElement("button");el.type="button";el.className="token";el.textContent="✦";el.dataset.act="collect";el.dataset.id=id;el.setAttribute("aria-label","Зібрати 25 печаток");tokenLayer.append(el);}
  el.style.left=(t.col+.3)*100/9+"%";el.style.top=(t.lane+.15)*20+"%";
 }
 for(const el of Array.from(tokenLayer.children))if(!tokens.has(el.dataset.id))el.remove();
 const fxs=new Set();
 for(const fx of game.effects){
  const id=String(fx.id);fxs.add(id);
  let el=fxLayer.querySelector('[data-fx="'+id+'"]');
  if(!el){
   el=document.createElement("span");el.dataset.fx=id;el.className="battle-fx";el.textContent=fx.text;fxLayer.append(el);
  }
  el.className="battle-fx fx-"+fx.kind;
  el.style.left=fx.x*100/9+"%";el.style.top=fx.lane*20+1+"%";
  el.style.opacity=Math.min(1,fx.ttl*2);
 }
 for(const el of Array.from(fxLayer.children))if(!fxs.has(el.dataset.fx))el.remove();
 for(const guard of root.querySelectorAll(".house-strip .guard")){
  const lane=+guard.dataset.lane,manual=level.boss&&level.world===0&&game.bossGuardReady&&game.enemies.some(e=>e.id==="boss"&&e.lane===lane&&e.phase===3);
  guard.disabled=game.usedGuards[lane]||!manual;guard.classList.toggle("used",game.usedGuards[lane]);
  guard.title=manual?"Активувати заборону проти Барона":"Заборона спрацьовує автоматично під час прориву";
 }
 const fog=$(".field-wrap");
 if(fog&&level.special.fog)fog.classList.toggle("fog-cleared",game.defenders.some(d=>d.kind==="reveal"&&d.col>=4));
}
function renderResult(){
 const success=game?.phase==="won",stars=success?scoreStars(game):0;
 const e=game?.lastThreat;
 const text=game?.challenge?.kind==="endless"
  ?`Відбито хвиль: ${Math.max(0,game.stageWave-1)}. Особистий рекорд: ${save.endlessBest||0}.`
  :success?"Захисники впоралися. Ви зберегли права родини!":`Прорвався ${e?.name||"схемник"}. Спробуйте іншу колоду та інструмент захисту.`;
 const reward=UNLOCK_REWARDS[level.id]?UNIT_BY_ID[UNLOCK_REWARDS[level.id]]:null;
 return wrapper(`<main class="main" style="max-width:830px;margin:0 auto"><div class="panel" style="text-align:center;padding:36px">
 <div class="large-emoji">${success?"🏆":"📰"}</div><div class="eyebrow">${challenge?"Особливий режим":success?"Справу розглянуто":"Юстиційний вісник"}</div>
 <h1 class="section-title">${game?.challenge?.kind==="endless"?"Кінець облоги":success?"Права захищено!":"Схема прорвалася!"}</h1><p>${E(text)}</p>
 ${success?`<div class="stars">${"★".repeat(stars)}${"☆".repeat(3-stars)}</div><p>${reward?"Нова картка: "+reward.icon+" "+E(reward.name):"Відкрито наступну справу та сторінку Альманаху."}</p>`:""}
 <div class="hint" style="text-align:left;margin-top:20px"><strong>📘 Як це в житті:</strong><p>${E(e?.tip||FACTS.general)}</p>
 <small>Юридична інформація має бути перевірена перед офіційним релізом.</small></div>
 <div class="dialog-actions" style="justify-content:center">${btn("retry","↻ Спробувати ще","btn btn-quiet")}${btn("levels","🗺️ До рівнів","btn btn-dark")}${success&&!challenge?btn("next-level","Наступна справа →","btn btn-primary"):""}
 ${success&&!challenge&&level.id==="4-10"?btn("certificate","🎓 Сертифікат","btn btn-primary"):""}</div>
 </div></main>`);
}
function renderAlmanac(){
 const units=almanacTab==="units",items=(units?UNITS:ENEMIES).filter(x=>x.name.toLocaleLowerCase("uk").includes(almanacQuery.toLocaleLowerCase("uk")));
 return wrapper(`<main class="main"><div class="eyebrow">Бібліотека правозахисника</div><h1 class="section-title">Альманах Юсі</h1>
 <div class="almanac-tabs">${btn("tab-units","🛡️ Захисники (24)","btn "+(units?"btn-primary":"btn-quiet"))}${btn("tab-enemies","🕵️ Схемники (19)","btn "+(!units?"btn-primary":"btn-quiet"))}${btn("back","← Назад","btn btn-dark")}</div>
 <label>Пошук <input id="almanac-search" type="search" placeholder="Назва персонажа..." value="${E(almanacQuery)}" style="padding:10px 13px;border-radius:12px;border:2px solid #a0bdc5;max-width:280px;width:100%"></label>
 <div class="almanac-list" style="margin-top:20px">${items.map(x=>`<button type="button" class="almanac-card" data-act="detail" data-id="${x.id}" data-kind="${units?"unit":"enemy"}">
 <span class="glyph">${art(x.id,"almanac-illustration")}</span><strong>${E(x.name)}</strong><span class="tag">${units?(x.tool?TOOLS[x.tool]?.icon+" "+TOOLS[x.tool]?.name:"Підтримка"):TYPES[x.scheme].icon+" "+TYPES[x.scheme].name}</span>
 <p>${E(units?x.desc:x.tip)}</p></button>`).join("")}</div></main>`);
}
function renderSettings(){
 return wrapper(`<main class="main" style="max-width:830px;margin:0 auto"><h1 class="section-title">Налаштування</h1>
 <div class="panel">${[["sound","Звукові ефекти"],["autoCollect","Автоматично збирати печатки"],["reducedMotion","Менше руху та ефектів"],["highContrast","Висококонтрастний режим"],["largeText","Збільшити текст"]].map(([id,label])=>`<label class="setting-row"><strong>${label}</strong><input type="checkbox" data-setting="${id}" ${save.settings[id]?"checked":""}></label>`).join("")}
 <p class="notice">Налаштування та прогрес зберігаються тільки у вашому браузері. Дані на сервер не передаються.</p>
 <div class="dialog-actions">${btn("back","← Назад","btn btn-dark")}${btn("reset","🗑️ Скинути прогрес","btn btn-danger")}</div></div></main>`);
}
function renderMini(){
 const type=level.mini;if(!mini)startMini();
 const heading={forgery:"🔍 Знайди підробку",assets:"🏙️ Знайди майно боржника",acts:"📋 Нормативний чи індивідуальний?",phishing:"📱 Справжнє чи фейк?"}[type];
 let body="";
 if(type==="forgery"){
  body=`<p>Знайди три підозрілі реквізити. Це умовні навчальні документи, а не справжня перевірка.</p>
  <div class="split" style="grid-template-columns:1fr 1fr"><div class="panel"><h3>Оригінал</h3><p>Дата: 12.05.2026</p><p>Реєстр: № 4728</p><p>Підпис: Коваленко</p><p>Адреса: Дніпро</p></div>
  <div class="panel"><h3>Підозрілий</h3>${["Дата: 12.05.2036","Реєстр: номер відсутній","Підпис: Каваленко","Адреса: Дніпро"].map((x,i)=>`<button type="button" class="btn ${mini.marked.includes(i)?"btn-primary":""}" style="display:block;width:100%;margin:7px 0" data-act="mini-choice" data-idx="${i}">${E(x)} ${mini.marked.includes(i)?"✔":""}</button>`).join("")}</div></div><p>Знайдено: ${mini.marked.length}/3</p>`;
 }else if(type==="assets"){
  body=`<p>Знайди три активи за 8 запитів. Підозрілі сектори позначені крапкою. Це навчальний макет.</p><p>Запитів залишилося: <strong>${8-mini.tries}</strong> · Активів: ${mini.found}/3</p><div class="mini-grid">${Array.from({length:36},(_,i)=>`<button data-act="mini-choice" data-idx="${i}" ${mini.opened.includes(i)?"disabled":""}>${mini.opened.includes(i)?([7,17,28].includes(i)?"💼":"—"):[1,7,10,13,17,20,24,28,33].includes(i)?"·":"□"}</button>`).join("")}</div>`;
 }else{
  const questions=type==="acts"?[
   ["Порядок видачі довідок громадянам","Нормативний","Індивідуальний",0],
   ["Наказ про призначення конкретної особи","Нормативний","Індивідуальний",1],
   ["Загальні правила обробки заяв","Нормативний","Індивідуальний",0],
   ["Наказ про відпустку працівника","Нормативний","Індивідуальний",1],
   ["Положення про загальну процедуру","Нормативний","Індивідуальний",0]
  ]:[
   ["«Терміново надішліть пароль від КЕП»","Безпечно","Шахрайство",1],
   ["«Сплатіть борг на особисту картку працівника»","Безпечно","Шахрайство",1],
   ["«Перевірте свій статус у застосунку, відкривши його самостійно»","Безпечно","Шахрайство",0],
   ["«Перейдіть за коротким посиланням для відновлення реєстру»","Безпечно","Шахрайство",1],
   ["«Не передавайте одноразові коди стороннім»","Безпечно","Шахрайство",0]
  ];
  const q=questions[mini.index%questions.length];
  body=`<p>Запитання ${mini.index+1}/5 · Правильних відповідей: ${mini.correct}</p><div class="panel"><h3>${E(q[0])}</h3>
  <div class="quiz-list">${[1,2].map((j,i)=>`<button data-act="mini-choice" data-idx="${i}">${E(q[j])}</button>`).join("")}</div></div><p class="notice">Навчальне спрощення, не правовий висновок.</p>`;
 }
 return wrapper(`<main class="main" style="max-width:970px;margin:auto"><div class="eyebrow">Бонусна справа ${level.id}</div><h1 class="section-title">${heading}</h1><div class="panel">${body}<p class="muted">${E(mini.feedback||"🦉 Уважно читай реквізити та не поспішай.")}</p></div><div class="dialog-actions">${btn("mini-retry","↻ Спочатку","btn btn-quiet")}${btn("levels","← На карту","btn btn-dark")}</div></main>`);
}
function startMini(){mini={marked:[],opened:[],tries:0,found:0,index:0,correct:0,feedback:""};}
function completeMini(){
 const id=level.id;save.completed[id]=Math.max(save.completed[id]||0,3);persist();view="result";game={phase:"won",lastThreat:null,usedGuards:[false,false,false,false,false],defenderLosses:0,breaches:0};
 render();
}
function miniAction(i){
 if(level.mini==="forgery"){
  if(i===3){mini.feedback="Цей реквізит збігається з оригіналом.";return;}
  if(!mini.marked.includes(i))mini.marked.push(i);
  mini.feedback="Знайдено невідповідність!";if(mini.marked.length>=3){completeMini();}
 }else if(level.mini==="assets"){
  if(mini.opened.includes(i))return;
  mini.opened.push(i);mini.tries++;
  if([7,17,28].includes(i)){mini.found++;mini.feedback="Актив підтверджено умовним запитом!";}
  else mini.feedback="Активу немає. Шукайте серед позначених секторів.";
  if(mini.found===3)completeMini();
  else if(mini.tries>=8){mini.feedback="Запити вичерпано. Повторіть пошук.";mini=null;startMini();}
 }else{
  const answer=(level.mini==="acts"?[0,1,0,1,0]:[1,1,0,1,0])[mini.index];
  if(i===answer){mini.correct++;mini.feedback="✔ Вірно!";}else{mini.feedback="Спробуйте врахувати правило з підказки Юсі.";}
  mini.index++;if(mini.index===5){if(mini.correct>=3)completeMini();else{const prev=mini.correct;startMini();mini.feedback=`Правильно ${prev}/5. Для перемоги потрібно 3.`;}}
 }
}
function renderDialog(){
 if(!modal)return "";
 const commonActions=`<div class="dialog-actions">${btn("close-modal","Закрити","btn btn-dark")}</div>`;
 let content="";
 if(modal==="pause")content=`<div class="large-emoji">⏸️</div><h2>Пауза</h2><p>Ваша справа чекає. Продовжуйте у зручному темпі.</p>
 <div class="dialog-actions">${btn("close-modal","▶ Продовжити","btn btn-primary")}${btn("retry","↻ Заново","btn btn-quiet")}${btn("levels","🗺️ На карту","btn btn-quiet")}</div>`;
 else if(modal==="detail"&&detail){
  const d=detail.kind==="unit"?UNIT_BY_ID[detail.id]:ENEMY_BY_ID[detail.id],isUnit=detail.kind==="unit";
  content=`<div class="detail-illustration">${art(d.id,"detail-art")}</div><div class="eyebrow">Альманах · ${isUnit?"Захисник":"Схемник"}</div><h2>${E(d.name)}</h2>
  <p class="hint"><strong>Як грає:</strong> ${E(isUnit?d.desc:d.tip)}</p>
  <p><strong>📘 Як це в житті</strong><br>${E(FACTS[isUnit?({registry:"registry",notary:"notary",digital:"cyber",enforcement:"debt",integrity:"corruption",expert:"expert"}[d.tool]||"general"):({forgery:"registry",cyber:"cyber",debt:"debt",corruption:"corruption",bureaucracy:"general"}[d.scheme]||"general")])}</p>
  <p class="notice">Статус: 🟨 Не затверджено юристом · Актуальність: чернетка GDD від 15.10.2026</p>
  <a href="https://just-dnipro.gov.ua/" target="_blank" rel="noopener noreferrer">Детальніше на офіційному сайті ↗</a>${commonActions}`;
 }else if(modal==="reset")content=`<h2>Скинути прогрес?</h2><p>Усі зірки, відкриті картки й результати на цьому пристрої буде стерто.</p><div class="dialog-actions">${btn("reset-confirm","Так, скинути","btn btn-danger")}${btn("close-modal","Скасувати","btn btn-dark")}</div>`;
 else if(modal==="certificate")content=`<h2>🎓 Сертифікат правової грамотності</h2><p>Вітаємо із завершенням чотирьох світів!</p><p>Отримано зірок: <strong>${totalStars()}</strong> · ${rank()}</p>
 <p>Щоб зберегти сертифікат у PDF, скористайтеся друком браузера → «Зберегти як PDF».</p>
 <div class="dialog-actions">${btn("print","🖨️ Друкувати","btn btn-primary")}${btn("close-modal","Закрити","btn btn-dark")}</div>`;
 return `<div class="overlay" role="presentation"><div class="dialog" role="dialog" aria-modal="true" aria-label="Ігрове вікно">${content}</div></div>`;
}
function render(){
 document.body.classList.toggle("high-contrast",!!save.settings.highContrast);
 document.body.classList.toggle("large-text",!!save.settings.largeText);
 document.body.classList.toggle("reduced-motion",!!save.settings.reducedMotion);
 let html=({home:renderHome,worlds:renderWorlds,levels:renderLevels,deck:renderDeck,play:renderPlay,result:renderResult,almanac:renderAlmanac,settings:renderSettings,mini:renderMini}[view]||renderHome)();
 root.innerHTML=html+renderDialog();
}
function setView(v){view=v;modal="";toast="";render();}
function goLevel(w,s){
 challenge=null;
 world=w;stage=s;level=getLevel(world,stage);mini=null;shownEnd=false;chooseSuggested();
 if(level.mini){startMini();setView("mini");}
 else setView("deck");
}
function startGame(){
 if(!deck.length)return;
 game=makeGame(level,deck,save.mode,{...save.settings,careerBonus:totalStars()>=35?25:0},challenge);selected=deck[0];shownEnd=false;latestShotSound=0;lastShotSfxAt=-10;
 game.lastHint=level.tutorial||`Світ ${world+1}. Захистіть будівлю, використовуючи відповідні інструменти.`;
 setView("play");
}
function finish(){
 if(!game||shownEnd)return;
 sound(game.phase==="won"?880:180,.25);
 shownEnd=true;
 if(game.challenge?.kind==="endless"){
  save.endlessBest=Math.max(save.endlessBest||0,game.stageWave-1);persist();
 }else if(game.challenge?.kind==="daily"){
  if(game.phase==="won"){save.dailyScores=save.dailyScores||{};save.dailyScores[game.challenge.date]=Math.max(scoreStars(game),save.dailyScores[game.challenge.date]||0);persist();}
 }else if(game.phase==="won"){
  const id=level.id;save.completed[id]=Math.max(scoreStars(game),save.completed[id]||0);persist();
 }
 setView("result");
}
function nextLevel(){
 if(stage<10)goLevel(world,stage+1);
 else if(world<3)goLevel(world+1,1);
 else setView("worlds");
}
function action(name,el){
 if(name==="home"){game=null;challenge=null;setView("home");return;}
 if(name==="daily"||name==="endless"){
  const date=new Date().toISOString().slice(0,10);
  const seed=Number(date.replaceAll("-",""));
  challenge={kind:name,date,seed};
  world=name==="daily"?seed%4:0;
  stage=6;level=getLevel(world,stage);
  level={...level,id:name,name:name==="daily"?"Справа дня · "+date:"Нескінченна облога",mini:null,boss:false,bossData:null,
   activeLanes:[0,1,2,3,4],special:{blackout:false,fog:false,deadline:false,restricted:false},
   startingSeals:name==="endless"?350:250};
  chooseSuggested();setView("deck");return;
 }
 if(name==="worlds"){game=null;challenge=null;setView("worlds");return;}
 if(name==="world"){const i=Number(el.dataset.world);if(levelUnlocked(i,1,save.completed)){world=i;setView("levels");}return;}
 if(name==="levels"){game=null;if(challenge){challenge=null;setView("worlds");}else setView("levels");return;}
 if(name==="level"){const st=Number(el.dataset.stage);if(levelUnlocked(world,st,save.completed))goLevel(world,st);return;}
 if(name==="start"){startGame();return;}
 if(name==="unit"){
  const id=el.dataset.unit;
  if(view==="deck"){
   if(deck.includes(id)&&deck.length>1)deck=deck.filter(x=>x!==id);
   else if(!deck.includes(id)&&deck.length<slotLimit())deck.push(id);
  }else if(view==="play"){selected=id;}
  render();return;
 }
 if(name==="cell"&&view==="play"){
  focus={lane:Number(el.dataset.lane),col:Number(el.dataset.col)};
  const result=place(game,selected,focus.lane,focus.col);
  toast=result.ok?`${UNIT_BY_ID[selected].name}: додано на поле.`:result.error;
  if(result.ok)sound(540,.09);
  render();return;
 }
 if(name==="collect"&&game){collectToken(game,Number(el.dataset.id));sound(950,.12);toast="Отримано 25 печаток довіри!";render();return;}
 if(name==="guard"&&game){const ok=useGuard(game,Number(el.dataset.lane));if(ok)sound(260,.24);toast=ok?"Заборону застосовано!":"У босовій справі дочекайтеся фінальної фази.";render();return;}
 if(name==="speed"){speed=speed===1?2:speed===2?.5:1;render();return;}
 if(name==="pause"){modal="pause";render();return;}
 if(name==="retry"){if(level.mini){startMini();setView("mini");}else startGame();return;}
 if(name==="next-level"){nextLevel();return;}
 if(name==="almanac"){modalReturn=view;setView("almanac");return;}
 if(name==="settings"){modalReturn=view;setView("settings");return;}
 if(name==="back"){
  const target=modalReturn==="play"&&game?.phase==="playing"?"play":modalReturn||"home";
  setView(target);return;
 }
 if(name==="tab-units"){almanacTab="units";render();return;}
 if(name==="tab-enemies"){almanacTab="enemies";render();return;}
 if(name==="detail"){detail={id:el.dataset.id,kind:el.dataset.kind};modal="detail";render();return;}
 if(name==="close-modal"){modal="";render();return;}
 if(name==="reset"){modal="reset";render();return;}
 if(name==="reset-confirm"){save=structuredClone(defaults);persist();modal="";setView("home");return;}
 if(name==="mini-choice"){miniAction(Number(el.dataset.idx));render();return;}
 if(name==="mini-retry"){startMini();render();return;}
 if(name==="certificate"){modal="certificate";render();return;}
 if(name==="print"){window.print();return;}
}
root.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(el&&!el.disabled){action(el.dataset.act,el);}});
root.addEventListener("change",e=>{
 if(e.target.matches("[data-setting]")){save.settings[e.target.dataset.setting]=e.target.checked;persist();if(game)game.settings=save.settings;render();}
 if(e.target.name==="mode"){save.mode=e.target.value;persist();}
});
root.addEventListener("input",e=>{if(e.target.id==="almanac-search"){almanacQuery=e.target.value;const pos=e.target.selectionStart;render();const n=document.getElementById("almanac-search");n?.focus();n?.setSelectionRange(pos,pos);}});
document.addEventListener("keydown",e=>{
 if(e.target instanceof HTMLInputElement)return;
 if(e.key==="Escape"&&modal){modal="";render();return;}
 if(view!=="play"||!game||modal)return;
 const key=e.key.toLowerCase();
 if(key==="p"){modal="pause";render();e.preventDefault();return;}
 if(/^[1-8]$/.test(key)&&deck[Number(key)-1]){selected=deck[Number(key)-1];render();return;}
 if(key===" "){collectAll(game);render();e.preventDefault();return;}
 if(key==="enter"){const result=place(game,selected,focus.lane,focus.col);toast=result.ok?"Захисника встановлено.":result.error;render();e.preventDefault();return;}
 const changes={arrowleft:[0,-1],arrowright:[0,1],arrowup:[-1,0],arrowdown:[1,0]};
 if(changes[key]){
  const [dr,dc]=changes[key];focus.col=Math.max(0,Math.min(8,focus.col+dc));
  focus.lane=Math.max(0,Math.min(4,focus.lane+dr));
  render();e.preventDefault();
 }
});
document.addEventListener("visibilitychange",()=>{prevTs=0;});
function loop(ts){
 if(!prevTs)prevTs=ts;
 const delta=Math.min((ts-prevTs)/1000,.1);prevTs=ts;
 if(view==="play"&&game?.phase==="playing"&&!modal&&!document.hidden){
  tick(game,delta*speed);
  if(game.phase!=="playing"){finish();}
  else if(ts-lastRender>34){lastRender=ts;syncGameFrame();}
 }
 requestAnimationFrame(loop);
}
render();
fetch("./content/facts.uk.json",{cache:"no-cache"})
 .then(r=>{if(!r.ok)throw Error("No local facts file");return r.json();})
 .then(body=>{if(body?.entries)for(const [k,v] of Object.entries(body.entries))if(Object.hasOwn(FACTS,k)&&typeof v==="string"&&v.length<600)FACTS[k]=v;if(view==="almanac"||modal==="detail")render();})
 .catch(()=>{/* Built-in provisional facts remain available offline. */});
requestAnimationFrame(loop);
