import test from "node:test";
import assert from "node:assert/strict";
import {getLevel,ENEMY_BY_ID} from "../src/data.js";
import {makeGame,makeWavePlan,tick,spawn,nextWaveIn,waveStatus,levelBudget,FIRST_SPAWN} from "../src/engine.js";

const ALL=[];for(let w=0;w<4;w++)for(let s=1;s<=10;s++)ALL.push(getLevel(w,s));

test("first spawn leaves time to place cards (8 s tutorial, 18 s otherwise)",()=>{
 for(const level of ALL){
  const first=makeWavePlan(level)[0].time;
  assert.equal(first,level.stage===1?FIRST_SPAWN.tutorial:FIRST_SPAWN.normal,level.id);
 }
});
test("opening wave never needs a specialised counter (threat <= 2)",()=>{
 for(const level of ALL){
  const opening=makeWavePlan(level).filter(a=>a.wave===1);
  assert.ok(opening.every(a=>(ENEMY_BY_ID[a.id]?.threat??1)<=2),level.id);
 }
});
test("level threat budget is spent and grows within each world",()=>{
 for(let w=0;w<4;w++){
  const plain=[2,3,5,6,8,9].map(s=>getLevel(w,s)).filter(l=>!l.special.blackout);
  for(let i=1;i<plain.length;i++)assert.ok(levelBudget(plain[i])>=levelBudget(plain[i-1]),plain[i].id);
 }
 const plan=makeWavePlan(getLevel(0,9));
 const spent=plan.reduce((a,x)=>a+(ENEMY_BY_ID[x.id]?.threat||0),0);
 assert.ok(Math.abs(spent-levelBudget(getLevel(0,9)))<=2);
});
test("waves grow towards the final 'big scheme' wave",()=>{
 const plan=makeWavePlan(getLevel(0,9));
 const size=w=>plan.filter(a=>a.wave===w).length;
 assert.ok(size(4)>size(1));
});
test("special threats keep to at most two lanes per level",()=>{
 for(const level of ALL){
  const lanes={};
  for(const a of makeWavePlan(level))if(a.id!=="schemer"&&a.id!=="boss"&&a.id!=="mini_boss")(lanes[a.id]??=new Set()).add(a.lane);
  for(const [id,set] of Object.entries(lanes))assert.ok(set.size<=2,level.id+" "+id);
 }
});
test("a cleared field pulls the next wave in after a short lull",()=>{
 const g=makeGame(getLevel(0,1),["registrar"]);g.nextSky=1e9;
 while(!g.stageWave)tick(g,.1);
 const waiting=nextWaveIn(g);
 g.enemies=[];
 const before=g.plan.find(a=>a.wave===2).time;
 for(let i=0;i<40;i++)tick(g,.1);
 assert.ok(g.plan.find(a=>a.wave===2).time<before,"wave 2 came sooner");
 assert.ok(waiting>10,"countdown to wave 2 is shown");
});
test("the next wave is never pushed later and is announced in the HUD",()=>{
 const g=makeGame(getLevel(0,2),["registrar"]);g.nextSky=1e9;
 assert.match(waveStatus(g),/перша через 18 с/);
 const before=g.plan.map(a=>a.time);
 for(let i=0;i<100;i++)tick(g,.1);
 g.plan.forEach((a,i)=>assert.ok(a.time<=before[i]));
});
test("Baron summons a world-1 threat in phase 2, not a hacker",()=>{
 const g=makeGame(getLevel(0,10),["registrar"]);g.plan=[];g.nextSky=1e9;
 const boss=spawn(g,"boss",2,8);boss.hp=boss.maxHp*.6;boss.phase=2;
 tick(g,.05);
 assert.ok(g.enemies.some(e=>e.id==="raider"));
 assert.ok(!g.enemies.some(e=>e.id==="hacker"));
});
test("result-screen rewards match the level that actually unlocks the card",async()=>{
 const {UNLOCK_REWARDS,UNIT_BY_ID,UNITS}=await import("../src/data.js");
 for(const [lvl,id] of Object.entries(UNLOCK_REWARDS))assert.equal(UNIT_BY_ID[id].unlock,lvl,id);
 // ...and every unlockable card is announced somewhere.
 for(const u of UNITS)if(u.unlock!=="start")assert.equal(UNLOCK_REWARDS[u.unlock],u.id,u.id);
});
test("2FA keeps full pulse rate in a blackout and ignores phishing",async()=>{
 const {place}=await import("../src/engine.js");
 const g=makeGame(getLevel(3,4),["twofactor"]);g.plan=[];g.seal=1000;g.nextSky=1e9;
 assert.equal(g.level.special.blackout,true);
 place(g,"twofactor",2,5);
 const phisher=spawn(g,"phisher",2,7.5);
 const start=phisher.hp;
 for(let i=0;i<150&&g.enemies.includes(phisher);i++)tick(g,.1);
 const trap=g.defenders.find(d=>d.kind==="trap");
 assert.ok(!g.enemies.includes(phisher)||phisher.hp<start-150,"trap dealt full damage");
 assert.ok(trap.disabledUntil<=0,"phishing never disabled 2FA");
});
test("the newest threat opens wave 2 even when it costs more than that wave",()=>{
 const plan=makeWavePlan(getLevel(2,5));
 assert.equal(plan.find(a=>a.wave===2).id,"lustrated");
});
test("the paper golem only ever comes in the final wave",()=>{
 for(const level of ALL){
  const plan=makeWavePlan(level);
  for(const a of plan)if(a.id==="golem")assert.equal(a.wave,level.waves,level.id);
 }
});
test("the owl reminds to collect seals after two fade away in a row",async()=>{
 const {MISSED_SEAL_HINT,collectToken}=await import("../src/engine.js");
 const g=makeGame(getLevel(0,3),["registrar"]);g.plan=[];g.nextSky=1e9;
 g.tokens.push({uid:901,lane:0,col:0,ttl:.1,value:25});
 tick(g,.2);
 assert.notEqual(g.lastHint,MISSED_SEAL_HINT,"one miss is forgiven");
 g.tokens.push({uid:902,lane:0,col:0,ttl:.1,value:25});
 tick(g,.2);
 assert.equal(g.lastHint,MISSED_SEAL_HINT);
 g.lastHint="x";
 g.tokens.push({uid:903,lane:0,col:0,ttl:.1,value:25},{uid:904,lane:0,col:0,ttl:.1,value:25});
 tick(g,.2);
 assert.equal(g.lastHint,"x","not repeated within the cooldown");
 g.tokens.push({uid:905,lane:0,col:0,ttl:5,value:25});
 assert.equal(collectToken(g,905),true);
 assert.equal(g.missStreak,0,"collecting resets the streak");
});
