import {UNITS,UNIT_BY_ID,ENEMIES,ENEMY_BY_ID,TYPES,TOOLS,SCHEMES} from "./data.js";
const cap=(n,min,max)=>Math.max(min,Math.min(max,n));
export function typeMultiplier(tool,scheme,mode="normal"){
 if(!tool||!TOOLS[tool])return 1;
 const n=TOOLS[tool].multipliers[SCHEMES.indexOf(scheme)]??1;
 return mode==="expert"&&n<1?.25:n;
}
export function makeWavePlan(level,seed=0){
 const list=[],waves=level.waves;
 let s=seed||level.world*1001+level.stage*211+71;
 const rand=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
 for(let w=0;w<waves;w++){
  const start=13+w*(level.stage===1?26:41);
  const n=level.stage===1?1+w:Math.min(13,2+w*2+Math.floor(level.stage/3));
  for(let i=0;i<n;i++){
   const pool=level.enemies;
   let id=pool[Math.floor(rand()*pool.length)];
   // Tutorial levels introduce only the currently relevant threats.
   if(level.world===0&&level.stage<=4){
    const intro=["schemer","schemer","poa","broker"][level.stage-1];
    id=i%3===0?intro:"schemer";
   }
   if(id==="usb"&&i%3===0)id="usb";
   list.push({time:start+i*(level.stage===1?5:2.8),id,lane:level.activeLanes[Math.floor(rand()*level.activeLanes.length)],wave:w+1});
  }
 }
 if(level.boss)list.push({time:13+(waves-1)*41+24,id:"boss",lane:level.activeLanes[Math.floor(rand()*level.activeLanes.length)],wave:waves});
 if(level.id==="3-5")list.push({time:13+(waves-1)*41+19,id:"mini_boss",lane:2,wave:waves});
 return list.sort((a,b)=>a.time-b.time);
}
export function makeGame(level,deck,mode="normal",settings={},challenge=null){
 const game={
  level,deck:[...deck],mode,settings,challenge,phase:"playing",time:0,elapsed:0,seal:(mode==="young"?300:level.startingSeals)+(settings.careerBonus||0),
  defenders:[],enemies:[],tokens:[],locks:[],effects:[],projectiles:[],plan:makeWavePlan(level),
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
function effect(g,kind,lane,x,text=""){g.effects.push({id:uid(g),kind,lane,x,ttl:.7,text});if(g.effects.length>35)g.effects.shift();}
export function spawn(g,id,lane,x=9.3){
 const parts={
  offshore_safe:{name:"Сейф-офшор",icon:"🔒",scheme:"debt",hp:800,speed:0,trait:"offshore_safe",tip:"Сховані активи потребують виявлення."},
  tentacle:{name:"Щупальце підкупу",icon:"🐙",scheme:"corruption",hp:1500,speed:0,trait:"tentacle",tip:"Запобігання корупції потребує перевірки."},
  hydra_phish:{name:"Голова фішингу",icon:"🎣",scheme:"cyber",hp:5000,speed:0,trait:"hydra_head",tip:"Перевіряйте посилання."},
  hydra_call:{name:"Голова дзвінків",icon:"☎️",scheme:"cyber",hp:5000,speed:0,trait:"hydra_head",tip:"Не розголошуйте коди по телефону."},
  hydra_malware:{name:"Голова шкідливого ПЗ",icon:"💾",scheme:"cyber",hp:5000,speed:0,trait:"hydra_head",tip:"Невідомі носії небезпечні."}
 };
 let data=parts[id]|| (id==="boss"?g.level.bossData:id==="mini_boss"?{name:"Липовий експерт",icon:"🥼",scheme:"bureaucracy",hp:2500,speed:.6,trait:"mini_boss",tip:"Перевіряйте кваліфікацію експертів у визначених законом реєстрах."}:ENEMY_BY_ID[id]); if(!data)return null;
 const hpMod=g.mode==="young"?.6:g.mode==="expert"?1.3:1;
 const enemy={uid:uid(g),id,name:data.name,icon:data.icon,scheme:data.scheme,
 hp:data.hp*hpMod,maxHp:data.hp*hpMod,shield:data.shield||0,maxShield:data.shield||0,
 speed:(data.speed??.28)*(g.mode==="young"?.6:g.mode==="expert"?1.15:1),lane,x,
 trait:data.trait||(id==="boss"?"boss":"basic"),reveal:!["disguised_jump","disguised_split"].includes(data.trait),
 frozenUntil:0,stunUntil:0,specialUntil:0,contactTime:0,jumped:false,revived:false,
 spawnedMinions:false,lastHitTool:null,phase:1,tip:data.tip,air:id==="bankrupt"||id==="boss"&&g.level.world===1&&false};
 if(id==="boss"&&g.level.world===3){enemy.hp=8000*hpMod;enemy.maxHp=8000*hpMod;}
 if(id==="offshore_safe")enemy.reveal=false;
 g.enemies.push(enemy);g.lastThreat=enemy;effect(g,"spawn",lane,x,"!");
 if(id==="boss"&&g.level.world===1){
  for(const l of [0,1,3,4])spawn(g,"offshore_safe",l,7.0);
  g.lastHint="Граф сховав активи! Державний виконавець допоможе знайти сейфи.";
 }
 if(id==="boss"&&g.level.world===2){
  for(let l=0;l<5;l++)spawn(g,"tentacle",l,8.0);
  g.lastHint="Спершу нейтралізуйте п'ять щупалець підкупу.";
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
 g.seal+=g.tokens[index].value;g.tokens.splice(index,1);return true;
}
export function collectAll(g){for(const token of [...g.tokens])collectToken(g,token.uid);}
const same=(a,b)=>a.lane===b.lane&&a.col===b.col;
function at(g,lane,col){return g.defenders.find(d=>d.lane===lane&&d.col===col&&d.hp>0);}
function isProtected(g,d){return !!d.shieldHp||g.defenders.some(other=>other.kind==="integrity"&&Math.abs(other.lane-d.lane)<=1&&Math.abs(other.col-d.col)<=1);}
function powered(g,d){return !g.level.special.blackout||d.kind==="power"||g.defenders.some(o=>o.kind==="power"&&Math.abs(o.col-d.col)<=1&&Math.abs(o.lane-d.lane)<=1);}
function revealInRange(g,e){
 return g.defenders.some(d=>d.kind==="reveal"&&Math.abs(d.lane-e.lane)<=2&&Math.abs(d.col+.5-e.x)<=2.5);
}
export function canTarget(g,d,e){
 if(e.hp<=0)return false;
 if(e.id==="offshore_safe"&&!e.reveal)return false;
 if(e.trait==="neutral")return false;
 if((e.trait==="flying"||e.air)&&!["air","sniper","global"].includes(d.kind))return false;
 if(e.trait==="burrow"&&!["lobber","mine"].includes(d.kind))return false;
 if(!e.reveal && d.kind!=="sniper" && !revealInRange(g,e))return false;
 if(g.level.special.fog&&e.x>5.5&&!revealInRange(g,e)&&d.kind!=="sniper")return false;
 if(e.id==="hacker"&&d.tool==="notary")return false;
 return true;
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
  effect(g,"blast",lane,col+.5,"ВИКРИТО");return {ok:true};
 }
 if(u.kind==="sweep"){
  for(const e of [...g.enemies])if(e.lane===lane){
   if(e.trait==="neutral"){g.seal+=50;removeEnemy(g,e,true);}else damageEnemy(g,e,1800,null);
  }
  effect(g,"sweep",lane,col+.5,"ПРАВНИЧА ДОПОМОГА");return {ok:true};
 }
 g.defenders.push({uid:uid(g),id,name:u.name,icon:u.icon,kind:u.kind,tool:u.tool,lane,col,
 hp:u.hp,maxHp:u.hp,shieldHp:0,timer:0,placedAt:g.time,disabledUntil:0,confusedUntil:0,lastShotAt:-10});
 effect(g,"plant",lane,col+.5,"+");
 return {ok:true};
}
function removeEnemy(g,e,silent=false){
 const idx=g.enemies.indexOf(e);if(idx>=0)g.enemies.splice(idx,1);
 if(!silent){g.kills++;effect(g,"hit",e.lane,e.x,"АНУЛЬОВАНО");}
 g.locks=g.locks.filter(l=>l.enemyUid!==e.uid);
 if(e.id==="boss"&&g.level.world===3&&!g.finalSurvivalUntil){
  g.finalSurvivalUntil=g.time+30;g.nextSurvivalSpawn=g.time+2;
  g.lastHint="Перезавантаження реєстрів: протримайтесь іще 30 секунд!";
 }
}
export function damageEnemy(g,e,raw,tool=null,extra=1){
 if(!g.enemies.includes(e))return 0;
 let mult=typeMultiplier(tool,e.scheme,g.mode);
 if(e.id==="boss"){
  if(g.level.world===2){
   if(tool!=="integrity")mult*=.5;
   if(g.enemies.some(x=>x.id==="tentacle"&&x.hp>0))mult*=.25;
  }
  if(g.level.world===1&&g.enemies.some(x=>x.id==="offshore_safe"&&x.hp>0))mult=0;
  if(g.level.world===3&&g.enemies.some(x=>x.trait==="hydra_head"&&x.hp>0))mult=0;
  if(g.level.world===1&&e.phase===2&&!["enforcement","expert"].includes(tool))mult*=.2;
  if(g.level.world===3&&e.phase<3&&tool!=="digital")mult*=.25;
  if(g.level.world===0&&e.hp<=e.maxHp*.35&&!g.bossGuardUsed)mult=0;
 }
 if(e.id==="mini_boss"&&tool!=="expert")mult=Math.min(mult,.5);
 if(e.id==="tentacle"&&tool!=="integrity")mult*=.5;
 let n=Math.max(0,raw*mult*extra);
 if(e.shield>0 && tool!=="enforcement"){const absorbed=Math.min(e.shield,n);e.shield-=absorbed;n-=absorbed;}
 e.hp-=n;e.lastHitTool=tool;if(n>0)e.lastHitAt=g.time;
 if(n>0&&Math.random()<.24)effect(g,"damage",e.lane,e.x,mult>=1.5?"✔ ×"+mult:mult<1?"×"+mult:"");
 if(e.id==="boss"){
  const prev=e.phase;e.phase=e.hp>e.maxHp*.7?1:e.hp>e.maxHp*.35?2:3;
  if(e.phase!==prev){
   if(g.level.world===1){e.air=e.phase===2;if(e.phase===3)e.speed=.58;}
   g.lastHint=`⚠️ ${e.name}: фаза ${e.phase}. Змінюйте тактику!`;
   effect(g,"phase",e.lane,e.x,"ФАЗА "+e.phase);
   if(e.phase===3&&g.level.world===0){g.bossGuardReady=true;g.lastHint="Барон готує фінальний підпис! Натисніть 🛑 біля його доріжки."; }
  }
 }
 if(e.hp>0)return n;
 if(e.trait==="hydra_head"&&tool!=="digital"){
  // A wrong finishing tool cannot permanently destroy a Hydra head.
  const current=g.enemies.filter(x=>x.trait==="hydra_head"&&x.uid!==e.uid).length;
  const splits=current>=8?1:2;
  for(let i=0;i<splits;i++){
   const h=spawn(g,e.id,e.lane,Math.min(8.5,e.x+i*.25));
   h.hp=h.maxHp*.5;
  }
  g.lastHint="Голова відросла! Використовуйте 2FA, щоб зупинити Гідру.";
  effect(g,"regrow",e.lane,e.x,"ГОЛОВА ВІДРОСЛА");
 }
 if(e.trait==="revive"&&!e.revived&&tool!=="integrity"){
  e.revived=true;e.hp=e.maxHp*.5;effect(g,"revive",e.lane,e.x,"ПОВЕРНУВСЯ");return n;
 }
 if(e.trait==="split"&&!e.spawnedMinions){
  e.spawnedMinions=true;
  for(const lane of [e.lane-1,e.lane+1])if(g.level.activeLanes.includes(lane))spawn(g,"schemer",lane,e.x);
 }
 if(e.trait==="disguised_split"&&!e.spawnedMinions){
  for(let j=0;j<2;j++)spawn(g,"schemer",e.lane,e.x+(.2*j));
 }
 if(e.id==="bankrupt")createToken(g,e.lane,Math.floor(e.x));
 removeEnemy(g,e);
 return n;
}
export function useGuard(g,lane,automatic=false){
 if(g.phase!=="playing"||g.usedGuards[lane]||!g.level.activeLanes.includes(lane))return false;
 if(!automatic){
  if(!(g.level.boss&&g.level.world===0))return false;
  const boss=g.enemies.find(e=>e.id==="boss"&&e.lane===lane);
  if(!boss||boss.phase<3)return false;
  g.bossGuardUsed=true;damageEnemy(g,boss,boss.maxHp,"registry",3);
 }
 g.usedGuards[lane]=true;
 for(const e of [...g.enemies])if(e.lane===lane)removeEnemy(g,e);
 effect(g,"guard",lane,3.5,"ЗАБОРОНА");
 return true;
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
 const sourceX=d.col+.78,targetX=target.x,fromRow=d.lane+.5,toRow=target.lane+.5;
 const ballistic=style.arc>0;
 const shot={
  uid:uid(g),kind:style.kind,sourceKind:d.kind,sourceUid:d.uid,
  lane:d.lane,tool:d.tool,damage:raw,bonus,targetUid:target.uid,
  x:sourceX,row:fromRow,startX:sourceX,startRow:fromRow,
  endX:targetX,endRow:toRow,age:0,
  duration:ballistic?Math.max(.5,Math.min(1.5,Math.hypot(targetX-sourceX,(toRow-fromRow)*1.25)/style.speed)):
   Math.max(.18,(targetX-sourceX)/style.speed),
  speed:style.speed,arc:style.arc,ballistic,
  cosmetic:style.kind==="beam"
 };
 if(shot.cosmetic){
  // A laser scan affects the enemy instantly; the visible beam is brief.
  shot.duration=.2;
  damageEnemy(g,target,raw,d.tool,bonus);
  effect(g,"scan",target.lane,target.x,"ЕКСПЕРТИЗА");
 }
 g.projectiles.push(shot);
 // A modest ceiling protects low-end mobile browsers during endless mode.
 if(g.projectiles.length>160)g.projectiles.splice(0,g.projectiles.length-160);
 d.lastShotAt=g.time;
 effect(g,"muzzle",d.lane,sourceX,"");
 return shot;
}
function hitProjectile(g,p,e){
 if(!g.enemies.includes(e))return;
 if(p.sourceKind==="slow"){
  e.frozenUntil=Math.max(e.frozenUntil,g.time+(e.scheme==="debt"?3:6));
  e.stunUntil=Math.max(e.stunUntil,e.scheme==="debt"?g.time+3:e.stunUntil);
 }
 if(p.sourceKind==="sniper"&&!e.reveal)e.reveal=true;
 if(p.sourceKind==="splash"){
  for(const other of [...g.enemies])
   if(Math.abs(other.lane-e.lane)<=1&&Math.abs(other.x-e.x)<=1.25)
    damageEnemy(g,other,p.damage,p.tool,p.bonus);
 }else damageEnemy(g,e,p.damage,p.tool,p.bonus);
 const word=p.kind==="chain"?"ОБМЕЖЕНО":p.kind==="clip"?"АКТИВИ":p.kind==="dossier"?"ПОСТАНОВА":"";
 effect(g,"impact-"+p.kind,e.lane,e.x,word);
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
   .filter(e=>e.lane===p.lane&&e.hp>0&&
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
   e.reveal=true;if(e.trait==="disguised_split"&&!e.spawnedMinions){e.spawnedMinions=true;for(let k=0;k<2;k++)spawn(g,"schemer",e.lane,e.x+.15*k);}
  }
  return;
 }
 if(d.kind==="trap"){
  for(const e of [...g.enemies])if(e.scheme==="cyber"&&e.lane===d.lane&&Math.abs(e.x-(d.col+.5))<.6){
   if(d.timer<=0){damageEnemy(g,e,20,"digital");d.timer=1;e.stunUntil=Math.max(e.stunUntil,g.time+.35);}
  }
  return;
 }
 if(d.kind==="mine"){
  if(g.time-d.placedAt<14)return;
  const e=g.enemies.find(e=>e.lane===d.lane&&Math.abs(e.x-(d.col+.5))<.62);
  if(e){damageEnemy(g,e,spec.damage,"enforcement");g.defenders.splice(g.defenders.indexOf(d),1);effect(g,"mine",d.lane,d.col+.5,"АРЕШТ");}
  return;
 }
 if(["power","integrity","boost","wall"].includes(d.kind))return;
 if(!["shooter","intern","lobber","splash","air","slow","sniper","global"].includes(d.kind)||d.timer>0)return;
 let candidates=g.enemies.filter(e=>canTarget(g,d,e));
 if(["shooter","intern","lobber","splash","air","slow"].includes(d.kind)){
  candidates=candidates.filter(e=>e.lane===d.lane&&e.x>d.col+.45);
 }
 if(d.kind==="sniper"){
  candidates=candidates.filter(e=>Math.abs(e.x-(d.col+.5))<=3.5);
  candidates.sort((a,b)=>(Number(!a.reveal)-Number(!b.reveal))||(b.hp-a.hp));
 }else if(d.kind==="global"){candidates.sort((a,b)=>a.x-b.x);}
 else candidates.sort((a,b)=>a.x-b.x);
 if(d.kind==="lobber"&&g.level.boss&&g.level.world===1){
  const hidden=g.enemies.filter(x=>x.id==="offshore_safe"&&!x.reveal);
  if(hidden.length){for(const safe of hidden)safe.reveal=true;g.lastHint="Активи виявлено! Тепер знищіть сейфи-офшори.";effect(g,"reveal",d.lane,d.col+.5,"ЗНАЙДЕНО АКТИВИ");}
 }
 const e=candidates[0];if(!e)return;
 const raw=d.kind==="intern"&&g.time-d.placedAt>=60?20:spec.damage;
 if(d.id==="senior"){
  // Two real stamps (not a single fake double-damage animation).
  fireProjectile(g,d,e,raw/2,bonus);
  fireProjectile(g,d,e,raw/2,bonus);
 }else fireProjectile(g,d,e,raw,bonus);
 d.timer=spec.interval||2;
}
function defeat(g,e){
 g.lastThreat=e;
 if(e.trait==="neutral"){g.seal+=50;removeEnemy(g,e,true);return;}
 g.breaches++;
 if(e.id==="boss"&&g.level.world===0){
  g.phase="lost";g.lastHint="Барон завершив переоформлення. Зупиніть його спеціальною Забороною у третій фазі.";return;
 }
 if(!g.usedGuards[e.lane]){useGuard(g,e.lane,true);return;}
 if(g.mode==="young"){removeEnemy(g,e);return;}
 g.phase="lost";g.lastHint=`Прорвався: ${e.name}. ${e.tip||"Спробуйте інший інструмент."}`;
}
function enemyTurn(g,e,delta){
 if(e.hp<=0)return;
 if(["offshore_safe","tentacle","hydra_head"].includes(e.trait)){
  if(g.time<e.specialUntil)return;
  if(e.trait==="tentacle"){
   const target=g.defenders.filter(d=>d.lane===e.lane&&!isProtected(g,d)).sort((a,b)=>b.col-a.col)[0];
   if(target){target.disabledUntil=g.time+3;effect(g,"bribe",e.lane,e.x,"КОНВЕРТ");}
  }else if(e.trait==="hydra_head"){
   if(e.id==="hydra_phish"){g.seal=Math.max(0,g.seal-25);effect(g,"phish",e.lane,e.x,"-25");}
   if(e.id==="hydra_call"){
    const target=g.defenders.find(d=>d.lane===e.lane&&!d.shieldHp);
    if(target)target.disabledUntil=g.time+4;
   }
   if(e.id==="hydra_malware")for(let i=0;i<3;i++)spawn(g,"usb",e.lane,9.0+i*.24);
  }
  e.specialUntil=g.time+12;return;
 }
 const rowHaste=g.enemies.some(x=>x!==e&&x.lane===e.lane&&x.trait==="haste")?1.3:1;
 let move=(e.speed/4.5)*delta*rowHaste;
 if(g.time<e.frozenUntil)move*=e.scheme==="debt"?.02:.5;
 if(g.time<e.stunUntil)move=0;
 const nearby=g.defenders.filter(d=>d.lane===e.lane&&Math.abs(d.col+.5-e.x)<.65).sort((a,b)=>b.col-a.col);
 const blocker=nearby[0];
 if(e.id==="boss"&&g.time>e.specialUntil){
  const w=g.level.world;
  if(w===0&&e.phase===1)spawn(g,"poa",e.lane,Math.min(9,e.x+.5));
  if(w===0&&e.phase===2)spawn(g,"hacker",e.lane,Math.min(9,e.x+.7));
  if(w===1&&e.phase===1)spawn(g,"burrower",e.lane,Math.min(9,e.x+.7));
  if(w===1&&e.phase===2)spawn(g,"bankrupt",e.lane,Math.min(9,e.x+.7));
  if(w===2)for(let lane=0;lane<5;lane++)if(g.level.activeLanes.includes(lane)&&lane%2===0)spawn(g,"briber",lane,9.2);
  if(w===3){g.seal=Math.max(0,g.seal-25);spawn(g,e.phase===1?"phisher":e.phase===2?"caller":"usb",e.lane,9.2);}
  e.specialUntil=g.time+13;effect(g,"phase",e.lane,e.x,"СХЕМА!");
 }
 if(e.trait==="mini_boss"&&g.time>e.specialUntil){
  for(const other of g.enemies)if(other!==e&&Math.abs(other.lane-e.lane)<=2&&Math.abs(other.x-e.x)<2)other.hp=Math.min(other.maxHp,other.hp+300);
  e.specialUntil=g.time+8;effect(g,"heal",e.lane,e.x,"ЛИПОВИЙ ВИСНОВОК");
 }
 if(["phish","call"].includes(e.trait)&&g.time>e.specialUntil){
  const target=g.defenders.filter(d=>d.lane===e.lane&&e.x>d.col+.5&&e.x-(d.col+.5)<=3&&!d.shieldHp).sort((a,b)=>b.col-a.col)[0];
  if(target){target.disabledUntil=g.time+(e.trait==="phish"?5:3);e.specialUntil=g.time+(e.trait==="phish"?10:8);effect(g,"phish",e.lane,e.x,"НЕВІДОМЕ ПОСИЛАННЯ");}
 }
 if(e.trait==="giant"&&!e.spawnedMinions&&e.hp<e.maxHp*.5){
  e.spawnedMinions=true;spawn(g,"schemer",e.lane,Math.max(.9,e.x-2));
 }
 if(blocker&&!e.air&&!["burrow","flying","neutral"].includes(e.trait)){
  if(["jump","disguised_jump"].includes(e.trait)&&!e.jumped&&blocker.id!=="notary_office"){
   e.jumped=true;e.x-=1.35;effect(g,"jump",e.lane,e.x,"СТРИБОК");
  }else if(e.trait==="seize"&&!g.locks.some(x=>x.lane===blocker.lane&&x.col===blocker.col)){
   g.locks.push({lane:blocker.lane,col:blocker.col,enemyUid:e.uid,lost:{...blocker}});
   g.defenders.splice(g.defenders.indexOf(blocker),1);g.defenderLosses++;
   effect(g,"seize",e.lane,e.x,"ФАЛЬШИВИЙ ЗАПИС");
  }else{
   if(e.trait==="phish"&&g.time>e.specialUntil&&!blocker.shieldHp){blocker.disabledUntil=g.time+5;e.specialUntil=g.time+10;effect(g,"phish",e.lane,e.x,"ФІШИНГ");}
   if(e.trait==="call"&&g.time>e.specialUntil&&!blocker.shieldHp){blocker.disabledUntil=g.time+3;e.specialUntil=g.time+8;}
   if(["hack","bribe"].includes(e.trait)&&!isProtected(g,blocker)&&g.time>e.specialUntil){
    e.contactTime+=delta;
    if(e.contactTime>= (e.trait==="hack"?4:3)){
     blocker.confusedUntil=g.time+8;e.specialUntil=g.time+13;e.contactTime=0;effect(g,"bribe",e.lane,e.x,"ЗАГРОЗА ДОСТУПУ");
    }
   }
   if(e.trait==="suicide"){const dealt=Math.min(blocker.shieldHp,150);blocker.shieldHp-=dealt;blocker.hp-=150-dealt;removeEnemy(g,e);return;}
   let dmg=e.trait==="giant"?2500:100*delta;
   if(blocker.shieldHp>0){const absorbed=Math.min(blocker.shieldHp,dmg);blocker.shieldHp-=absorbed;dmg-=absorbed;}
   blocker.hp-=dmg;
   if(blocker.kind==="wall"&&blocker.id==="notary"&&e.scheme==="forgery")damageEnemy(g,e,10*delta,"notary");
   if(blocker.hp<=0){g.defenders.splice(g.defenders.indexOf(blocker),1);g.defenderLosses++;effect(g,"down",blocker.lane,blocker.col+.5,"ЗАХИСНИК");}
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
 for(const t of [...g.tokens]){t.ttl-=delta;if(t.ttl<=0){g.tokens.splice(g.tokens.indexOf(t),1);}}
 for(const fx of [...g.effects]){fx.ttl-=delta;if(fx.ttl<=0)g.effects.splice(g.effects.indexOf(fx),1);}
 if(g.time>=g.nextSky){
  if(!g.level.special.conveyor)createToken(g,Math.floor(Math.random()*5),Math.floor(Math.random()*9));
  g.nextSky+=g.level.special.blackout?18:10;
 }
 while(g.spawned<g.plan.length&&g.plan[g.spawned].time<=g.time){
  const action=g.plan[g.spawned++];
  g.stageWave=Math.max(g.stageWave,action.wave);
  spawn(g,action.id,action.lane);
  if(action.id==="usb"&&g.level.stage>=7){
   for(let i=1;i<5;i++)spawn(g,"usb",action.lane,9.3+i*.32);
  }
 }
 for(const d of [...g.defenders])attack(g,d,delta);
 for(const e of [...g.enemies])if(g.enemies.includes(e))enemyTurn(g,e,delta);
 advanceProjectiles(g,delta);
 if(g.finalSurvivalUntil&&g.time<g.finalSurvivalUntil&&g.time>=g.nextSurvivalSpawn){
  const ids=["schemer","phisher","briber","alimony","caller","usb"];
  const ix=Math.floor((g.finalSurvivalUntil-g.time)*2)%ids.length;
  spawn(g,ids[Math.abs(ix)],Math.floor(Math.random()*5),9.3);
  g.nextSurvivalSpawn=g.time+2.6;
 }
 if(g.phase==="playing"&&g.spawned===g.plan.length&&g.enemies.length===0&&g.projectiles.length===0&&g.time>=g.plan[g.plan.length-1].time+2){
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
