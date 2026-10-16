import {UNITS,UNIT_BY_ID,ENEMIES,ENEMY_BY_ID,TYPES,TOOLS,SCHEMES} from "./data.js";
const cap=(n,min,max)=>Math.max(min,Math.min(max,n));
export function typeMultiplier(tool,scheme,mode="normal"){
 if(!tool||!TOOLS[tool])return 1;
 const n=TOOLS[tool].multipliers[SCHEMES.indexOf(scheme)]??1;
 return mode==="expert"&&n<1?.25:n;
}
// Wave pacing (docs/BALANCE.md). A level spends a threat budget (GDD 15.3
// threat points) instead of a head count, so a golem or a raider "costs" more
// than a schemer. The opening wave is small on purpose: it is the window in
// which building ЦНАП is a real choice rather than a guaranteed loss.
export const WAVE_SHARES={2:[.35,.65],3:[.18,.32,.5],4:[.12,.2,.28,.4]};
// Threat budget of a whole level by stage (1..10); index 9 is the boss level,
// whose boss supplies most of the pressure.
export const STAGE_BUDGET=[6,8,13,16,20,23,26,27,27,20];
export const WORLD_BUDGET=[1,.8,1.1,.85];
// Seconds before the first spawn, so the player can place 2-3 cards first.
export const FIRST_SPAWN={tutorial:8,normal:18};
// After the field is cleared the next wave is pulled forward to this lull.
export const WAVE_LULL={tutorial:3,normal:7};
export const BOSS_MIN_TIME=125;
// Hand-tuned exceptions to the stage x world curve (balance bot, novice).
// 1-4: last tutorial level, a schemer flood over five lanes plus the first
// masked broker; the stage-4 budget fits the other worlds, not this one.
export const LEVEL_BUDGET={"1-4":13};
export function levelBudget(level){
 if(LEVEL_BUDGET[level.id])return LEVEL_BUDGET[level.id];
 // Blackout halves unpowered income and fire rate; fog hides the right half
 // of the field, so shooters get roughly half the time on target.
 const special=level.special?.blackout?.8:level.special?.fog?.85:1;
 return Math.round(STAGE_BUDGET[level.stage-1]*WORLD_BUDGET[level.world]*special);
}
export function makeWavePlan(level,seed=0){
 const list=[],waves=level.waves,shares=WAVE_SHARES[waves]||WAVE_SHARES[3];
 let s=seed||level.world*1001+level.stage*211+71;
 const rand=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
 // Shuffle-bag lanes: every lane is used once before any lane repeats, so a
 // wave never piles several spawns into one lane by pure luck.
 let bag=[];
 const nextLane=()=>{
  if(!bag.length){bag=[...level.activeLanes];for(let i=bag.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
  return bag.pop();
 };
 // Lane affinity: each special threat (anything but the basic schemer) keeps
 // to two lanes per level. Counters are lane-bound, so uniform lanes forced
 // "every counter in every lane"; now the player can read and answer a lane.
 const affinity={};
 const laneFor=id=>{
  if(id==="schemer"||level.activeLanes.length<=2)return nextLane();
  if(!affinity[id]){
   const lanes=[...level.activeLanes];
   const a=lanes.splice(Math.floor(rand()*lanes.length),1)[0];
   affinity[id]={lanes:[a,lanes[Math.floor(rand()*lanes.length)]],n:0};
  }
  const pick=affinity[id];return pick.lanes[pick.n++%2];
 };
 const tutorial=level.world===0&&level.stage<=4;
 const intro=tutorial?["schemer","schemer","poa","broker"][level.stage-1]:null;
 const pool=tutorial?[...new Set(["schemer",intro])]:level.enemies;
 const newest=pool[pool.length-1];
 const cost=id=>id==="usb"&&level.stage>=7?3:(ENEMY_BY_ID[id]?.threat||1);
 const total=levelBudget(level);
 let t=level.stage===1?FIRST_SPAWN.tutorial:FIRST_SPAWN.normal,carry=0;
 for(let w=0;w<waves;w++){
  const final=w===waves-1;
  let budget=Math.max(1,Math.round(total*shares[w]))+carry;carry=0;
  const ids=[];
  // The level's newest threat opens wave 2 alone, once the economy is up.
  // If it costs more than the wave's share, the overdraft comes out of the
  // next wave (otherwise wave 2 became a schemer flood over every lane).
  if(w===Math.min(1,waves-1)&&newest!=="schemer"&&newest!=="golem"){
   ids.push(newest);budget-=cost(newest);
   if(budget<0){carry=budget;budget=0;}
  }
  let guard=0;
  while(budget>0&&guard++<40){
   // The opening wave never demands a specialised counter (threat <= 2).
   let choices=pool.filter(id=>cost(id)<=budget&&(w>0||cost(id)<=2)&&(id!=="golem"||final&&!ids.includes("golem")));
   if(tutorial)choices=choices.filter(id=>id==="schemer"||ids.length%3===0);
   if(!choices.length)choices=["schemer"];
   const id=choices[Math.floor(rand()*choices.length)];
   ids.push(id);budget-=cost(id);
  }
  const spacing=level.stage===1?4:final?2.4:3.4;
  ids.forEach((id,i)=>list.push({time:t+i*spacing,id,lane:laneFor(id),wave:w+1}));
  const last=t+(ids.length-1)*spacing;
  if(final){
   // Bosses walk the centre lane: the Count's safes (0,1,3,4) and the Hydra's
   // heads (1-3) are laid out around it, and the player can prepare it.
   // A boss never arrives before BOSS_MIN_TIME: a lighter escort must not
   // also mean less time to build the economy for the fight itself.
   if(level.boss)list.push({time:Math.max(last+10,BOSS_MIN_TIME),id:"boss",lane:level.activeLanes.includes(2)?2:level.activeLanes[Math.floor(rand()*level.activeLanes.length)],wave:waves});
   if(level.id==="3-5")list.push({time:last+6,id:"mini_boss",lane:2,wave:waves});
  }
  // Scheduled gap; tick() pulls it in once the field is clear.
  t=last+(level.stage===1?14:24);
 }
 return list.sort((a,b)=>a.time-b.time);
}
/** Seconds until the next wave starts, or null while a wave is in progress. */
export function nextWaveIn(g){
 const next=g.plan[g.spawned];
 if(!next||next.wave<=g.stageWave)return null;
 return Math.max(0,next.time-g.time);
}
export function waveStatus(g){
 const left=nextWaveIn(g);
 const base="Хвиля "+g.stageWave+"/"+g.maxWave;
 if(left==null||left<1)return base;
 return base+" · "+(g.stageWave?"наступна":"перша")+" через "+Math.ceil(left)+" с";
}
export function makeGame(level,deck,mode="normal",settings={},challenge=null){
 const game={
  level,deck:[...deck],mode,settings,challenge,phase:"playing",time:0,elapsed:0,seal:(mode==="young"?300:level.startingSeals)+(settings.careerBonus||0),
  defenders:[],enemies:[],tokens:[],locks:[],effects:[],projectiles:[],particles:[],fallen:[],rollers:[],squashed:[],plan:makeWavePlan(level),
  spawned:0,serial:1,nextSky:7,cooldowns:Object.fromEntries(deck.map(id=>[id,0])),
  usedGuards:[false,false,false,false,false],breaches:0,defenderLosses:0,created:0,kills:0,
  stageWave:0,maxWave:level.waves,bossGuardReady:false,bossGuardUsed:false,
  lastThreat:null,lastHint:level.tutorial||"Підбирайте інструменти до типу правової загрози.",
  miniBonus:0
 };
 if(challenge?.kind==="daily")game.plan=makeWavePlan(level,challenge.seed);
 if(challenge?.kind==="endless"){
  game.plan=[];game.maxWave=1;queueEndlessWave(game,1);
 }
 return game;
}
export function queueEndlessWave(game,n){
 // Density follows the GDD's B(n) growth while preserving a mobile-safe spawn cap.
 const danger=Math.floor(4+3*n+.6*n*n);
 const amount=Math.min(34,danger);
 const pool=ENEMIES.filter(e=>e.trait!=="neutral"&&e.trait!=="giant"&&e.id!=="queue"&&e.threat<=2+Math.floor(n/2));
 const choices=pool.length?pool:[ENEMY_BY_ID.schemer];
 const start=(game.plan.length?game.plan[game.plan.length-1].time+20:12);
 let seed=(game.challenge?.seed||2026)+n*7919;
 function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 for(let i=0;i<amount;i++){
  const enemy=choices[Math.floor(random()*choices.length)];
  game.plan.push({time:start+i*(n>7?1.05:1.8),id:enemy.id,lane:Math.floor(random()*5),wave:n});
 }
 game.maxWave=n;
 return amount;
}
const uid=g=>g.serial++;
function effect(g,kind,lane,x,text="",ttl=.7){g.effects.push({id:uid(g),kind,lane,x,ttl,text});if(g.effects.length>35)g.effects.shift();}
export function spawn(g,id,lane,x=9.3){
 const parts={
  offshore_safe:{name:"Сейф-офшор",icon:"🔒",scheme:"debt",hp:800,speed:0,trait:"offshore_safe",tip:"Сховані активи потребують виявлення."},
  tentacle:{name:"Щупальце підкупу",icon:"🐙",scheme:"corruption",hp:1500,speed:0,trait:"tentacle",tip:"Запобігання корупції потребує перевірки."},
  hydra_phish:{name:"Голова фішингу",icon:"🎣",scheme:"cyber",hp:HYDRA_HEAD_HP,speed:0,trait:"hydra_head",tip:"Перевіряйте посилання."},
  hydra_call:{name:"Голова дзвінків",icon:"☎️",scheme:"cyber",hp:HYDRA_HEAD_HP,speed:0,trait:"hydra_head",tip:"Не розголошуйте коди по телефону."},
  hydra_malware:{name:"Голова шкідливого ПЗ",icon:"💾",scheme:"cyber",hp:HYDRA_HEAD_HP,speed:0,trait:"hydra_head",tip:"Невідомі носії небезпечні."}
 };
 let data=parts[id]|| (id==="boss"?g.level.bossData:id==="mini_boss"?{name:"Липовий експерт",icon:"🥼",scheme:"bureaucracy",hp:2500,speed:.6,trait:"mini_boss",tip:"Перевіряйте кваліфікацію експертів у визначених законом реєстрах."}:ENEMY_BY_ID[id]); if(!data)return null;
 const hpMod=g.mode==="young"?.6:g.mode==="expert"?1.3:1;
 const enemy={uid:uid(g),id,name:data.name,icon:data.icon,scheme:data.scheme,
 hp:data.hp*hpMod,maxHp:data.hp*hpMod,shield:data.shield||0,maxShield:data.shield||0,
 speed:(data.speed??.28)*(g.mode==="young"?.6:g.mode==="expert"?1.15:1),lane,x,
 trait:data.trait||(id==="boss"?"boss":"basic"),reveal:!["disguised_jump","disguised_split"].includes(data.trait),
 frozenUntil:0,stunUntil:0,specialUntil:0,contactTime:0,jumped:false,revived:false,
 spawnedMinions:false,lastHitTool:null,phase:1,tip:data.tip,air:id==="bankrupt"||id==="boss"&&g.level.world===1&&false};
 if(id==="boss"&&g.level.world===3){enemy.hp=HYDRA_BODY_HP*hpMod;enemy.maxHp=HYDRA_BODY_HP*hpMod;}
 if(id==="offshore_safe"){enemy.reveal=false;enemy.revealAt=g.time+SAFE_AUTO_REVEAL;}
 g.enemies.push(enemy);g.lastThreat=enemy;effect(g,"spawn",lane,x,"!");
 if(id==="boss"&&g.level.world===1){
  for(const l of [0,1,3,4])spawn(g,"offshore_safe",l,7.0);
  g.lastHint="Граф сховав активи! Державний виконавець допоможе знайти сейфи.";
 }
 if(id==="boss"&&g.level.world===2){
  for(let l=0;l<5;l++)spawn(g,"tentacle",l,8.0);
  g.lastHint="Спрут тримається щупальцями! Викривач поряд із ними знищує кілька одразу.";
 }
 if(id==="boss"&&g.level.world===3){
  for(const [part,l] of [["hydra_phish",1],["hydra_call",2],["hydra_malware",3]])spawn(g,part,l,7.5);
  g.lastHint="Три голови Гідри знищуються назавжди тільки цифровим інструментом.";
 }
 return enemy;
}
function createToken(g,lane,col){
 g.tokens.push({uid:uid(g),lane:cap(lane,0,4),col:cap(col,0,8),ttl:11,value:25});
 if(g.settings.autoCollect)collectToken(g,g.tokens[g.tokens.length-1].uid);
}
export function collectToken(g,id){
 const index=g.tokens.findIndex(t=>t.uid===id);if(index<0)return false;
 g.seal+=g.tokens[index].value;g.tokens.splice(index,1);g.missStreak=0;return true;
}
// Owl coaching: two seals in a row that faded away uncollected (the balance
// bot's novice loses ~30 % of income this way) earn a reminder.
export const MISSED_SEAL_HINT="Збирай печатки! Клацни на золоту ✦, поки вона не зникла: без печаток не буде нових захисників.";
const MISSED_HINT_AFTER=2,MISSED_HINT_COOLDOWN=30;
function missedToken(g){
 g.missedTokens=(g.missedTokens||0)+1;g.missStreak=(g.missStreak||0)+1;
 if(g.missStreak>=MISSED_HINT_AFTER&&g.time-(g.missedHintAt??-1e9)>=MISSED_HINT_COOLDOWN){
  g.missedHintAt=g.time;g.missStreak=0;g.lastHint=MISSED_SEAL_HINT;
 }
}
export function collectAll(g){for(const token of [...g.tokens])collectToken(g,token.uid);}
const same=(a,b)=>a.lane===b.lane&&a.col===b.col;
// Distance from a defender's centre at which a walking enemy stops and bites.
// Every contact effect (mine, seize, smash, trap) must use this same reach,
// otherwise an enemy can stand in front of a unit that never "feels" it.
export const CONTACT=.65;
// Boss reinforcements; 13 s buried the boss lane under escorts faster than
// the lane's shooters could reach the boss itself.
const BOSS_SUMMON_EVERY=16,BOSS_ESCORT_CAP=3,SAFE_AUTO_REVEAL=20;
// Hydra (body 8000, heads 2000, 25-seal wallet drain every 12 s) took a novice
// ~4 min per head and ate ~40 % of their income; malware head drops 2 USBs.
const HYDRA_HEAD_HP=1000,HYDRA_BODY_HP=6000;
const SEIZE_TIME=2.5,GIANT_WINDUP=1.2,GIANT_SMASH_EVERY=1.8,JUMP_TIME=.7;
// Bosses and their stationary parts are never removed by a lane guard.
const GUARD_IMMUNE=new Set(["offshore_safe","tentacle","hydra_head"]);
const isGuardImmune=e=>e.id==="boss"||GUARD_IMMUNE.has(e.trait);
/** True while a boss cannot take damage because its parts are alive. */
function bossImmune(g,e){
 if(e.id!=="boss")return false;
 if(g.level.world===1)return g.enemies.some(x=>x.id==="offshore_safe"&&x.hp>0);
 if(g.level.world===3)return g.enemies.some(x=>x.trait==="hydra_head"&&x.hp>0);
 return false;
}
/** Bosses that hold their position: the Octopus while any tentacle grips the
 * field; the Count hovers on his "assets" in phase 2 (GDD) and only runs in
 * phase 3. Flying forward over every defender made phase 2 unwinnable. */
function bossAnchored(g,e){
 if(e.id!=="boss")return false;
 if(g.level.world===1)return e.phase===2;
 return g.level.world===2&&g.enemies.some(x=>x.id==="tentacle"&&x.hp>0);
}
function at(g,lane,col){return g.defenders.find(d=>d.lane===lane&&d.col===col&&d.hp>0);}
/** Units that physically stop walking enemies. 2FA is a floor trap: enemies
 * walk over it and take damage instead of chewing through it. */
function blocksPath(d){return d.hp>0&&d.kind!=="trap";}
/** Keep a minion spawned in another lane from appearing behind that lane's
 * defenders (it would look like it walked straight through them). */
function frontOfDefenders(g,lane,x){
 const passed=g.defenders.filter(d=>d.lane===lane&&blocksPath(d)&&d.col+.5-CONTACT>x);
 if(!passed.length)return x;
 return Math.max(...passed.map(d=>d.col+.5+CONTACT-.02));
}
function isProtected(g,d){return !!d.shieldHp||g.defenders.some(other=>other.kind==="integrity"&&Math.abs(other.lane-d.lane)<=1&&Math.abs(other.col-d.col)<=1);}
// 2FA lives on the phone, not on the mains: a blackout does not slow it.
function powered(g,d){return !g.level.special.blackout||d.kind==="power"||d.kind==="trap"||g.defenders.some(o=>o.kind==="power"&&Math.abs(o.col-d.col)<=1&&Math.abs(o.lane-d.lane)<=1);}
function revealInRange(g,e){
 return g.defenders.some(d=>d.kind==="reveal"&&Math.abs(d.lane-e.lane)<=2&&Math.abs(d.col+.5-e.x)<=2.5);
}
export function canTarget(g,d,e){
 if(e.hp<=0)return false;
 if(e.id==="offshore_safe"&&!e.reveal)return false;
 if(e.trait==="neutral")return false;
 // The flying Count stays a target for everyone (x0.2 unless enforcement or
 // expert, see damageEnemy): a hard lock wiped out every phase-1 investment
 // in his lane, and there is no way to clear cells for new cards.
 if((e.trait==="flying"||e.air&&e.id!=="boss")&&!["air","sniper","global"].includes(d.kind))return false;
 if(e.trait==="burrow"&&!["lobber","mine"].includes(d.kind))return false;
 if(!e.reveal && d.kind!=="sniper" && !revealInRange(g,e))return false;
 if(g.level.special.fog&&e.x>5.5&&!revealInRange(g,e)&&d.kind!=="sniper")return false;
 if(e.id==="hacker"&&d.tool==="notary")return false;
 return true;
}

/** Explain a ranged defender's firing status without affecting simulation.
 * Presented in the tile tooltip so "not shooting" has a discoverable reason.
 */
export function explainFiring(g,d){
 if(!d||!["shooter","intern","lobber","splash","air","slow","sniper","global"].includes(d.kind))return "";
 if(g.time<d.disabledUntil)return "Не стріляє: тимчасово заблоковано здібністю противника.";
 if(g.time<d.confusedUntil)return "Не стріляє: захисника дезорієнтовано.";
 let nearby=g.enemies.filter(e=>e.hp>0);
 if(["shooter","intern","lobber","splash","air","slow"].includes(d.kind)){
  const inRow=nearby.filter(e=>e.lane===d.lane);
  nearby=inRow.filter(e=>e.x>d.col+.02);
  if(!nearby.length)return inRow.length?
   "Вороги вже позаду захисника: він стріляє тільки праворуч.":
   "Очікує на ворогів у своєму ряду.";
 }
 if(d.kind==="sniper")nearby=nearby.filter(e=>Math.abs(e.x-(d.col+.5))<=3.5);
 if(!nearby.length)return "Цілі поза зоною досяжності.";
 if(nearby.some(e=>canTarget(g,d,e)))return g.time-(d.lastShotAt??-20)<.38?
  "Постріл виконано: снаряд летить до цілі.":"Ціль є, захисник готовий до атаки.";
 if(nearby.every(e=>e.trait==="flying"||e.air&&e.id!=="boss"))return "Не вражає повітряні цілі: потрібні спеціальні захисники.";
 if(nearby.every(e=>e.trait==="burrow"))return "Ціль під землею: потрібен виконавець або арешт майна.";
 if(g.level.special.fog&&nearby.every(e=>e.x>5.5))return "Туман приховує противника: потрібне виявлення або зближення.";
 if(nearby.some(e=>!e.reveal))return "Замаскована ціль: спершу використайте Сповіщення.";
 return "Цю ціль не можна атакувати вибраним інструментом.";
}

export function availablePlacement(g,id,lane,col){
 const u=UNIT_BY_ID[id];if(!u||!g.deck.includes(id))return "Картка не у вашій колоді.";
 if(g.phase!=="playing")return "Гру завершено.";
 if(lane<0||lane>4||col<0||col>8||!g.level.activeLanes.includes(lane))return "Ця доріжка закрита.";
 if((g.cooldowns[id]||0)>0)return "Картка ще відновлюється.";
 if(g.seal<u.cost)return "Недостатньо печаток довіри.";
 const current=at(g,lane,col);
 const locked=g.locks.some(l=>l.lane===lane&&l.col===col);
 if(u.kind==="restore")return locked?null:"Потрібна клітинка з фальшивим записом.";
 if(locked)return "Скасувати фальшивий запис може Комісія зі скарг.";
 if(u.kind==="shield")return current&&!current.shieldHp?null:"Оберіть незахищеного захисника.";
 if(u.kind==="upgrade")return current?.id==="cnap"?null:"Цифровий офіс ставлять на ЦНАП.";
 if(current && !["blast","sweep"].includes(u.kind))return "Клітинка вже зайнята.";
 return null;
}
export function place(g,id,lane,col){
 const error=availablePlacement(g,id,lane,col);
 if(error)return {ok:false,error};
 const u=UNIT_BY_ID[id];g.seal-=u.cost;g.cooldowns[id]=u.cooldown;g.created++;
 if(u.kind==="restore"){
  const index=g.locks.findIndex(l=>l.lane===lane&&l.col===col);
  const lock=g.locks.splice(index,1)[0];
  if(lock?.lost){
   const past=UNIT_BY_ID[lock.lost.id];g.defenders.push({...lock.lost,uid:uid(g),hp:past.hp*.5,shieldHp:0});
  }
  effect(g,"restore",lane,col+.5,"СКАРГУ ЗАДОВОЛЕНО");return {ok:true};
 }
 if(u.kind==="shield"){
  at(g,lane,col).shieldHp=u.hp;effect(g,"shield",lane,col+.5,"КЕП");return {ok:true};
 }
 if(u.kind==="upgrade"){
  const prior=at(g,lane,col);prior.id=u.id;prior.kind=u.kind;prior.icon=u.icon;prior.name=u.name;
  prior.hp=u.hp;prior.maxHp=u.hp;prior.timer=0;return {ok:true};
 }
 if(u.kind==="blast"){
  for(const e of [...g.enemies])if(Math.abs(e.lane-lane)<=2&&Math.abs(e.x-(col+.5))<=2.5){
   if(e.scheme==="corruption")damageEnemy(g,e,1500,"integrity");else e.stunUntil=g.time+3;
  }
  effect(g,"blast",lane,col+.5,"ВИКРИТО");emitBurst(g,"blast",lane,col+.5,13);return {ok:true};
 }
 if(u.kind==="sweep"){
  for(const e of [...g.enemies])if(e.lane===lane){
   if(e.trait==="neutral"){g.seal+=50;removeEnemy(g,e,true);}else damageEnemy(g,e,1800,null);
  }
  effect(g,"sweep",lane,col+.5,"ПРАВНИЧА ДОПОМОГА");emitBurst(g,"sweep",lane,col+.5,12);return {ok:true};
 }
 g.defenders.push({uid:uid(g),id,name:u.name,icon:u.icon,kind:u.kind,tool:u.tool,lane,col,
 hp:u.hp,maxHp:u.hp,shieldHp:0,timer:0,placedAt:g.time,disabledUntil:0,confusedUntil:0,lastShotAt:-10});
 effect(g,"plant",lane,col+.5,"+");
 return {ok:true};
}

/** Short lived fallen-defender ghosts let players see *where* a unit was destroyed.
 * They are cosmetic, bounded and never affect hit detection.
 */
export function removeDefender(g,d,reason="down"){
 const idx=g.defenders.indexOf(d);
 if(idx<0)return false;
 g.defenders.splice(idx,1);g.defenderLosses++;
 if(!g.settings.reducedMotion){
  g.fallen.push({uid:uid(g),id:d.id,lane:d.lane,col:d.col,ttl:.75,age:0,reason});
  if(g.fallen.length>25)g.fallen.shift();
 }
 effect(g,reason,d.lane,d.col+.5,reason==="seize"?"ЗАХОПЛЕНО":"ЗАХИСНИК ВИБУВ");
 emitBurst(g,"paper",d.lane,d.col+.5,11);
 return true;
}
export function advanceFallen(g,dt){
 for(let i=g.fallen.length-1;i>=0;i--){
  g.fallen[i].age+=dt;
  if(g.fallen[i].age>=g.fallen[i].ttl)g.fallen.splice(i,1);
 }
}

function removeEnemy(g,e,silent=false){
 const idx=g.enemies.indexOf(e);if(idx>=0)g.enemies.splice(idx,1);
 if(!silent){
  g.kills++;
  effect(g,"hit",e.lane,e.x,e.id==="boss"?"СХЕМУ ЗУПИНЕНО":"АНУЛЬОВАНО");
  emitBurst(g,e.scheme,e.lane,e.x,e.id==="boss"?14:8);
 }
 g.locks=g.locks.filter(l=>l.enemyUid!==e.uid);
 if(e.id==="boss"&&g.level.world===3&&!g.finalSurvivalUntil){
  g.finalSurvivalUntil=g.time+30;g.nextSurvivalSpawn=g.time+2;
  g.lastHint="Перезавантаження реєстрів: протримайтесь іще 30 секунд!";
 }
}
/** Remove a disguise (Сповіщення in range or an expert's beam). The renderer
 * swaps the masked sprite for the real one; a fake heir calls in "witnesses". */
export function unmask(g,e){
 if(e.reveal||!["disguised_jump","disguised_split"].includes(e.trait))return false;
 e.reveal=true;e.unmaskedAt=g.time;
 effect(g,"unmask",e.lane,e.x,"МАСКУ ЗІРВАНО!",1.1);
 emitBurst(g,"paper",e.lane,e.x,10);
 if(e.trait==="disguised_split"&&!e.spawnedMinions){
  e.spawnedMinions=true;
  for(let k=0;k<2;k++)spawn(g,"schemer",e.lane,e.x+.15*k);
 }
 return true;
}
export function damageEnemy(g,e,raw,tool=null,extra=1){
 if(!g.enemies.includes(e))return 0;
 let mult=typeMultiplier(tool,e.scheme,g.mode);
 if(e.id==="boss"){
  // GDD: the Octopus head takes x0.25 only while a tentacle lives. A
  // permanent x0.5 for non-integrity tools (there is no integrity shooter)
  // left an 18 000 HP head practically unkillable.
  if(g.level.world===2&&g.enemies.some(x=>x.id==="tentacle"&&x.hp>0))mult*=.25;
  if(g.level.world===1&&g.enemies.some(x=>x.id==="offshore_safe"&&x.hp>0))mult=0;
  if(g.level.world===3&&g.enemies.some(x=>x.trait==="hydra_head"&&x.hp>0))mult=0;
  if(g.level.world===1&&e.phase===2&&!["enforcement","expert"].includes(tool))mult*=.2;
  // (No extra x0.25 for the Hydra body: the heads already teach "use 2FA",
  // and the stacked penalty left the walking body nearly unkillable.)
  if(g.level.world===0&&e.hp<=e.maxHp*.35&&!g.bossGuardUsed)mult=0;
 }
 if(e.id==="mini_boss"&&tool!=="expert")mult=Math.min(mult,.5);
 if(e.id==="tentacle"&&tool!=="integrity")mult*=.5;
 let n=Math.max(0,raw*mult*extra);
 if(e.shield>0 && tool!=="enforcement"){
  const absorbed=Math.min(e.shield,n);
  e.shield-=absorbed;n-=absorbed;
  if(absorbed>0){
   // The projectile hit; the visible shield consumed it. Do not make this
   // look like a mysterious missed shot to the player.
   effect(g,"shield-impact",e.lane,e.x,"🛡",.42);
   emitBurst(g,"shield",e.lane,e.x,4);
  }
 }
 if(e.trait==="hydra_head"&&tool!=="digital"){
  // Ordinary weapons can only exhaust a head (down to 1 HP); 2FA must finish
  // it. Previously automatic shooters kept finishing heads, each regrew
  // twice and the final boss could become an endless loop.
  // Any weapon wears a head down at full strength (no x0.5 cyber penalty):
  // the lesson is "finish with 2FA", not "out-damage the resistance".
  if(mult>0&&mult<1)n/=mult;
  n=Math.min(n,Math.max(0,e.hp-1));
  if(e.hp-n<=1&&!e.exhausted){
   e.exhausted=true;
   g.lastHint="Голову Гідри виснажено! Добийте її 2FA: поставте її будь-де в ряду голови.";
   effect(g,"exhausted",e.lane,e.x,"ДОБИЙТЕ 2FA",1.2);
  }
 }
 e.hp-=n;e.lastHitTool=tool;if(n>0)e.lastHitAt=g.time;
 if(n>0&&Math.random()<.24)effect(g,"damage",e.lane,e.x,mult>=1.5?"✔ ×"+mult:mult<1?"×"+mult:"");
 if(n===0&&raw>0&&e.id==="boss"&&g.time-(e.lastImmuneAt??-99)>1.1){
  e.lastImmuneAt=g.time;
  effect(g,"immune",e.lane,e.x,"ЗАХИСТ",.55);
 }
 if(e.id==="boss"){
  const prev=e.phase;e.phase=e.hp>e.maxHp*.7?1:e.hp>e.maxHp*.35?2:3;
  if(e.phase!==prev){
   if(g.level.world===1){e.air=e.phase===2;if(e.phase===3)e.speed=.58;}
   g.lastHint=`⚠️ ${e.name}: фаза ${e.phase}. Змінюйте тактику!`;
   if(g.level.world===1&&e.phase===2)g.lastHint="Граф злетів на «Активах»! Виконавчі інструменти б'ють на повну, решта — ледь-ледь. Фіктивних банкрутів збиває Арбітражний керуючий.";
   if(g.level.world===1&&e.phase===3)g.lastHint="Граф тікає! «Обмеження боржника» зупиняє його, «Арешт майна» — сильний удар.";
   effect(g,"phase",e.lane,e.x,"ФАЗА "+e.phase);
   if(e.phase===3&&g.level.world===0){g.bossGuardReady=true;g.lastHint="Барон готує фінальний підпис! Натисніть 🛑 біля його доріжки."; }
  }
 }
 if(e.hp>0)return n;
 if(e.trait==="revive"&&!e.revived&&tool!=="integrity"){
  e.revived=true;e.hp=e.maxHp*.5;effect(g,"revive",e.lane,e.x,"ПОВЕРНУВСЯ");return n;
 }
 if(e.trait==="split"&&!e.spawnedMinions){
  e.spawnedMinions=true;
  for(const lane of [e.lane-1,e.lane+1])if(g.level.activeLanes.includes(lane))spawn(g,"schemer",lane,frontOfDefenders(g,lane,e.x));
 }
 if(e.trait==="disguised_split"&&!e.spawnedMinions){
  for(let j=0;j<2;j++)spawn(g,"schemer",e.lane,e.x+(.2*j));
 }
 if(e.id==="bankrupt")createToken(g,e.lane,Math.floor(e.x));
 removeEnemy(g,e);
 return n;
}
export function useGuard(g,lane,automatic=false){
 if(g.phase!=="playing"||!g.level.activeLanes.includes(lane))return false;
 if(!automatic){
  // The Baron's final "Заборона" is a separate, one-off action. It must stay
  // available even if an ordinary breach already spent this lane's guard,
  // otherwise a random boss lane could make the level unwinnable.
  if(!(g.level.boss&&g.level.world===0)||g.bossGuardUsed)return false;
  const boss=g.enemies.find(e=>e.id==="boss"&&e.lane===lane);
  if(!boss||boss.phase<3)return false;
  g.bossGuardUsed=true;damageEnemy(g,boss,boss.maxHp,"registry",3);
 }else if(g.usedGuards[lane])return false;
 g.usedGuards[lane]=true;
 // Whoever is at the door goes at once (otherwise it breaches again next
 // tick); the rest of the lane is annulled as the roller reaches them.
 for(const e of [...g.enemies])if(e.lane===lane&&!isGuardImmune(e)&&e.x<=ROLLER_REACH)squash(g,e);
 (g.rollers??=[]).push({uid:uid(g),lane,x:0,age:0,done:false,doneAge:0});
 effect(g,"guard",lane,.7,"ЗАБОРОНА!",1.2);emitBurst(g,"guard",lane,.4,11);
 return true;
}
// Lane guard = PvZ lawnmower: a "ЗАБОРОНЕНО" stamp roller runs the lane once
// and annuls every non-boss threat it rolls over, leaving a red imprint.
export const ROLLER_SPEED=4.2,ROLLER_REACH=.4,ROLLER_FADE=1.8;
function squash(g,e){
 if(!g.settings?.reducedMotion){
  (g.squashed??=[]).push({uid:uid(g),enemy:{id:e.id,trait:e.trait,reveal:e.reveal,scheme:e.scheme},lane:e.lane,x:e.x,age:0,ttl:.7});
  if(g.squashed.length>30)g.squashed.shift();
 }
 removeEnemy(g,e);
}
export function advanceRollers(g,delta){
 if(!g.rollers?.length&&!g.squashed?.length)return;
 for(let i=g.rollers.length-1;i>=0;i--){
  const r=g.rollers[i];r.age+=delta;
  if(r.done){r.doneAge+=delta;if(r.doneAge>=ROLLER_FADE)g.rollers.splice(i,1);continue;}
  r.x=Math.min(9.6,r.x+ROLLER_SPEED*delta);
  for(const e of [...g.enemies])if(e.lane===r.lane&&!isGuardImmune(e)&&e.x<=r.x+ROLLER_REACH)squash(g,e);
  if(r.x>=9.6)r.done=true;
 }
 for(let i=g.squashed.length-1;i>=0;i--){g.squashed[i].age+=delta;if(g.squashed[i].age>=g.squashed[i].ttl)g.squashed.splice(i,1);}
}


/** Lightweight, deterministic and purely decorative particles.
 * A cap and reduced-motion flag avoid unbounded DOM work in endless mode.
 */
export function emitBurst(g,kind,lane,x,count=6){
 if(g.settings?.reducedMotion)return;
 const palette={stamp:"ink",chain:"ice",writ:"paper",dossier:"paper",clip:"spark",dove:"gold",beam:"cyan",shield:"cyan",mine:"gold",guard:"gold",blast:"spark",sweep:"paper",forgery:"paper",cyber:"cyan",debt:"gold",corruption:"paper",bureaucracy:"ink"};
 const variant=palette[kind]||"ink";
 const amount=Math.min(14,Math.max(0,count));
 for(let i=0;i<amount;i++){
  const angle=(i+.5)*Math.PI*2/amount+(g.serial%7)*.13;
  const speed=.55+(i%4)*.28;
  g.particles.push({uid:uid(g),kind:variant,x,row:lane+.5,vx:Math.cos(angle)*speed,
    vy:Math.sin(angle)*speed-.24,age:0,ttl:.3+(i%4)*.07,spin:(i%2?1:-1)*(i+1)*65});
 }
 if(g.particles.length>115)g.particles.splice(0,g.particles.length-115);
}
export function advanceParticles(g,delta){
 for(let i=g.particles.length-1;i>=0;i--){
  const p=g.particles[i];
  p.age+=delta;
  if(p.age>=p.ttl){g.particles.splice(i,1);continue;}
  p.x+=p.vx*delta;
  p.row+=(p.vy+p.age*2.1)*delta;
 }
}

const SHOT_STYLES={
 shooter:{kind:"stamp",speed:6.8,arc:0},
 intern:{kind:"stamp",speed:5.8,arc:0},
 air:{kind:"clip",speed:6.5,arc:0},
 slow:{kind:"chain",speed:6,arc:0},
 lobber:{kind:"writ",speed:4.4,arc:.95},
 splash:{kind:"dossier",speed:3.7,arc:1.2},
 global:{kind:"dove",speed:4,arc:1.65},
 sniper:{kind:"beam",speed:100,arc:0}
};
const pSource=p=>({kind:p.sourceKind,tool:p.tool});
/** Each projectile has a simulation-space position (grid columns; fractional row).
 * Hit detection is resolved on impact rather than at firing time.
 * No renderer or DOM dependencies are needed for testing.
 */
export function fireProjectile(g,d,target,raw,bonus=1){
 const style=SHOT_STYLES[d.kind]||SHOT_STYLES.shooter;
 // The launch point must be behind every target allowed by attack() (x > col+.45).
 // A shot from col+.78 silently missed enemies pressed against the defender.
 // Spawn the shot behind the actual target, even when an enemy is pressed
 // against the defender. A fixed launch point could put the projectile ahead
 // of a close target and produce apparently random non-firing.
 const targetX=target.x,sourceX=style.arc>0?d.col+.4:Math.min(d.col+.4,targetX-.22),
  fromRow=d.lane+.5,toRow=target.lane+.5;
 const ballistic=style.arc>0;
 const shot={
  uid:uid(g),kind:style.kind,sourceKind:d.kind,sourceUid:d.uid,
  lane:d.lane,tool:d.tool,damage:raw,bonus,targetUid:target.uid,
  // Straight shots only travel forward: never hit an enemy behind the shooter.
  minX:d.col+.02,
  x:sourceX,row:fromRow,startX:sourceX,startRow:fromRow,
  endX:targetX,endRow:toRow,age:0,
  duration:ballistic?Math.max(.5,Math.min(1.5,Math.hypot(targetX-sourceX,(toRow-fromRow)*1.25)/style.speed)):
   Math.max(.18,(targetX-sourceX)/style.speed),
  speed:style.speed,arc:style.arc,ballistic,
  cosmetic:style.kind==="beam", launchedAt:g.time
 };
 if(shot.cosmetic){
  // A laser scan affects the enemy instantly; the visible beam is brief.
  shot.duration=.2;
  // The beam never reaches hitProjectile(), so unmask here (the expert's
  // "removes disguise on hit" never actually fired before).
  if(d.kind==="sniper")unmask(g,target);
  damageEnemy(g,target,raw,d.tool,bonus);
  effect(g,"scan",target.lane,target.x,"ЕКСПЕРТИЗА");
 }
 g.projectiles.push(shot);
 // A modest ceiling protects low-end mobile browsers during endless mode.
 if(g.projectiles.length>160)g.projectiles.splice(0,g.projectiles.length-160);
 d.lastShotAt=g.time;d.shotsFired=(d.shotsFired||0)+1;
 effect(g,"muzzle",d.lane,sourceX,"");
 emitBurst(g,style.kind,d.lane,sourceX,3);
 return shot;
}
function hitProjectile(g,p,e){
 if(!g.enemies.includes(e))return;
 if(p.sourceKind==="slow"){
  e.frozenUntil=Math.max(e.frozenUntil,g.time+(e.scheme==="debt"?3:6));
  e.stunUntil=Math.max(e.stunUntil,e.scheme==="debt"?g.time+3:e.stunUntil);
 }
 if(p.sourceKind==="sniper")unmask(g,e);
 if(p.sourceKind==="splash"){
  for(const other of [...g.enemies])
   if(Math.abs(other.lane-e.lane)<=1&&Math.abs(other.x-e.x)<=1.25)
    damageEnemy(g,other,p.damage,p.tool,p.bonus);
 }else damageEnemy(g,e,p.damage,p.tool,p.bonus);
 const word=p.kind==="chain"?"ОБМЕЖЕНО":p.kind==="clip"?"АКТИВИ":p.kind==="dossier"?"ПОСТАНОВА":"";
 effect(g,"impact-"+p.kind,e.lane,e.x,word);
 emitBurst(g,p.kind,e.lane,e.x,p.kind==="dossier"?11:7);
}
/** Sweep fast-moving shots across their full step, so no enemy is skipped at 2x speed.
 * Ballistic shots follow their target until the predicted impact. Dead targets produce
 * a harmless miss, never phantom damage on a different lane.
 */
export function advanceProjectiles(g,delta){
 if(!g.projectiles?.length)return;
 for(let i=g.projectiles.length-1;i>=0;i--){
  const p=g.projectiles[i];
  p.age+=delta;
  if(p.cosmetic){
   if(p.age>=p.duration)g.projectiles.splice(i,1);
   continue;
  }
  const target=g.enemies.find(e=>e.uid===p.targetUid);
  if(p.ballistic){
   const t=Math.min(1,p.age/p.duration);
   if(target&&target.hp>0){
    p.endX=target.x;p.endRow=target.lane+.5;
   }
   p.x=p.startX+(p.endX-p.startX)*t;
   p.row=p.startRow+(p.endRow-p.startRow)*t-p.arc*4*t*(1-t);
   if(t>=1){
    if(target&&canTarget(g,pSource(p),target))hitProjectile(g,p,target);
    else effect(g,"miss",Math.max(0,Math.min(4,p.endRow-.5)),p.endX,"");
    g.projectiles.splice(i,1);
   }
   continue;
  }
  const oldX=p.x;
  p.x+=p.speed*delta;
  // Resolve the first enemy crossed by the stamp, not an enemy behind it.
  const first=g.enemies
   .filter(e=>e.lane===p.lane&&e.hp>0&&e.x>(p.minX??-Infinity)&&
       e.x>=oldX-.38&&e.x<=p.x+.38&&canTarget(g,pSource(p),e))
   .sort((a,b)=>a.x-b.x)[0];
  if(first){
   p.x=first.x;
   hitProjectile(g,p,first);
   g.projectiles.splice(i,1);
  }else if(p.x>=9.8||p.age>3){
   g.projectiles.splice(i,1);
  }
 }
}

function attack(g,d,delta){
 if(g.time<d.disabledUntil||g.time<d.confusedUntil)return;
 const spec=UNIT_BY_ID[d.id];
 const power=powered(g,d)?1:.5;
 const bonus=g.defenders.some(x=>x.lane===d.lane&&x.kind==="boost")?1.2:1;
 d.timer-=delta*power;
 if(d.kind==="income"||d.kind==="upgrade"){
  if(d.timer<=0){createToken(g,d.lane,d.col);if(d.kind==="upgrade")createToken(g,d.lane,d.col);d.timer=spec.interval;}
  return;
 }
 if(d.kind==="healer"){
  if(d.timer<=0){
   const candidates=g.defenders.filter(x=>x.uid!==d.uid&&Math.abs(x.lane-d.lane)<=1&&Math.abs(x.col-d.col)<=1&&x.hp<x.maxHp);
   candidates.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));
   if(candidates[0])candidates[0].hp=Math.min(candidates[0].maxHp,candidates[0].hp+200);
   d.timer=20;
  }
  return;
 }
 if(d.kind==="reveal"){
  for(const e of g.enemies)if(!e.reveal&&Math.abs(e.lane-d.lane)<=2&&Math.abs(e.x-(d.col+.5))<=2.5){
   unmask(g,e);
  }
  return;
 }
 if(d.kind==="trap"){
  if(d.timer>0)return;
  // One pulse hits every cyber enemy on the cell. Hitting only the first one
  // let the immune Hydra body absorb every pulse aimed at a head.
  // An exhausted Hydra head is finished by 2FA anywhere in its row: its own
  // cell may already hold a defender, and defenders cannot be removed.
  const inCell=g.enemies.filter(e=>e.scheme==="cyber"&&e.hp>0&&e.lane===d.lane&&
   (Math.abs(e.x-(d.col+.5))<.6||e.trait==="hydra_head"&&e.exhausted));
  for(const e of inCell){damageEnemy(g,e,spec.damage,"digital");e.stunUntil=Math.max(e.stunUntil,g.time+.35);}
  if(inCell.length)d.timer=1;
  return;
 }
 if(d.kind==="mine"){
  if(g.time-d.placedAt<14)return;
  // Same reach as the enemy's bite: a blocked enemy stops at ~CONTACT from
  // the centre, so a smaller radius let enemies eat an armed mine unharmed.
  // Flying units pass over it and peaceful debtors are not "arrested".
  const e=g.enemies.find(e=>e.lane===d.lane&&e.hp>0&&Math.abs(e.x-(d.col+.5))<=CONTACT&&
   !e.air&&!["flying","neutral"].includes(e.trait)&&!GUARD_IMMUNE.has(e.trait));
  if(e){damageEnemy(g,e,spec.damage,"enforcement");g.defenders.splice(g.defenders.indexOf(d),1);effect(g,"mine",d.lane,d.col+.5,"АРЕШТ");emitBurst(g,"mine",d.lane,d.col+.5,12);}
  return;
 }
 if(["power","integrity","boost","wall"].includes(d.kind))return;
 if(!["shooter","intern","lobber","splash","air","slow","sniper","global"].includes(d.kind)||d.timer>0)return;
 let candidates=g.enemies.filter(e=>canTarget(g,d,e));
 if(["shooter","intern","lobber","splash","air","slow"].includes(d.kind)){
  // An overlapping enemy is still directly in front of the defender.
  // Enemies can stop at x = col+.05 while fighting or after a leap; the
  // old +.45 cutoff made an otherwise live registrar stay permanently idle.
  candidates=candidates.filter(e=>e.lane===d.lane&&e.x>d.col+.02);
 }
 if(d.kind==="sniper"){
  candidates=candidates.filter(e=>Math.abs(e.x-(d.col+.5))<=3.5);
  // GDD: disguised targets first, then the healthiest. Untouchable bosses
  // go last so the expert does not waste every beam on them.
  candidates.sort((a,b)=>(Number(bossImmune(g,a))-Number(bossImmune(g,b)))||
   (Number(!b.reveal)-Number(!a.reveal))||(b.hp-a.hp));
 }else if(d.kind==="global"){candidates.sort((a,b)=>(Number(bossImmune(g,a))-Number(bossImmune(g,b)))||a.x-b.x);}
 else candidates.sort((a,b)=>a.x-b.x);
 if(d.kind==="lobber"&&g.level.boss&&g.level.world===1){
  const hidden=g.enemies.filter(x=>x.id==="offshore_safe"&&!x.reveal);
  if(hidden.length){for(const safe of hidden)safe.reveal=true;g.lastHint="Активи виявлено! Тепер знищіть сейфи-офшори.";effect(g,"reveal",d.lane,d.col+.5,"ЗНАЙДЕНО АКТИВИ");}
 }
 const e=candidates[0];if(!e)return;
 const raw=d.kind==="intern"&&g.time-d.placedAt>=60?20:spec.damage;
 if(d.id==="senior"){
  // Two real stamps (not a single fake double-damage animation).
  const top=fireProjectile(g,d,e,raw/2,bonus);
  const bottom=fireProjectile(g,d,e,raw/2,bonus);
  top.row=top.startRow=d.lane+.35;
  bottom.row=bottom.startRow=d.lane+.65;
 }else fireProjectile(g,d,e,raw,bonus);
 d.timer=spec.interval||2;
}
function defeat(g,e){
 g.lastThreat=e;
 if(e.trait==="neutral"){g.seal+=50;removeEnemy(g,e,true);return;}
 g.breaches++;
 if(e.id==="boss"){
  // A lane guard must not one-shot a boss: earlier only the Baron counted as
  // a defeat and every other boss was simply "mowed" for a free win.
  g.phase="lost";
  g.lastHint=g.level.world===0?"Барон завершив переоформлення. Зупиніть його спеціальною Забороною у третій фазі.":
   `${e.name} прорвався до будівлі. Боса заборона не зупиняє — його треба перемогти.`;
  return;
 }
 if(!g.usedGuards[e.lane]){useGuard(g,e.lane,true);return;}
 if(g.mode==="young"){removeEnemy(g,e);return;}
 g.phase="lost";g.lastHint=`Прорвався: ${e.name}. ${e.tip||"Спробуйте інший інструмент."}`;
}
function enemyTurn(g,e,delta){
 if(e.hp<=0)return;
 if(["offshore_safe","tentacle","hydra_head"].includes(e.trait)){
  // The Count is dormant while his safes stand, so hidden safes must not
  // stall the fight forever when no executor is on the field.
  if(e.trait==="offshore_safe"&&!e.reveal&&g.time>=e.revealAt){
   for(const safe of g.enemies)if(safe.trait==="offshore_safe")safe.reveal=true;
   g.lastHint="Активи знайдено! Знищіть сейфи-офшори — тоді Граф стане вразливим.";
   effect(g,"reveal",e.lane,e.x,"ЗНАЙДЕНО АКТИВИ");
  }
  if(g.time<e.specialUntil)return;
  if(e.trait==="tentacle"){
   const target=g.defenders.filter(d=>d.lane===e.lane&&!isProtected(g,d)).sort((a,b)=>b.col-a.col)[0];
   if(target){target.disabledUntil=g.time+3;effect(g,"bribe",e.lane,e.x,"КОНВЕРТ");}
  }else if(e.trait==="hydra_head"){
   // GDD: the phishing head steals seals lying on the field, not from the
   // wallet. Draining the wallet spiralled a struggling player to zero.
   if(e.id==="hydra_phish"&&g.tokens.length){
    const token=g.tokens.reduce((a,b)=>a.ttl<b.ttl?a:b);
    g.tokens.splice(g.tokens.indexOf(token),1);
    effect(g,"phish",token.lane,token.col+.5,"ПЕЧАТКУ ВКРАДЕНО");
   }
   if(e.id==="hydra_call"){
    const target=g.defenders.find(d=>d.lane===e.lane&&d.kind!=="trap"&&!d.shieldHp);
    if(target)target.disabledUntil=g.time+4;
   }
   if(e.id==="hydra_malware")for(let i=0;i<2;i++)spawn(g,"usb",e.lane,9.0+i*.24);
  }
  e.specialUntil=g.time+12;return;
 }
 if(e.jumpStart!=null){
  // Visible leap over one unit instead of an instant 1.35-cell teleport,
  // which looked like the enemy walked straight through the defender.
  const t=Math.min(1,(g.time-e.jumpStart)/JUMP_TIME);
  e.x=e.jumpFrom+(e.jumpTo-e.jumpFrom)*t;e.lift=4*t*(1-t);
  if(t>=1){e.jumpStart=null;e.lift=0;}
  if(e.x<=.06)defeat(g,e);
  return;
 }
 const rowHaste=g.enemies.some(x=>x!==e&&x.lane===e.lane&&x.trait==="haste")?1.3:1;
 let move=(e.speed/4.5)*delta*rowHaste;
 if(g.time<e.frozenUntil)move*=e.scheme==="debt"?.02:.5;
 if(g.time<e.stunUntil)move=0;
 // Bosses wait behind their safes / heads; otherwise the immune body simply
 // walked to the house while the heads were still alive.
 if(bossImmune(g,e)||bossAnchored(g,e))move=0;
 const nearby=g.defenders.filter(d=>d.lane===e.lane&&blocksPath(d)&&Math.abs(d.col+.5-e.x)<CONTACT).sort((a,b)=>b.col-a.col);
 const blocker=nearby[0];
 // Timed contact abilities restart when the enemy faces a different unit.
 if(blocker?.uid!==e.contactUid){e.contactUid=blocker?.uid;e.contactTime=0;e.smashAt=null;}
 // Escorts are capped: the fight stays about the boss, not an endless
 // stream that soaks up every shot in the boss lane.
 const escorts=g.enemies.filter(x=>x.summonedBy===e.uid&&x.hp>0).length;
 // A boss is dormant while its protectors stand (Count's safes, Octopus's
 // tentacles, Hydra's heads): the player is busy with them, and extra summons
 // (burrowers only an executor can hit, phishers in all five lanes) buried
 // new players for minutes.
 const dormant=bossImmune(g,e)||g.level.world===2&&bossAnchored(g,e);
 if(e.id==="boss"&&g.time>e.specialUntil&&escorts<BOSS_ESCORT_CAP&&!dormant){
  const w=g.level.world,call=(id,lane,x)=>{const m=spawn(g,id,lane,x);if(m)m.summonedBy=e.uid;};
  if(w===0&&e.phase===1)call("poa",e.lane,Math.min(9,e.x+.5));
  // "Свій реєстратор": a raider, answered by world-1 cards (notary,
  // commission). A hacker needed 2FA/KEP, which unlock only in world 4.
  if(w===0&&e.phase===2)call("raider",e.lane,Math.min(9,e.x+.7));
  // GDD phase 1 of the Count ("Схованки") hides assets, it summons nobody.
  // Bankrupts enter from the edge like any summons: spawning them next to a
  // boss deep in the field left no time for a trustee to react.
  if(w===1&&e.phase===2)call("bankrupt",e.lane,9.2);
  // Flanks only: bribers in the Octopus's own lane soaked every shot aimed
  // at the head and bribed the guns that were supposed to finish it.
  if(w===2)for(const lane of [0,4])if(g.level.activeLanes.includes(lane)&&lane!==e.lane)call("briber",lane,9.2);
  // Stealing seals is the phishing head's job (GDD); the body draining too
  // starved the economy below what CNAP income can recover.
  if(w===3){
   // Spread the summons over the field instead of always flooding the
   // body's own lane, where they soaked up every shot aimed at a head.
   const lanes=g.level.activeLanes,lane=lanes[Math.floor(g.time*7.3)%lanes.length];
   call(e.phase===1?"phisher":e.phase===2?"caller":"usb",lane,9.2);
  }
  e.specialUntil=g.time+BOSS_SUMMON_EVERY;effect(g,"phase",e.lane,e.x,"СХЕМА!");
 }
 if(e.trait==="mini_boss"&&g.time>e.specialUntil){
  for(const other of g.enemies)if(other!==e&&Math.abs(other.lane-e.lane)<=2&&Math.abs(other.x-e.x)<2)other.hp=Math.min(other.maxHp,other.hp+300);
  e.specialUntil=g.time+8;effect(g,"heal",e.lane,e.x,"ЛИПОВИЙ ВИСНОВОК");
 }
 if(["phish","call"].includes(e.trait)&&g.time>e.specialUntil){
  // 2FA is exactly what a phishing link or a fake call cannot switch off.
  const target=g.defenders.filter(d=>d.lane===e.lane&&d.kind!=="trap"&&e.x>d.col+.5&&e.x-(d.col+.5)<=3&&!d.shieldHp).sort((a,b)=>b.col-a.col)[0];
  if(target){target.disabledUntil=g.time+(e.trait==="phish"?5:3);e.specialUntil=g.time+(e.trait==="phish"?10:8);effect(g,"phish",e.lane,e.x,"НЕВІДОМЕ ПОСИЛАННЯ");}
 }
 if(e.trait==="giant"&&!e.spawnedMinions&&e.hp<e.maxHp*.5){
  e.spawnedMinions=true;spawn(g,"schemer",e.lane,Math.max(.9,e.x-2));
 }
 if(blocker&&!e.air&&!["burrow","flying","neutral"].includes(e.trait)){
  if(["jump","disguised_jump"].includes(e.trait)&&!e.jumped&&blocker.id!=="notary_office"){
   // Land just behind the jumped unit (outside its contact reach).
   e.jumped=true;e.jumpFrom=e.x;e.jumpTo=blocker.col+.5-CONTACT-.05;e.jumpStart=g.time;e.lift=0;
   effect(g,"jump",e.lane,e.x,"СТРИБОК",.9);
  }else if(e.trait==="seize"&&blocker.tool!=="notary"&&!isProtected(g,blocker)&&
   !g.locks.some(x=>x.lane===blocker.lane&&x.col===blocker.col)){
   // Re-registration takes time: the raider has to stand at the unit first,
   // so the player can react. Notaries and protected units resist it and
   // are bitten normally instead (else-branch below).
   e.contactTime+=delta;e.attackUntil=g.time+.36;
   if(e.contactTime>=SEIZE_TIME){
    g.locks.push({lane:blocker.lane,col:blocker.col,enemyUid:e.uid,lost:{...blocker}});
    removeDefender(g,blocker,"seize");
    effect(g,"seize",e.lane,e.x,"ФАЛЬШИВИЙ ЗАПИС");
    e.contactTime=0;
   }
  }else{
   if(e.trait==="phish"&&g.time>e.specialUntil&&!blocker.shieldHp){blocker.disabledUntil=g.time+5;e.specialUntil=g.time+10;effect(g,"phish",e.lane,e.x,"ФІШИНГ");}
   if(e.trait==="call"&&g.time>e.specialUntil&&!blocker.shieldHp){blocker.disabledUntil=g.time+3;e.specialUntil=g.time+8;}
   if(["hack","bribe"].includes(e.trait)&&!isProtected(g,blocker)&&g.time>e.specialUntil){
    e.contactTime+=delta;
    if(e.contactTime>= (e.trait==="hack"?4:3)){
     blocker.confusedUntil=g.time+8;e.specialUntil=g.time+13;e.contactTime=0;effect(g,"bribe",e.lane,e.x,"ЗАГРОЗА ДОСТУПУ");
    }
   }
   if(e.trait==="suicide"){const dealt=Math.min(blocker.shieldHp,150);blocker.shieldHp-=dealt;blocker.hp-=150-dealt;
    blocker.lastDamagedAt=g.time;
    if(blocker.hp<=0)removeDefender(g,blocker,"down");
    removeEnemy(g,e);return;}
   let dmg=100*delta;
   if(e.trait==="giant"){
    // A windup smash, not 2500 damage every frame: at 60 FPS the golem used
    // to flatten even the 8000-HP notary office in a few frames and visibly
    // walked through the row.
    e.attackUntil=g.time+.36;
    if(e.smashAt==null)e.smashAt=g.time+GIANT_WINDUP;
    if(g.time>=e.smashAt){dmg=2500;e.smashAt=g.time+GIANT_SMASH_EVERY;effect(g,"smash",e.lane,e.x,"ГУП!");}
    else dmg=0;
   }
   if(blocker.shieldHp>0){const absorbed=Math.min(blocker.shieldHp,dmg);blocker.shieldHp-=absorbed;dmg-=absorbed;}
   blocker.hp-=dmg;
   if(dmg>0){blocker.lastDamagedAt=g.time;e.attackUntil=g.time+.36;}
   if(blocker.kind==="wall"&&blocker.id==="notary"&&e.scheme==="forgery")damageEnemy(g,e,10*delta,"notary");
   if(blocker.hp<=0)removeDefender(g,blocker,"down");
  }
 }else{
  e.x-=move;
 }
 if(e.x<=.06)defeat(g,e);
}
export function tick(g,delta){
 if(g.phase!=="playing")return;
 delta=cap(delta,0,.13);
 g.time+=delta;g.elapsed+=delta;
 for(const k of Object.keys(g.cooldowns))g.cooldowns[k]=Math.max(0,g.cooldowns[k]-delta);
 for(const t of [...g.tokens]){t.ttl-=delta;if(t.ttl<=0){g.tokens.splice(g.tokens.indexOf(t),1);missedToken(g);}}
 for(const fx of [...g.effects]){fx.ttl-=delta;if(fx.ttl<=0)g.effects.splice(g.effects.indexOf(fx),1);}
 if(g.time>=g.nextSky){
  if(!g.level.special.conveyor)createToken(g,Math.floor(Math.random()*5),Math.floor(Math.random()*9));
  g.nextSky+=g.level.special.blackout?14:10;
 }
 // Rubber-band pacing: a cleared field shortens the wait for the next wave
 // (never lengthens it), so nobody watches an empty board for 20 s.
 const next=g.plan[g.spawned];
 if(next&&next.wave>g.stageWave&&!g.enemies.some(e=>e.trait!=="neutral")){
  g.calm=(g.calm||0)+delta;
  const lull=g.level.stage===1?WAVE_LULL.tutorial:WAVE_LULL.normal;
  if(g.stageWave>0&&g.calm>=lull&&next.time>g.time+1){
   const shift=next.time-(g.time+1);
   for(let i=g.spawned;i<g.plan.length;i++)g.plan[i].time-=shift;
  }
 }else g.calm=0;
 while(g.spawned<g.plan.length&&g.plan[g.spawned].time<=g.time){
  const action=g.plan[g.spawned++];
  if(action.wave>g.stageWave){
   g.stageWave=action.wave;
   effect(g,"wave",2,4.5,action.wave===g.maxWave?"ВЕЛИКА СХЕМА!":"ХВИЛЯ "+action.wave,2.1);
  }
  spawn(g,action.id,action.lane);
  if(action.id==="usb"&&g.level.stage>=7){
   for(let i=1;i<5;i++)spawn(g,"usb",action.lane,9.3+i*.32);
  }
 }
 for(const d of [...g.defenders])attack(g,d,delta);
 for(const e of [...g.enemies])if(g.enemies.includes(e))enemyTurn(g,e,delta);
 advanceProjectiles(g,delta);
 advanceParticles(g,delta);
 advanceFallen(g,delta);
 advanceRollers(g,delta);
 if(g.finalSurvivalUntil&&g.time<g.finalSurvivalUntil&&g.time>=g.nextSurvivalSpawn){
  const ids=["schemer","phisher","briber","alimony","caller","usb"];
  const ix=Math.floor((g.finalSurvivalUntil-g.time)*2)%ids.length;
  spawn(g,ids[Math.abs(ix)],Math.floor(Math.random()*5),9.3);
  g.nextSurvivalSpawn=g.time+2.6;
 }
 if(g.phase==="playing"&&g.plan.length>0&&g.spawned===g.plan.length&&g.enemies.length===0&&g.projectiles.length===0&&!g.rollers?.some(r=>!r.done)&&g.time>=g.plan[g.plan.length-1].time+2){
  if(g.challenge?.kind==="endless"){
   queueEndlessWave(g,g.maxWave+1);
   g.lastHint="🦉 Хвилю "+g.stageWave+" відбито. Готуйтесь до наступної!";
  }else if(!g.finalSurvivalUntil||g.time>=g.finalSurvivalUntil)g.phase="won";
 }
}
export function currentProgress(g){return g.plan.length?Math.min(100,Math.round(100*g.spawned/g.plan.length)):100;}
export function scoreStars(g){
 if(g.phase!=="won")return 0;
 return 1+Number(g.usedGuards.every(x=>!x))+Number(g.defenderLosses<=3&&g.breaches===0);
}
export function selectAdvice(g){
 const e=g.lastThreat;
 if(!e)return g.lastHint;
 const recommended={forgery:"реєстраційний або нотаріальний",cyber:"цифровий",corruption:"антикорупційний",debt:"виконавчий",bureaucracy:"експертний"};
 return `${e.name}: ${e.tip} Ефективний інструмент: ${recommended[e.scheme]}.`;
}
