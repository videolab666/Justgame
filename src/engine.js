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
 return list.sort((a,b)=>a.time-b.time);
}
export function makeGame(level,deck,mode="normal",settings={}){
 return {
  level,deck:[...deck],mode,settings,phase:"playing",time:0,elapsed:0,seal:mode==="young"?300:level.startingSeals,
  defenders:[],enemies:[],tokens:[],locks:[],effects:[],plan:makeWavePlan(level),
  spawned:0,serial:1,nextSky:7,cooldowns:Object.fromEntries(deck.map(id=>[id,0])),
  usedGuards:[false,false,false,false,false],breaches:0,defenderLosses:0,created:0,kills:0,
  stageWave:0,maxWave:level.waves,bossGuardReady:false,bossGuardUsed:false,
  lastThreat:null,lastHint:level.tutorial||"Підбирайте інструменти до типу правової загрози.",
  miniBonus:0
 };
}
const uid=g=>g.serial++;
function effect(g,kind,lane,x,text=""){g.effects.push({id:uid(g),kind,lane,x,ttl:.7,text});if(g.effects.length>35)g.effects.shift();}
export function spawn(g,id,lane,x=9.3){
 let data=id==="boss"?g.level.bossData:ENEMY_BY_ID[id]; if(!data)return null;
 const hpMod=g.mode==="young"?.6:g.mode==="expert"?1.3:1;
 const enemy={uid:uid(g),id,name:data.name,icon:data.icon,scheme:data.scheme,
 hp:data.hp*hpMod,maxHp:data.hp*hpMod,shield:data.shield||0,maxShield:data.shield||0,
 speed:(data.speed||.28)*(g.mode==="young"?.6:g.mode==="expert"?1.15:1),lane,x,
 trait:data.trait||(id==="boss"?"boss":"basic"),reveal:!["disguised_jump","disguised_split"].includes(data.trait),
 frozenUntil:0,stunUntil:0,specialUntil:0,contactTime:0,jumped:false,revived:false,
 spawnedMinions:false,lastHitTool:null,phase:1,tip:data.tip,air:id==="bankrupt"||id==="boss"&&g.level.world===1&&false};
 g.enemies.push(enemy);g.lastThreat=enemy;effect(g,"spawn",lane,x,"!");
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
 if(e.trait==="neutral")return false;
 if(e.trait==="flying"&&!["air","sniper","global"].includes(d.kind))return false;
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
 hp:u.hp,maxHp:u.hp,shieldHp:0,timer:0,placedAt:g.time,disabledUntil:0,confusedUntil:0});
 effect(g,"plant",lane,col+.5,"+");
 return {ok:true};
}
function removeEnemy(g,e,silent=false){
 const idx=g.enemies.indexOf(e);if(idx>=0)g.enemies.splice(idx,1);
 if(!silent){g.kills++;effect(g,"hit",e.lane,e.x,"АНУЛЬОВАНО");}
 g.locks=g.locks.filter(l=>l.enemyUid!==e.uid);
}
export function damageEnemy(g,e,raw,tool=null,extra=1){
 if(!g.enemies.includes(e))return 0;
 let mult=typeMultiplier(tool,e.scheme,g.mode);
 if(e.id==="boss"){
  if(g.level.world===2&&tool!=="integrity")mult*=.5;
  if(g.level.world===1&&e.phase===2&&!["enforcement","expert"].includes(tool))mult*=.2;
  if(g.level.world===0&&e.hp<=e.maxHp*.35&&!g.bossGuardUsed)mult=0;
 }
 let n=Math.max(0,raw*mult*extra);
 if(e.shield>0 && tool!=="enforcement"){const absorbed=Math.min(e.shield,n);e.shield-=absorbed;n-=absorbed;}
 e.hp-=n;e.lastHitTool=tool;
 if(n>0&&Math.random()<.24)effect(g,"damage",e.lane,e.x,mult>=1.5?"✔ ×"+mult:mult<1?"×"+mult:"");
 if(e.id==="boss"){
  const prev=e.phase;e.phase=e.hp>e.maxHp*.7?1:e.hp>e.maxHp*.35?2:3;
  if(e.phase!==prev){
   g.lastHint=`⚠️ ${e.name}: фаза ${e.phase}. Змінюйте тактику!`;
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
  for(const lane of [e.lane-1,e.lane+1])if(g.level.activeLanes.includes(lane))spawn(g,"schemer",lane,e.x);
 }
 if(e.trait==="disguised_split"&&!e.spawnedMinions){
  for(let j=0;j<2;j++)spawn(g,"schemer",e.lane,e.x+(.2*j));
 }
 if(e.id==="bankrupt")createToken(g,e.lane,Math.floor(e.x));
 removeEnemy(g,e);
 return n;
}
export function useGuard(g,lane){
 if(g.phase!=="playing"||g.usedGuards[lane]||!g.level.activeLanes.includes(lane))return false;
 if(g.level.boss&&g.level.world===0){
  const boss=g.enemies.find(e=>e.id==="boss"&&e.lane===lane);
  if(!boss||boss.phase<3)return false;
  g.bossGuardUsed=true;damageEnemy(g,boss,boss.maxHp,"registry",3);
 }
 g.usedGuards[lane]=true;
 for(const e of [...g.enemies])if(e.lane===lane)removeEnemy(g,e);
 effect(g,"guard",lane,3.5,"ЗАБОРОНА");
 return true;
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
 const e=candidates[0];if(!e)return;
 let raw=d.kind==="intern"&&g.time-d.placedAt>=60?20:spec.damage;
 if(d.kind==="slow"){
  e.frozenUntil=Math.max(e.frozenUntil,g.time+(e.scheme==="debt"?3:6));
 }
 if(d.kind==="sniper"&&!e.reveal){e.reveal=true;}
 if(d.kind==="splash"){
  for(const target of [...g.enemies])if(Math.abs(target.lane-e.lane)<=1&&Math.abs(target.x-e.x)<=1.25)damageEnemy(g,target,raw,d.tool,bonus);
 }else damageEnemy(g,e,raw,d.tool,bonus);
 effect(g,"shot",e.lane,e.x,d.kind==="slow"?"ОБМЕЖЕНО":d.kind==="sniper"?"ЕКСПЕРТИЗА":"ПЕРЕВІРЕНО");
 d.timer=spec.interval||2;
}
function defeat(g,e){
 g.lastThreat=e;g.breaches++;
 if(e.trait==="neutral"){g.seal+=50;removeEnemy(g,e,true);return;}
 if(!g.usedGuards[e.lane]){useGuard(g,e.lane);return;}
 if(g.mode==="young"){removeEnemy(g,e);return;}
 g.phase="lost";g.lastHint=`Прорвався: ${e.name}. ${e.tip||"Спробуйте інший інструмент."}`;
}
function enemyTurn(g,e,delta){
 if(e.hp<=0)return;
 const rowHaste=g.enemies.some(x=>x!==e&&x.lane===e.lane&&x.trait==="haste")?1.3:1;
 let move=(e.speed/4.5)*delta*rowHaste;
 if(g.time<e.frozenUntil)move*=e.scheme==="debt"?.02:.5;
 if(g.time<e.stunUntil)move=0;
 const nearby=g.defenders.filter(d=>d.lane===e.lane&&Math.abs(d.col+.5-e.x)<.65).sort((a,b)=>b.col-a.col);
 const blocker=nearby[0];
 if(e.trait==="giant"&&!e.spawnedMinions&&e.hp<e.maxHp*.5){
  e.spawnedMinions=true;spawn(g,"schemer",e.lane,Math.max(.9,e.x-2));
 }
 if(blocker&&!["burrow","flying","neutral"].includes(e.trait)){
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
 if(g.phase==="playing"&&g.spawned===g.plan.length&&g.enemies.length===0&&g.time>=g.plan[g.plan.length-1].time+2){g.phase="won";}
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
