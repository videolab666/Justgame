import {UNITS,UNIT_BY_ID,ENEMIES,ENEMY_BY_ID,WORLDS,TYPES,TOOLS,FACTS,UNLOCK_REWARDS,MINI_LEVELS,STORY,getLevel,levelId,unlockedUnits,levelUnlocked} from "./data.js";
import {makeGame,tick,place,collectToken,collectAll,currentProgress,scoreStars,selectAdvice,useGuard,availablePlacement,explainFiring} from "./engine.js";
import {getThreat,getEncounterThreats,getCounterAdvice} from "./tactics.js";
import {Soundtrack} from "./music.js";
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
const defaults={completed:{},seen:{units:{},enemies:{}},settings:{sound:false,music:true,musicVolume:40,autoCollect:false,tutorials:true,reducedMotion:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false,highContrast:false,largeText:false},mode:"normal"};
function readStore(){try{const saved=JSON.parse(localStorage.getItem(KEY));return { ...defaults,...saved,completed:saved?.completed||{},seen:{units:{...saved?.seen?.units},enemies:{...saved?.seen?.enemies}},settings:{...defaults.settings,...saved?.settings}};}catch{return structuredClone(defaults);}}
let save=readStore();
const soundtrack=new Soundtrack();
soundtrack.configure(save.settings.music,save.settings.musicVolume);
let view="home",world=0,stage=1,level=getLevel(0,1),deck=[],selected="registrar",game=null;
let challenge=null,outroElapsed=0;
// First-encounter coach marks: pause, spotlight the new card/enemy, explain it.
let introQueue=[],intro=null;
let latestShotSound=0,lastShotSfxAt=-10;
let selectedThreat="schemer";
let modal="",modalReturn="",almanacTab="units",almanacQuery="",detail=null,mini=null,focus={lane:2,col:2},speed=1,toast="",lastRender=0,prevTs=0,shownEnd=false;
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const E=escapeHtml;
const SCHEMES_UI=Object.keys(TYPES);
const bossPartArt=(id)=>id;
const DISGUISE_TRAITS=["disguised_jump","disguised_split"];
const isDisguised=e=>!e.reveal&&DISGUISE_TRAITS.includes(e.trait);
/** Masked broker/heir use a separate costume until "Сповіщення" or the
 * expert tears the mask off, so the player can see what changed. */
function enemySprite(e){
 if(e.id==="boss")return level.bossData?.id||"baron";
 return isDisguised(e)?e.id+"_disguised":e.id;
}
const enemyKindIcon=e=>isDisguised(e)?"🎭":TYPES[e.scheme].icon;
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
 return `<button type="button" class="unit-card ${selected?"selected":""}" data-act="unit" data-unit="${u.id}" data-tool="${E(u.tool||"support")}" data-kind="${E(u.kind)}" ${disabled?"disabled":""} aria-pressed="${selected}">
 <span class="cost">🟡${u.cost}</span><span class="glyph" aria-hidden="true">${art(u.id,"card-illustration")}</span><strong>${E(u.name)}</strong>
 <small>⏱ ${u.cooldown} с</small>${cooldown>.2?`<span class="cooldown">${Math.ceil(cooldown)}</span>`:""}</button>`;
}

function availableUnits(){return challenge?UNITS:unlockedUnits(save.completed);}
function threatArtwork(id){return id==="boss"?level.bossData?.id||"baron":id;}
function renderThreatChip(id){
 const t=getThreat(id,level),info=getCounterAdvice(id,{level,deck,owned:availableUnits()});
 if(!t||!info)return "";
 const equipped=info.recommended.find(u=>u.state==="deck"),count=game?.enemies.filter(e=>e.id===id).length||0;
 return '<button type="button" class="threat-chip" data-scheme="'+E(t.scheme)+'" data-act="threat-tip" data-enemy="'+E(id)+'" aria-label="Порада проти '+E(t.name)+'">'+
 '<span class="threat-portrait">'+art(threatArtwork(id),"threat-illustration")+'</span>'+
 '<span class="threat-copy"><strong>'+E(t.name)+'</strong><small>'+E(TYPES[t.scheme]?.name||"Загроза")+'</small><em>'+E(equipped?"У колоді: "+equipped.name:"Потрібна тактика")+'</em></span>'+
 '<span class="threat-active" data-threat-count="'+E(id)+'">'+(count?"×"+count:"i")+'</span></button>';
}
function renderThreatLegend(compact=false){
 const ids=getEncounterThreats(level,game);
 return '<section class="threat-legend'+(compact?" threat-compact":"")+'" aria-label="Легенда нападників">'+
 '<div class="threat-heading"><div><strong>🕵️ Хто наступає?</strong><small>Натисніть на ворога — дізнаєтесь, чим його зупинити</small></div>'+
 btn("hint","💡 Підказка для хвилі","btn btn-primary")+'</div>'+
 '<div class="threat-list">'+ids.map(renderThreatChip).join("")+'</div>'+
 '<p class="threat-disclaimer">Підбір враховує тип загрози, маскування, польоти та підземні цілі. Це правила гри.</p></section>';
}
function renderCounterModal(){
 const info=getCounterAdvice(selectedThreat,{level,deck,owned:availableUnits()});
 if(!info)return '<h2>Підказка недоступна</h2>';
 const t=info.threat,states={deck:"✓ У колоді",owned:"Доступний",locked:"🔒 Не відкрито"};
 const rows=info.recommended.map(u=>{
 const select=u.state==="deck"&&view==="play"?btn("pick-counter","Обрати","btn btn-quiet",'data-unit="'+E(u.id)+'"'):"";
 return '<div class="counter-row"><span class="counter-art">'+art(u.id,"counter-illustration")+'</span><div><strong>'+E(u.name)+'</strong><small>'+
 E(TOOLS[u.tool]?.name||"Допоміжний")+' · '+(u.multiplier>1?"Перевага ×"+u.multiplier:u.multiplier<1?"Шкода ×"+u.multiplier:"Звичайна ефективність")+
 '</small><small class="counter-state">'+states[u.state]+'</small></div>'+select+'</div>';
 }).join("");
 const extra=info.support.filter(id=>UNIT_BY_ID[id]).map(id=>E(UNIT_BY_ID[id].name)).join(", ");
 return '<div class="counter-header"><span class="counter-header-art">'+art(threatArtwork(selectedThreat),"detail-art")+'</span><div class="eyebrow">Ігровий довідник · '+E(TYPES[t.scheme]?.name||"Загроза")+'</div><h2>'+E(t.name)+'</h2></div>'+
 '<div class="hint"><strong>🦉 Тактика Юсі:</strong> '+E(info.note)+'</div>'+
 (extra?'<p><strong>Допоміжні інструменти:</strong> '+extra+'</p>':"")+
 '<h3>🎯 Чим атакувати</h3><div class="counter-list">'+rows+'</div>'+
 '<p class="notice">Підказки описують механіку гри та не є юридичною консультацією.</p>'+
 '<div class="dialog-actions">'+btn("close-modal","Повернутися","btn btn-dark")+'</div>';
}

