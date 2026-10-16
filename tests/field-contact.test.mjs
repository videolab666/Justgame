import test from "node:test";
import assert from "node:assert/strict";
import {getLevel,ENEMIES} from "../src/data.js";
import {makeGame,place,spawn,tick,useGuard,damageEnemy,CONTACT} from "../src/engine.js";

// Browser frame rate: contact bugs only showed up with small, realistic steps.
const DT=1/60;
function field(world,stage,deck){
 const g=makeGame(getLevel(world,stage),deck);
 g.plan=[];g.seal=1e5;g.nextSky=1e9;
 return g;
}
function run(g,seconds,stop=()=>false){
 for(let t=0;t<seconds;t+=DT){tick(g,DT);if(stop())return t;}
 return seconds;
}

test("an armed mine explodes on the enemy that stops to bite it",()=>{
 const g=field(1,4,["mine"]);
 place(g,"mine",2,4);g.defenders[0].placedAt=-20;
 const e=spawn(g,"schemer",2,6);
 run(g,20,()=>!g.enemies.includes(e));
 assert.equal(g.enemies.includes(e),false,"schemer should be arrested");
 assert.ok(e.x<=4.5+CONTACT+.01);
});
test("a mine ignores peaceful debtors and flying bankrupts",()=>{
 const g=field(1,4,["mine"]);
 place(g,"mine",2,4);g.defenders[0].placedAt=-20;
 const calm=spawn(g,"nonpayer",2,5.2),air=spawn(g,"bankrupt",2,5.3);
 run(g,4);
 assert.equal(g.defenders.length,1);
 assert.equal(g.enemies.includes(calm),true);
 assert.equal(g.enemies.includes(air),true);
});
test("2FA is a floor trap: cyber enemies walk over it and take damage",()=>{
 const g=field(3,4,["twofactor"]);
 place(g,"twofactor",2,4);
 const e=spawn(g,"hacker",2,5.3);const hp=e.hp;
 run(g,10);
 assert.ok(e.hp<hp,"hacker must be damaged by 2FA");
 assert.equal(g.defenders[0].hp,g.defenders[0].maxHp,"trap is not chewed");
 assert.ok(e.x<4,"trap does not block the path");
});
test("every walking enemy is stopped by a unit at any frame rate",()=>{
 for(const en of ENEMIES){
  if(["flying","burrow","neutral","jump","disguised_jump"].includes(en.trait))continue;
  for(const dt of [1/60,1/30,.1]){
   const g=field(1,3,["notary_office"]);
   place(g,"notary_office",2,4);
   const d=g.defenders[0];d.hp=d.maxHp=1e9;
   const e=spawn(g,en.id,2,9.3);e.hp=e.maxHp=1e9;e.reveal=true;
   let minX=99;
   for(let t=0;t<60;t+=dt){tick(g,dt);if(!g.enemies.includes(e))break;minX=Math.min(minX,e.x);}
   assert.ok(minX>4.5-CONTACT,`${en.id} passed the office at dt=${dt} (x=${minX})`);
  }
 }
});
test("the paper golem winds up instead of erasing a unit in one frame",()=>{
 const g=field(1,4,["notary_office"]);
 place(g,"notary_office",2,5);
 spawn(g,"golem",2,5.5+CONTACT-.01);
 const t=run(g,20,()=>!g.defenders.length);
 assert.ok(t>4,"8000 HP office should survive several seconds, got "+t.toFixed(2));
});
test("a raider needs contact time to seize and cannot seize a notary",()=>{
 const g=field(0,7,["registrar"]);
 place(g,"registrar",2,3);
 const e=spawn(g,"raider",2,3.5+CONTACT-.01);e.hp=e.maxHp=1e6;
 run(g,1.5);
 assert.equal(g.locks.length,0,"no instant seizure");
 run(g,1.5);
 assert.equal(g.locks.length,1);
 const n=field(0,7,["notary"]);
 place(n,"notary",2,3);
 const r=spawn(n,"raider",2,3.5+CONTACT-.01);r.hp=r.maxHp=1e6;
 run(n,6);
 assert.equal(n.locks.length,0);
 assert.equal(n.defenders.length,1);
});
test("a stamp hits the enemy in front, not one that already jumped behind",()=>{
 const g=field(1,4,["registrar"]);
 place(g,"registrar",2,3);
 const back=spawn(g,"schemer",2,2.85),front=spawn(g,"schemer",2,3.3);
 for(const e of [back,front]){e.speed=0;e.hp=e.maxHp=1e6;}
 run(g,3);
 assert.ok(front.hp<1e6);
 assert.equal(back.hp,1e6);
});
test("lane guards never mow a boss; a boss at the house loses the level",()=>{
 for(const world of [1,2,3]){
  const g=field(world,10,["registrar"]);
  const boss=spawn(g,"boss",2,.4);boss.speed=1;
  for(const part of g.enemies.filter(x=>x!==boss))g.enemies.splice(g.enemies.indexOf(part),1);
  run(g,6,()=>g.phase!=="playing");
  assert.equal(g.phase,"lost","world "+(world+1));
  assert.equal(g.enemies.includes(boss),true);
 }
});
test("the Baron's final guard works even if the lane guard was already spent",()=>{
 const g=field(0,10,["registrar"]);
 const boss=spawn(g,"boss",2,6);
 g.usedGuards[2]=true;boss.hp=boss.maxHp*.3;boss.phase=3;g.bossGuardReady=true;
 assert.equal(useGuard(g,2),true);
 assert.equal(g.enemies.includes(boss),false);
 assert.equal(useGuard(g,2),false,"only once");
});
test("a split minion in a neighbouring lane appears in front of its defenders",()=>{
 const g=field(2,7,["notary"]);
 place(g,"notary",1,5);
 const c=spawn(g,"conflict",2,3);
 damageEnemy(g,c,1e6,"integrity");
 const minion=g.enemies.find(e=>e.lane===1&&e.id==="schemer");
 assert.ok(minion,"split spawns a schemer in lane 1");
 assert.ok(minion.x>=5.5+CONTACT-.05,"minion must not appear behind the notary, x="+minion.x);
});
test("jumpers leap over one unit smoothly instead of teleporting through it",()=>{
 for(const id of ["alimony","broker"]){
  const g=field(1,4,["registrar"]);
  g.cooldowns.registrar=0;place(g,"registrar",2,4);
  g.cooldowns.registrar=0;place(g,"registrar",2,2);
  for(const d of g.defenders)d.hp=d.maxHp=1e9;
  const e=spawn(g,id,2,6);e.hp=e.maxHp=1e9;
  let maxStep=0,airborne=0,prev=e.x;
  for(let t=0;t<15;t+=DT){
   tick(g,DT);
   maxStep=Math.max(maxStep,prev-e.x);prev=e.x;
   if(e.lift>0)airborne+=DT;
  }
  assert.ok(maxStep<.05,`${id} moved ${maxStep.toFixed(3)} cells in one frame`);
  assert.ok(airborne>.5,`${id} jump must be visible (${airborne.toFixed(2)} s)`);
  // Landed behind the first unit, then stopped by the second one.
  assert.ok(e.x<4.5-.6&&e.x>2.5-CONTACT,`${id} x=${e.x}`);
 }
});
test("notification tears the mask off a broker with a visible effect",()=>{
 const g=field(0,4,["notification"]);
 place(g,"notification",2,4);
 const e=spawn(g,"broker",2,6.4);e.speed=0;
 assert.equal(e.reveal,false);
 tick(g,DT);
 assert.equal(e.reveal,true);
 assert.ok(g.effects.some(x=>x.kind==="unmask"));
});
test("an expert's beam unmasks a fake heir, who calls in two witnesses",()=>{
 const g=field(2,4,["expert"]);
 place(g,"expert",2,4);
 const e=spawn(g,"heir",2,6.5);e.speed=0;e.hp=e.maxHp=1e6;
 run(g,1);
 assert.equal(e.reveal,true);
 assert.equal(g.enemies.filter(x=>x.id==="schemer").length,2);
});
test("lane guard is a roller: it annuls the lane as it reaches each enemy",async()=>{
 const {ROLLER_SPEED}=await import("../src/engine.js");
 const g=field(0,5,["registrar"]);
 const near=spawn(g,"schemer",2,.02),far=spawn(g,"schemer",2,6),other=spawn(g,"schemer",1,.5);
 tick(g,.05);
 assert.equal(g.usedGuards[2],true);
 assert.equal(g.enemies.includes(near),false,"the breaching enemy goes at once");
 assert.equal(g.enemies.includes(far),true,"far enemies wait for the roller");
 assert.equal(g.rollers.length,1);
 for(let i=0;i<Math.ceil(6/ROLLER_SPEED/.05)+2;i++)tick(g,.05);
 assert.equal(g.enemies.includes(far),false,"rolled over");
 assert.equal(g.enemies.includes(other),true,"other lanes untouched");
 for(let i=0;i<120;i++)tick(g,.05);
 assert.equal(g.rollers.length,0,"roller and its imprint are cleaned up");
});
test("the roller does not flatten a boss",()=>{
 const g=field(1,10,["registrar"]);
 const boss=spawn(g,"boss",2,3);
 g.enemies=g.enemies.filter(e=>e===boss);
 spawn(g,"schemer",2,.02);
 for(let i=0;i<60;i++)tick(g,.05);
 assert.equal(g.enemies.includes(boss),true);
});