function renderDeck(){
 const avail=challenge?UNITS:unlockedUnits(save.completed);const disabled=level.activeLanes.length===1&&level.stage===1;
 const types=[...new Set(level.enemies.map(id=>ENEMY_BY_ID[id]?.scheme).filter(Boolean))];
 const warns=types.filter(s=>!deck.some(id=>UNIT_BY_ID[id]?.tool&& (TOOLS[UNIT_BY_ID[id].tool]?.multipliers[Object.keys(TYPES).indexOf(s)]||0)>=1.5));
 return wrapper(`<main class="main"><div class="eyebrow">${challenge?"Особливий режим":"Справа "+level.id+" · "+WORLDS[world].name}</div><h1 class="section-title">${E(level.name)}</h1>
 <div class="split"><section><div class="panel"><h3>📂 Оберіть захисників</h3><p class="muted">Візьміть від 1 до 8 карток. Для встановлення потрібно заробляти печатки.</p>
 <div class="deck-grid">${avail.map(u=>unitCard(u,{selected:deck.includes(u.id)})).join("")}</div></div>
 <div class="deck-summary"><span><strong>${deck.length}/${slotLimit()}</strong> карток у справі</span>${btn("start","▶ Розпочати оборону","btn btn-primary",deck.length?'':'disabled')}</div></section>
 <aside class="panel"><div class="deck-threat-box">${renderThreatLegend(true)}</div>
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
 if(d)inner+=`<span data-tool="${E(d.tool||"none")}" data-kind="${E(d.kind)}" class="defender ${d.shieldHp>0?"shielded":""} ${game.time<d.disabledUntil?"disabled":""} ${game.time-(d.lastShotAt??-10)<.38?"firing":""} ${game.time-d.placedAt<.28?"placing":""} ${game.time-(d.lastDamagedAt??-10)<.22?"hurt":""}"><span class="sprite">${art(d.id,"board-illustration")}</span><span class="unit-status" aria-hidden="true"></span>${["shooter","intern","lobber","splash","air","slow","sniper","global"].includes(d.kind)?'<span class="attack-arm" aria-hidden="true"><span class="attack-hand"></span><span class="attack-item"></span></span>':""}<small>${E(d.name.split(" ")[0])}</small><span class="health" style="width:${Math.max(0,d.hp/d.maxHp)*96}%"></span></span>`;
 return inner;
}
/** The Baron's final "Заборона" stays usable even if this lane's guard
 * was already spent on an ordinary breach (mirrors engine useGuard). */
function bossGuardAvailable(lane){
 return !!(level.boss&&level.world===0&&game.bossGuardReady&&!game.bossGuardUsed&&
  game.enemies.some(e=>e.id==="boss"&&e.lane===lane&&e.phase===3));
}
function renderPlay(){
 if(!game)return renderHome();
 const remaining=game.plan.length-game.spawned,progress=currentProgress(game),status=game.phase!=="playing"?" · Завершено":"";
 const activeAttackers=game.projectiles?.length||0;
 const cards=deck.map((id,i)=>{const u=UNIT_BY_ID[id],cd=game.cooldowns[id]||0,afford=game.seal>=u.cost;
 return `<button type="button" data-act="unit" data-unit="${id}" data-tool="${E(u.tool||"support")}" data-kind="${E(u.kind)}" class="unit-card ${selected===id?"selected":""}" ${cd>0?"disabled":""} title="${E(u.name)} — клавіша ${i+1}" aria-label="${E(u.name)}, ціна ${u.cost}"><span class="cost">🟡${u.cost}</span><span class="glyph">${art(u.id,"card-illustration")}</span><strong>${E(u.name)}</strong>${cd>.2?`<span class="cooldown">${Math.ceil(cd)}</span>`:""}<small>${afford?"Готово":"Бракує 🟡"}</small></button>`;}).join("");
 let cells="";
 for(let lane=0;lane<5;lane++)for(let col=0;col<9;col++){
  const active=level.activeLanes.includes(lane);
  cells+=`<button type="button" role="gridcell" data-act="cell" data-lane="${lane}" data-col="${col}" class="cell ${active?"":"out"} ${focus.lane===lane&&focus.col===col?"cursor":""}" ${active?"":"disabled"} aria-label="Ряд ${lane+1}, колонка ${col+1}">${cellContent(lane,col)}</button>`;
 }
 const tokens=game.tokens.map(t=>`<button class="token" type="button" aria-label="Зібрати 25 печаток" data-act="collect" data-id="${t.uid}" style="left:${(t.col+.3)*100/9}%;top:${(t.lane+.15)*100/5}%">✦</button>`).join("");
 const foes=game.enemies.map(e=>`<div data-enemy="${e.uid}" title="${E(e.name)}" data-trait="${E(e.trait)}" data-scheme="${E(e.scheme)}" class="enemy ${e.trait==="flying"?"flying":""} ${game.time-(e.attackUntil??-10)<0?"attacking":""} ${game.time-(e.lastHitAt??-10)<.18?"taking-hit":""} ${isDisguised(e)?"disguised":""} ${game.time<e.frozenUntil?"frozen":""} ${e.id==="boss"?"boss":""}" style="left:${e.x*100/9}%;top:${e.lane*20+.35}%">
 <div class="enemy-inner"><span class="kind">${enemyKindIcon(e)}</span><span class="mask-tag" aria-hidden="true">🎭 Маскування</span><span class="eicon">${art(enemySprite(e),"enemy-illustration")}</span><span class="hp-track"><b style="width:${Math.max(0,e.hp/e.maxHp)*100}%"></b></span></div></div>`).join("");
 const shots=game.projectiles.map(p=>`<span class="projectile shot-${p.kind}" data-projectile="${p.uid}" aria-hidden="true"></span>`).join("");
 const fx=game.effects.map(e=>`<span data-fx="${e.id}" style="position:absolute;left:${e.x*100/9}%;top:${e.lane*20+1}%;font-size:12px;font-weight:900;color:#fdfbf3;text-shadow:1px 2px #174563,0 0 5px #173752;white-space:nowrap">${E(e.text)}</span>`).join("");
 const guards=Array.from({length:5},(_,l)=>{
  const manual=bossGuardAvailable(l);
  return `<button type="button" class="guard ${game.usedGuards[l]&&!manual?"used":""}" data-act="guard" data-lane="${l}" ${!manual?"disabled":""} title="${manual?"Активувати заборону проти Барона":"Заборона спрацьовує автоматично під час прориву"}">🛑</button>`;
 }).join("");
 return wrapper(`<main class="main" style="padding:12px"><section class="game-shell">
 <div class="game-top"><div class="seal-pill">✦ ${Math.floor(game.seal)}</div>
 <div class="game-meta"><strong>${E(level.id)} · ${E(level.name)} ${status} · Хвиля ${game.stageWave}/${game.maxWave}</strong>
 <div class="progress-track"><div class="progress-fill" data-game-progress style="width:${progress}%"></div></div></div>
 <div class="game-controls">${btn("speed",speed===1?"▶ ×1":speed===2?"▶▶ ×2":"▶ ½","btn btn-quiet")}${btn("music-toggle",save.settings.music?"♫":"♪̸","btn btn-quiet",'aria-label="Фонова музика" aria-pressed="'+save.settings.music+'"')}${btn("pause","⏸","btn btn-quiet","aria-label=\"Пауза\"")}</div></div>
 <div class="cardbar" aria-label="Колода захисників">${cards}</div>
 <div class="selected-help" aria-live="off"><span>↘ <strong data-selected-name>${E(UNIT_BY_ID[selected]?.name||"Захисник")}</strong></span><span data-selected-desc>${E(UNIT_BY_ID[selected]?.desc||"Оберіть клітинку для захисту.")}</span></div>
 <div class="field-wrap ${level.special.blackout?"blackout":""} ${level.special.fog?"fog":""}" data-world="${level.world+1}">
 <div class="skyline" aria-hidden="true">${landscape(level.world,"scenery")}</div>
 <div class="board-frame"><div class="house-strip">${guards}</div><div class="board" role="grid" aria-label="Поле оборони, 5 рядків і 9 колонок">
 ${cells}<div class="placement-preview" aria-hidden="true">${art(selected,"preview-art")}</div><div class="projectile-layer" aria-hidden="true">${shots}</div><div class="particle-layer" aria-hidden="true"></div><div class="enemy-layer" aria-hidden="true">${foes}</div><div class="fallen-layer" aria-hidden="true"></div><div class="tokens-layer">${tokens}</div><div class="vfx-layer" aria-hidden="true">${fx}</div></div></div></div>
 <div class="game-bottom"><span>🛡️ Захищено рядків: ${5-game.usedGuards.filter(Boolean).length}/5 · Схемників: ${game.enemies.length} · Пострілів: ${activeAttackers} · Залишилось: ${remaining}</span>
 <span>⌨️ 1–8: картка · Стрілки: клітинка · Enter: поставити · Пробіл: зібрати · P: пауза</span></div>
 </section>${renderThreatLegend()}<div class="owl-message" aria-live="polite"><div class="face" aria-hidden="true">🦉</div><div><strong>Сова Юся</strong>${E(toast||game.lastHint)}</div></div></main>`);
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
 const unitName=$("[data-selected-name]"),unitDesc=$("[data-selected-desc]");
 if(unitName)unitName.textContent=UNIT_BY_ID[selected]?.name||"Захисник";
 if(unitDesc)unitDesc.textContent=UNIT_BY_ID[selected]?.desc||"Оберіть клітинку для захисту.";
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
 const hotRows=new Set(game.enemies.filter(e=>e.hp>0&&e.x<=6.5&&e.trait!=="neutral").map(e=>e.lane));
 for(const cell of root.querySelectorAll(".board > .cell")){
  const row=+cell.dataset.lane,col=+cell.dataset.col;
  cell.classList.toggle("lane-under-attack",hotRows.has(row));
  const d=game.defenders.find(x=>x.lane===row&&x.col===col);
  const lock=game.locks.find(x=>x.lane===row&&x.col===col);
  const key=(d?d.uid+":"+d.id:"empty")+":"+(lock?lock.enemyUid??"locked":"free");
  // Replace the original illustration only when an occupant changes.
  // Replacing it every 34ms interrupted recoil and hurt animations.
  if(cell.dataset.renderKey!==key){
   cell.innerHTML=cellContent(row,col);cell.dataset.renderKey=key;
  }
  const sprite=cell.querySelector(".defender");
  if(sprite&&d){
   const reason=explainFiring(game,d)||"Підтримка оборони.";
   cell.title=d.name+" — "+reason;
   const badge=sprite.querySelector(".unit-status");
   if(badge){
    const icon=reason.includes("Туман")?"🌫":
     reason.includes("Замаскована")?"👁":
     reason.includes("повітряні")?"✈":
     reason.includes("під землею")?"🕳":
     reason.includes("заблоковано")||reason.includes("дезорієнтовано")?"⛔":
     reason.includes("позаду")?"↩":"";
    if(badge.textContent!==icon)badge.textContent=icon;
    badge.classList.toggle("visible",!!icon);
    badge.title=reason;
   }
   sprite.classList.toggle("firing",game.time-(d.lastShotAt??-10)<.38);
   sprite.classList.toggle("placing",game.time-d.placedAt<.28);
   sprite.classList.toggle("hurt",game.time-(d.lastDamagedAt??-10)<.22);
   sprite.classList.toggle("disabled",game.time<d.disabledUntil||game.time<d.confusedUntil);
   sprite.classList.toggle("shielded",d.shieldHp>0);
   const bar=sprite.querySelector(".health");
   if(bar)bar.style.width=Math.max(0,d.hp/d.maxHp)*96+"%";
  }
 }
 const board=$(".board"),layer=$(".enemy-layer"),fallenLayer=$(".fallen-layer"),shotLayer=$(".projectile-layer"),particleLayer=$(".particle-layer"),tokenLayer=$(".tokens-layer"),fxLayer=$(".vfx-layer");
 if(!board||!layer||!fallenLayer||!shotLayer||!particleLayer||!tokenLayer||!fxLayer)return;
 const alive=new Set();
 for(const e of game.enemies){
  const id=String(e.uid);alive.add(id);
  let el=layer.querySelector('[data-enemy="'+id+'"]');
  if(!el){
   el=document.createElement("div");el.className="enemy";
   el.dataset.enemy=id;el.dataset.trait=e.trait;el.dataset.scheme=e.scheme;el.title=e.name;el.innerHTML='<div class="enemy-inner"><span class="kind"></span><span class="mask-tag" aria-hidden="true">🎭 Маскування</span><span class="eicon"></span><span class="hp-track"><b></b></span></div>';
   const im=document.createElement("img");im.className="game-art enemy-illustration";
   im.alt="";im.draggable=false;im.decoding="async";
   el.querySelector(".eicon").append(im);layer.append(el);
  }
  // Costume swap when the disguise is removed (masked -> real sprite).
  const sprite=enemySprite(e),im=el.querySelector(".enemy-illustration");
  if(im&&im.dataset.sprite!==sprite){
   const wasMasked=im.dataset.sprite?.endsWith("_disguised");
   im.dataset.sprite=sprite;im.src="./assets/sprites/"+encodeURIComponent(sprite)+".svg";
   if(wasMasked){el.classList.remove("unmasking");void el.offsetWidth;el.classList.add("unmasking");}
  }
  el.style.left=(e.x*100/9)+"%";el.style.top=(e.lane*20+.35)+"%";
  // Arc of a jump over a defender (engine sets lift 0..1 while airborne).
  const lift=e.lift||0;
  el.style.transform=lift>0?"translateX(-50%) translateY("+(-lift*55)+"%) rotate("+(-lift*12)+"deg)":"";
  el.classList.toggle("jumping",lift>0);
  el.classList.toggle("flying",e.trait==="flying"||e.air);
  el.classList.toggle("taking-hit",game.time-(e.lastHitAt??-10)<.18);
  el.classList.toggle("attacking",game.time<(e.attackUntil??-10));
  el.classList.toggle("frozen",game.time<e.frozenUntil);
  el.classList.toggle("disguised",isDisguised(e));
  el.classList.toggle("boss",e.id==="boss");
  el.classList.toggle("shielded",e.shield>0);
  const kind=el.querySelector(".kind"),kindIcon=enemyKindIcon(e);if(kind.textContent!==kindIcon)kind.textContent=kindIcon;
  el.querySelector(".hp-track b").style.width=Math.max(0,e.hp/e.maxHp)*100+"%";
 }
 for(const el of Array.from(layer.children))if(!alive.has(el.dataset.enemy))el.remove();


 const fading=new Set();
 for(const f of game.fallen){
  const id=String(f.uid);fading.add(id);
  let el=fallenLayer.querySelector('[data-fallen="'+id+'"]');
  if(!el){
   el=document.createElement("div");
   el.className="fallen-defender";el.dataset.fallen=id;
   const img=document.createElement("img");
   img.className="game-art";img.alt="";img.draggable=false;
   img.src="./assets/sprites/"+encodeURIComponent(f.id)+".svg";
   el.append(img);fallenLayer.append(el);
  }
  el.style.left=(f.col+.5)*100/9+"%";
  el.style.top=(f.lane+.5)*20+"%";
  el.style.opacity=String(Math.max(0,1-f.age/f.ttl));
  el.style.transform="translate(-50%,-50%) rotate("+(f.reason==="seize"?-20:35)*f.age/f.ttl+
   "deg) translateY("+(f.age/f.ttl*22)+"px) scale("+(1-f.age/f.ttl*.3)+")";
 }
 for(const el of Array.from(fallenLayer.children))if(!fading.has(el.dataset.fallen))el.remove();
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
   el.style.setProperty("--shot-angle",p.ballistic?"-18deg":"0deg");
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

 const pieces=new Set();
 for(const p of game.particles){
  const id=String(p.uid);pieces.add(id);
  let el=particleLayer.querySelector('[data-particle="'+id+'"]');
  if(!el){
   el=document.createElement("span");
   el.className="combat-particle particle-"+p.kind;
   el.dataset.particle=id;el.setAttribute("aria-hidden","true");
   particleLayer.append(el);
  }
  el.style.left=p.x*100/9+"%";el.style.top=p.row*20+"%";
  el.style.opacity=String(Math.max(0,1-p.age/p.ttl));
  el.style.transform="translate(-50%,-50%) rotate("+(p.spin*p.age)+"deg)";
 }
 for(const el of Array.from(particleLayer.children))if(!pieces.has(el.dataset.particle))el.remove();
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
  el.dataset.world=String(level.world+1);
  el.style.left=fx.x*100/9+"%";el.style.top=fx.lane*20+1+"%";
  el.style.opacity=Math.min(1,fx.ttl*2);
 }
 for(const el of Array.from(fxLayer.children))if(!fxs.has(el.dataset.fx))el.remove();
 for(const guard of root.querySelectorAll(".house-strip .guard")){
  const lane=+guard.dataset.lane,manual=bossGuardAvailable(lane);
  guard.disabled=!manual;
  guard.classList.toggle("used",game.usedGuards[lane]&&!manual);
  const approaching=game.enemies.some(e=>e.lane===lane&&e.hp>0&&e.x<4.5&&e.trait!=="neutral");
  guard.classList.toggle("lane-danger",approaching&&!game.usedGuards[lane]);
  guard.title=manual?"Активувати заборону проти Барона":"Заборона спрацьовує автоматично під час прориву";
 }
 updatePlacementPreview();
 // Expand the legend in place if a boss summons new enemy types.
 const roster=root.querySelector?.(".threat-legend:not(.threat-compact) .threat-list");
 if(roster){
  const ids=getEncounterThreats(level,game),signature=ids.join(",");
  if(roster.dataset.roster!==signature){
   const previousX=roster.scrollLeft;
   roster.innerHTML=ids.map(renderThreatChip).join("");
   roster.dataset.roster=signature;
   roster.scrollLeft=previousX;
  }
 }
 const counts=root.querySelectorAll?.("[data-threat-count]")||[];
 for(const count of counts){
  const n=game.enemies.filter(e=>e.id===count.dataset.threatCount).length;
  const label=n?"×"+n:"i";if(count.textContent!==label)count.textContent=label;
  count.classList.toggle("is-active",n>0);
 }
 const fog=$(".field-wrap");
 if(fog&&level.special.fog)fog.classList.toggle("fog-cleared",game.defenders.some(d=>d.kind==="reveal"&&d.col>=4));
}

function renderOutro(){
 const won=game?.phase==="won",stars=won?scoreStars(game):0;
 const foeId=game?.lastThreat?.id==="boss"?level.bossData?.id:game?.lastThreat?.id||"schemer";
 const starsArt=won?'<div class="outro-stars">'+Array.from({length:3},(_,i)=>
  '<span class="'+(i<stars?"earned":"empty")+'" style="--order:'+i+'">'+(i<stars?"★":"☆")+'</span>').join("")+'</div>':
  '<p class="outro-warning">Змініть оборону та скористайтеся підказками Юсі.</p>';
 const particles=Array.from({length:22},(_,i)=>'<span class="outro-spark" style="--n:'+i+';--dist:'+ (90+(i%5)*28) +'px;--angle:'+(i*137.5)+'deg;--delay:'+((i%6)*.11)+'s"></span>').join("");
 return wrapper('<main class="outro-scene '+(won?"outro-victory":"outro-defeat")+'"><div class="outro-ambient" aria-hidden="true">'+particles+'</div>'+
 '<div class="outro-curtain"><div class="outro-eyebrow">'+(won?"✦ СПРАВУ ВИКОНАНО ✦":"⚠️ ТРИВОГА НА ПОЛІ")+'</div>'+
 '<h1 class="outro-title">'+(won?"СХЕМУ ЗУПИНЕНО!":"ОБОРОНУ ПРОРВАНО")+'</h1>'+
 '<p class="outro-subtitle">'+(won?"Права родини захищено. Юся святкує перемогу!":"Захисники відступили, але ще можна повернутися сильнішими.")+'</p>'+
 '<div class="outro-characters"><div class="outro-character outro-hero">'+'<img class="game-art outro-yusya" src="./assets/yusya.svg" alt="Сова Юся" draggable="false">'+'</div>'+
 '<span class="outro-center">'+(won?"🏆":"🛡️")+'</span><div class="outro-character outro-villain">'+art(foeId,"outro-enemy")+'</div></div>'+
 starsArt+'<div class="outro-progress" aria-hidden="true"><span></span></div>'+
 btn("skip-outro","Переглянути статистику →","btn btn-primary")+'</div></main>');
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
 <div class="panel">${[["sound","Звукові ефекти"],["music","Фонова музика"],["autoCollect","Автоматично збирати печатки"],["tutorials","Навчальні картки (пауза при новому ворогові чи картці)"],["reducedMotion","Менше руху та ефектів"],["highContrast","Висококонтрастний режим"],["largeText","Збільшити текст"]].map(([id,label])=>`<label class="setting-row"><strong>${label}</strong><input type="checkbox" data-setting="${id}" ${save.settings[id]?"checked":""}></label>`).join("")}
 <label class="setting-row"><strong>Гучність музики: <output data-volume-label>${save.settings.musicVolume}%</output></strong><input type="range" min="0" max="100" step="5" data-volume value="${save.settings.musicVolume}" aria-label="Гучність музики"></label>
 <p class="notice">Чотири оригінальні музичні теми світів; звук запускається після дії гравця. Можна окремо вимкнути музику і ефекти.</p>
 <p class="notice">Налаштування та прогрес зберігаються тільки у вашому браузері. Дані на сервер не передаються.</p>
 <div class="dialog-actions">${btn("back","← Назад","btn btn-dark")}${btn("tutorials-reset","↺ Показати навчальні картки знову","btn btn-quiet")}${btn("reset","🗑️ Скинути прогрес","btn btn-danger")}</div></div></main>`);
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
const introKey=item=>item.kind==="unit"?item.id:item.id==="boss"?"boss:"+(level.bossData?.id||"boss"):item.id;
function introSeen(item){return !!save.seen[item.kind==="unit"?"units":"enemies"][introKey(item)];}
function queueIntro(item){
 if(save.settings.tutorials===false||introSeen(item))return;
 if(introQueue.some(x=>x.kind===item.kind&&introKey(x)===introKey(item))||(intro&&intro.kind===item.kind&&introKey(intro)===introKey(item)))return;
 introQueue.push(item);
}
/** Called every frame: an unseen enemy type that has walked onto the board
 * (or a stationary boss part) gets its own coach card. */
function queueEnemyIntros(){
 if(!game||save.settings.tutorials===false)return;
 for(const e of game.enemies)
  if(e.hp>0&&(e.x<=8.6||e.speed===0)&&getThreat(e.id,level))queueIntro({kind:"enemy",id:e.id,uid:e.uid});
}
function showNextIntro(){
 if(modal||!introQueue.length||view!=="play")return false;
 intro=introQueue.shift();
 save.seen[intro.kind==="unit"?"units":"enemies"][introKey(intro)]=true;persist();
 if(intro.kind==="unit")selected=intro.id;
 modal="intro";render();positionIntro();
 return true;
}
function closeIntro(){
 modal="";intro=null;
 if(!showNextIntro())render();
}
function introTarget(){
 if(!intro)return null;
 if(intro.kind==="unit")return root.querySelector('.cardbar [data-unit="'+intro.id+'"]');
 return root.querySelector('.enemy-layer [data-enemy="'+intro.uid+'"]')||
  root.querySelector('.enemy-layer [data-enemy]');
}
/** Spotlight = a fixed ring with a huge shadow, so the target stays visible
 * through the dimmed overlay; the card goes above or below it. */
function positionIntro(){
 const spot=root.querySelector?.(".coach-spot"),card=root.querySelector?.(".coach-card");
 if(!spot||!card)return;
 const target=introTarget();
 target?.scrollIntoView?.({block:"nearest",inline:"center"});
 const r=target?.getBoundingClientRect();
 if(!r||!r.width){spot.hidden=true;card.style.top="50%";card.style.transform="translate(-50%,-50%)";return;}
 const pad=10;spot.hidden=false;
 Object.assign(spot.style,{left:r.left-pad+"px",top:r.top-pad+"px",width:r.width+pad*2+"px",height:r.height+pad*2+"px"});
 const h=card.offsetHeight,vh=window.innerHeight,below=r.bottom+pad+16;
 const top=below+h<=vh?below:Math.max(8,r.top-pad-16-h);
 card.style.top=top+"px";card.style.transform="translateX(-50%)";
}
function renderIntroCard(){
 const next=btn("intro-next",introQueue.length?"Далі ▶":"Зрозуміло, до бою! ▶","btn btn-primary");
 if(intro.kind==="unit"){
  const u=UNIT_BY_ID[intro.id],tool=TOOLS[u.tool];
  const strong=tool?SCHEMES_UI.filter((s,i)=>tool.multipliers[i]>=1.5).map(s=>TYPES[s].icon+" "+TYPES[s].name):[];
  const weak=tool?SCHEMES_UI.filter((s,i)=>tool.multipliers[i]<1).map(s=>TYPES[s].icon+" "+TYPES[s].name):[];
  const fact=FACTS[{registry:"registry",notary:"notary",digital:"cyber",enforcement:"debt",integrity:"corruption",expert:"expert"}[u.tool]||"general"];
  return '<div class="coach-art">'+art(u.id,"coach-illustration")+'</div><div class="eyebrow">🆕 Нова картка у вашій колоді</div><h2>'+E(u.name)+'</h2>'+
   '<p class="coach-stats"><span>🟡 '+u.cost+'</span><span>⏱ '+u.cooldown+' с</span><span>'+(tool?tool.icon+" "+E(tool.name):"Підтримка")+'</span></p>'+
   '<p class="hint"><strong>Як грає:</strong> '+E(u.desc)+'</p>'+
   (strong.length?'<p><strong>✔ Найкраще проти:</strong> '+E(strong.join(", "))+'</p>':"")+
   (weak.length?'<p><strong>✖ Слабкий проти:</strong> '+E(weak.join(", "))+'</p>':"")+
   '<p class="coach-fact"><strong>📘 Як це в житті:</strong> '+E(fact)+'</p>'+
   '<p class="muted">Натисніть картку, а потім клітинку на полі.</p><div class="dialog-actions">'+next+'</div>';
 }
 const t=getThreat(intro.id,level),info=getCounterAdvice(intro.id,{level,deck,owned:availableUnits()});
 const sprite=intro.id==="boss"?level.bossData?.id:intro.id;
 const masked=DISGUISE_TRAITS.includes(t.trait);
 const pics=masked?
  '<div class="coach-art coach-pair"><figure>'+art(sprite+"_disguised","coach-illustration")+'<figcaption>🎭 У масці: стрільці його не бачать</figcaption></figure><span class="coach-arrow">→</span><figure>'+art(sprite,"coach-illustration")+'<figcaption>Після «Сповіщення»: справжнє обличчя</figcaption></figure></div>':
  '<div class="coach-art">'+art(sprite,"coach-illustration")+'</div>';
 const states={deck:"✓ у колоді",owned:"доступний",locked:"🔒 ще не відкрито"};
 const counters=(info?.recommended||[]).slice(0,3).map(u=>'<li><strong>'+E(u.name)+'</strong> — '+states[u.state]+'</li>').join("");
 const extra=(info?.support||[]).filter(id=>UNIT_BY_ID[id]).map(id=>E(UNIT_BY_ID[id].name)).join(", ");
 return pics+'<div class="eyebrow">🆕 '+(intro.id==="boss"?"Бос наступає!":"Новий противник")+' · '+E(TYPES[t.scheme]?.icon+" "+TYPES[t.scheme]?.name)+'</div><h2>'+E(t.name)+'</h2>'+
  (info?'<p class="hint"><strong>🦉 Як діє:</strong> '+E(info.note)+'</p>':"")+
  (counters?'<p><strong>🎯 Чим зупинити:</strong></p><ul class="coach-list">'+counters+'</ul>':"")+
  (extra?'<p><strong>Допоможе також:</strong> '+extra+'</p>':"")+
  (t.tip?'<p class="coach-fact"><strong>📘 Як це в житті:</strong> '+E(t.tip)+'</p>':"")+
  '<div class="dialog-actions">'+next+'</div>';
}
function renderDialog(){
 if(!modal)return "";
 if(modal==="intro"&&intro)return '<div class="coach-overlay" role="presentation"><div class="coach-spot" aria-hidden="true"></div><div class="coach-card dialog" role="dialog" aria-modal="true" aria-label="Навчальна картка">'+renderIntroCard()+'</div></div>';
 const commonActions=`<div class="dialog-actions">${btn("close-modal","Закрити","btn btn-dark")}</div>`;
 let content="";
 if(modal==="pause")content=`<div class="large-emoji">⏸️</div><h2>Пауза</h2><p>Ваша справа чекає. Продовжуйте у зручному темпі.</p>
 <div class="dialog-actions">${btn("close-modal","▶ Продовжити","btn btn-primary")}${btn("retry","↻ Заново","btn btn-quiet")}${btn("levels","🗺️ На карту","btn btn-quiet")}</div>`;
 else if(modal==="threat")content=renderCounterModal();
 else if(modal==="detail"&&detail){
  const d=detail.kind==="unit"?UNIT_BY_ID[detail.id]:ENEMY_BY_ID[detail.id],isUnit=detail.kind==="unit";
  content=`<div class="detail-illustration">${art(d.id,"detail-art")}</div><div class="eyebrow">Альманах · ${isUnit?"Захисник":"Схемник"}</div><h2>${E(d.name)}</h2>
  <p class="hint"><strong>Як грає:</strong> ${E(isUnit?d.desc:d.tip)}</p>
  <p><strong>📘 Як це в житті</strong><br>${E(FACTS[isUnit?({registry:"registry",notary:"notary",digital:"cyber",enforcement:"debt",integrity:"corruption",expert:"expert"}[d.tool]||"general"):({forgery:"registry",cyber:"cyber",debt:"debt",corruption:"corruption",bureaucracy:"general"}[d.scheme]||"general")])}</p>
  ${!isUnit?btn("threat-tip","💡 Чим атакувати?","btn btn-primary",'data-enemy="'+E(d.id)+'"'):""}
  <p class="notice">Статус: 🟨 Не затверджено юристом · Актуальність: чернетка GDD від 15.10.2026</p>
  <a href="https://just-dnipro.gov.ua/" target="_blank" rel="noopener noreferrer">Детальніше на офіційному сайті ↗</a>${commonActions}`;
 }else if(modal==="reset")content=`<h2>Скинути прогрес?</h2><p>Усі зірки, відкриті картки й результати на цьому пристрої буде стерто.</p><div class="dialog-actions">${btn("reset-confirm","Так, скинути","btn btn-danger")}${btn("close-modal","Скасувати","btn btn-dark")}</div>`;
 else if(modal==="certificate")content=`<h2>🎓 Сертифікат правової грамотності</h2><p>Вітаємо із завершенням чотирьох світів!</p><p>Отримано зірок: <strong>${totalStars()}</strong> · ${rank()}</p>
 <p>Щоб зберегти сертифікат у PDF, скористайтеся друком браузера → «Зберегти як PDF».</p>
 <div class="dialog-actions">${btn("print","🖨️ Друкувати","btn btn-primary")}${btn("close-modal","Закрити","btn btn-dark")}</div>`;
 return `<div class="overlay" role="presentation"><div class="dialog" role="dialog" aria-modal="true" aria-label="Ігрове вікно">${content}</div></div>`;
}

/** Shared pointer/keyboard preview. The same placement rules are used by the engine,
 * so a green cell means an actually legal placement (and red cannot spend seals).
 */
function updatePlacementPreview(){
 if(view!=="play"||!game||modal)return;
 const preview=root.querySelector?.(".placement-preview");
 if(!preview)return;
 const error=availablePlacement(game,selected,focus.lane,focus.col);
 const valid=!error;
 preview.classList.toggle("preview-valid",valid);
 preview.classList.toggle("preview-invalid",!valid);
 preview.style.left=focus.col*100/9+"%";
 preview.style.top=focus.lane*20+"%";
 preview.style.width=(100/9)+"%";
 preview.style.height="20%";
 const img=preview.querySelector("img");
 const path="./assets/sprites/"+encodeURIComponent(selected)+".svg";
 if(img?.getAttribute("src")!==path)img.setAttribute("src",path);
 preview.title=valid?UNIT_BY_ID[selected]?.name||"":"Неможливо поставити: "+error;
}

function render(){
 const px=Number(window.scrollX)||0,py=Number(window.scrollY)||0;
 document.body.classList.toggle("high-contrast",!!save.settings.highContrast);
 document.body.classList.toggle("large-text",!!save.settings.largeText);
 document.body.classList.toggle("reduced-motion",!!save.settings.reducedMotion);
 let html=({home:renderHome,worlds:renderWorlds,levels:renderLevels,deck:renderDeck,play:renderPlay,result:renderResult,outro:renderOutro,almanac:renderAlmanac,settings:renderSettings,mini:renderMini}[view]||renderHome)();
 root.innerHTML=html+renderDialog();
 updatePlacementPreview();
 if(view==="play"&&py>0)window.scrollTo?.(px,py);
}
function setView(v){
 view=v;modal="";toast="";render();
 soundtrack.setScene(v==="play"?"battle":v==="outro"?"outro":"silent",world);
}
function goLevel(w,s){
 challenge=null;
 world=w;stage=s;level=getLevel(world,stage);mini=null;shownEnd=false;chooseSuggested();
 if(level.mini){startMini();setView("mini");}
 else setView("deck");
}
function startGame(){
 if(!deck.length)return;
 game=makeGame(level,deck,save.mode,{...save.settings,careerBonus:totalStars()>=35?25:0},challenge);selected=deck[0];shownEnd=false;outroElapsed=0;latestShotSound=0;lastShotSfxAt=-10;
 game.lastHint=level.tutorial||`Світ ${world+1}. Захистіть будівлю, використовуючи відповідні інструменти.`;
 introQueue=[];intro=null;
 for(const id of deck)queueIntro({kind:"unit",id});
 setView("play");
 showNextIntro();
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
 outroElapsed=0;
 soundtrack.jingle(game.phase==="won");
 setView("outro");
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
 if(name==="threat-tip"){selectedThreat=el?.dataset?.enemy||selectedThreat;modal="threat";render();return;}
 if(name==="hint"){selectedThreat=game?.enemies.find(e=>e.trait!=="neutral")?.id||getEncounterThreats(level,game)[0]||"schemer";modal="threat";render();return;}
 if(name==="pick-counter"){const id=el?.dataset?.unit;if(deck.includes(id)){selected=id;modal="";render();}return;}
 if(name==="unit"){
  const id=el.dataset.unit;
  if(view==="deck"){
   if(deck.includes(id)&&deck.length>1)deck=deck.filter(x=>x!==id);
   else if(!deck.includes(id)&&deck.length<slotLimit())deck.push(id);
  }else if(view==="play"){selected=id;syncGameFrame();return;}
  render();return;
 }
 if(name==="cell"&&view==="play"){
  focus={lane:Number(el.dataset.lane),col:Number(el.dataset.col)};
  const result=place(game,selected,focus.lane,focus.col);
  toast=result.ok?`${UNIT_BY_ID[selected].name}: додано на поле.`:result.error;
  if(result.ok)sound(540,.09);
  syncGameFrame();return;
 }
 if(name==="collect"&&game){collectToken(game,Number(el.dataset.id));sound(950,.12);toast="Отримано 25 печаток довіри!";syncGameFrame();return;}
 if(name==="guard"&&game){const ok=useGuard(game,Number(el.dataset.lane));if(ok)sound(260,.24);toast=ok?"Заборону застосовано!":"У босовій справі дочекайтеся фінальної фази.";syncGameFrame();return;}
 if(name==="speed"){speed=speed===1?2:speed===2?.5:1;const b=root.querySelector?.('[data-act="speed"]');if(b)b.textContent=speed===1?"▶ ×1":speed===2?"▶▶ ×2":"▶ ½";return;}
 if(name==="pause"){modal="pause";render();return;}
 if(name==="retry"){if(level.mini){startMini();setView("mini");}else startGame();return;}
 if(name==="next-level"){nextLevel();return;}
 if(name==="skip-outro"){setView("result");return;}
 if(name==="music-toggle"){
  save.settings.music=!save.settings.music;persist();
  soundtrack.configure(save.settings.music,save.settings.musicVolume);
  if(save.settings.music)soundtrack.unlock();
  const b=root.querySelector?.('[data-act="music-toggle"]');
  if(b){b.textContent=save.settings.music?"♫":"♪̸";b.setAttribute("aria-pressed",String(save.settings.music));}
  return;
 }
 if(name==="almanac"){modalReturn=view;setView("almanac");return;}
 if(name==="settings"){modalReturn=view;setView("settings");return;}
 if(name==="back"){
  const target=modalReturn==="play"&&game?.phase==="playing"?"play":modalReturn||"home";
  setView(target);return;
 }
 if(name==="tab-units"){almanacTab="units";render();return;}
 if(name==="tab-enemies"){almanacTab="enemies";render();return;}
 if(name==="detail"){detail={id:el.dataset.id,kind:el.dataset.kind};modal="detail";render();return;}
 if(name==="intro-next"){closeIntro();return;}
 if(name==="tutorials-reset"){save.seen={units:{},enemies:{}};persist();toast="";render();return;}
 if(name==="close-modal"){modal="";render();return;}
 if(name==="reset"){modal="reset";render();return;}
 if(name==="reset-confirm"){save=structuredClone(defaults);persist();modal="";setView("home");return;}
 if(name==="mini-choice"){miniAction(Number(el.dataset.idx));render();return;}
 if(name==="mini-retry"){startMini();render();return;}
 if(name==="certificate"){modal="certificate";render();return;}
 if(name==="print"){window.print();return;}
}
root.addEventListener("pointerover",e=>{
 const cell=e.target.closest?.(".board > .cell");
 if(view==="play"&&game&&!modal&&cell&&!cell.disabled){
  focus={lane:Number(cell.dataset.lane),col:Number(cell.dataset.col)};
  updatePlacementPreview();
 }
});
root.addEventListener("click",e=>{
 const el=e.target.closest("[data-act]");
 if(el&&!el.disabled){
  action(el.dataset.act,el);
  // The game starts audio within a trusted user event; no autoplay at page load.
  if(view==="play"&&!modal&&save.settings.music){soundtrack.unlock();soundtrack.setScene("battle",world);}
 }
});
root.addEventListener("change",e=>{
 if(e.target.matches("[data-setting]")){
  save.settings[e.target.dataset.setting]=e.target.checked;persist();
  if(game)game.settings=save.settings;
  if(e.target.dataset.setting==="music"){
   soundtrack.configure(save.settings.music,save.settings.musicVolume);
   if(save.settings.music)soundtrack.unlock();
  }
  render();
 }
 if(e.target.name==="mode"){save.mode=e.target.value;persist();}
});
root.addEventListener("input",e=>{
 if(e.target.matches("[data-volume]")){
  save.settings.musicVolume=Number(e.target.value);persist();
  soundtrack.configure(save.settings.music,save.settings.musicVolume);
  const label=root.querySelector?.("[data-volume-label]");if(label)label.textContent=e.target.value+"%";
  return;
 }
 if(e.target.id==="almanac-search"){almanacQuery=e.target.value;const pos=e.target.selectionStart;render();const n=document.getElementById("almanac-search");n?.focus();n?.setSelectionRange(pos,pos);}});
document.addEventListener("keydown",e=>{
 if(e.target instanceof HTMLInputElement)return;
 if(modal==="intro"&&["Escape","Enter"," "].includes(e.key)){closeIntro();e.preventDefault();return;}
 if(e.key==="Escape"&&modal){modal="";render();return;}
 if(view==="outro"&&["Enter","Escape"," "].includes(e.key)){setView("result");e.preventDefault();return;}
 if(view!=="play"||!game||modal)return;
 const key=e.key.toLowerCase();
 if(key==="p"){modal="pause";render();e.preventDefault();return;}
 if(/^[1-9]$/.test(key)&&deck[Number(key)-1]){selected=deck[Number(key)-1];syncGameFrame();return;}
 if(key===" "){collectAll(game);syncGameFrame();e.preventDefault();return;}
 if(key==="enter"){const result=place(game,selected,focus.lane,focus.col);toast=result.ok?"Захисника встановлено.":result.error;syncGameFrame();e.preventDefault();return;}
 const changes={arrowleft:[0,-1],arrowright:[0,1],arrowup:[-1,0],arrowdown:[1,0]};
 if(changes[key]){
  const [dr,dc]=changes[key];focus.col=Math.max(0,Math.min(8,focus.col+dc));
  focus.lane=Math.max(0,Math.min(4,focus.lane+dr));
  for(const cell of root.querySelectorAll?.(".board > .cell")||[])
   cell.classList.toggle("cursor",Number(cell.dataset.lane)===focus.lane&&Number(cell.dataset.col)===focus.col);
  updatePlacementPreview();e.preventDefault();
 }
});
document.addEventListener("visibilitychange",()=>{prevTs=0;});
window.addEventListener?.("resize",()=>{if(modal==="intro")positionIntro();});
function loop(ts){
 if(!prevTs)prevTs=ts;
 const delta=Math.min((ts-prevTs)/1000,.1);prevTs=ts;
 if(view==="play"&&game?.phase==="playing"&&!modal&&!document.hidden){
  soundtrack.setScene("battle",world,Math.min(1,game.stageWave/Math.max(1,game.maxWave)));
  // Fixed sub-steps keep collisions identical at x2 speed and on slow
  // frames (a single big tick used to be clamped and lose game time).
  let rest=delta*speed;
  while(rest>1e-6&&game.phase==="playing"){const step=Math.min(rest,1/30);tick(game,step);rest-=step;}
  if(game.phase!=="playing"){finish();}
  else{
   queueEnemyIntros();
   if(introQueue.length){syncGameFrame();showNextIntro();}
   else if(ts-lastRender>34){lastRender=ts;syncGameFrame();}
  }
 }
 if(view==="outro"&&!document.hidden){
  outroElapsed+=delta;
  if(outroElapsed>=(save.settings.reducedMotion?2.5:4))setView("result");
 }
 // Audio follows gameplay: menus, pause/help dialogs and hidden tabs never
 // continue scheduling new backing-track notes in the background.
 const audibleBattle=view==="play"&&game?.phase==="playing"&&!modal&&!document.hidden;
 soundtrack.setScene(audibleBattle?"battle":view==="outro"?"outro":"silent",world,
  audibleBattle?Math.min(1,game.stageWave/Math.max(1,game.maxWave)):0);
 soundtrack.tick();
 requestAnimationFrame(loop);
}
render();
fetch("./content/facts.uk.json",{cache:"no-cache"})
 .then(r=>{if(!r.ok)throw Error("No local facts file");return r.json();})
 .then(body=>{if(body?.entries)for(const [k,v] of Object.entries(body.entries))if(Object.hasOwn(FACTS,k)&&typeof v==="string"&&v.length<600)FACTS[k]=v;if(view==="almanac"||modal==="detail")render();})
 .catch(()=>{/* Built-in provisional facts remain available offline. */});
requestAnimationFrame(loop);
