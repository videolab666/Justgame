import test from "node:test";
import assert from "node:assert/strict";
import {getLevel,unlockedUnits,UNITS,ENEMIES,levelUnlocked} from "../src/data.js";
import {typeMultiplier,makeWavePlan,makeGame,place,tick,spawn,damageEnemy,useGuard,scoreStars,collectAll} from "../src/engine.js";
test("catalog and campaign include GDD roster and 40 stages",()=>{
 assert.equal(UNITS.length,24);assert.equal(ENEMIES.length,19);
 for(let w=0;w<4;w++)for(let n=1;n<=10;n++)assert.equal(getLevel(w,n).id,`${w+1}-${n}`);
});
test("type matchup follows educational matrix",()=>{
 assert.equal(typeMultiplier("registry","forgery"),2);
 assert.equal(typeMultiplier("digital","cyber"),2);
 assert.equal(typeMultiplier("notary","cyber"),.5);
 assert.equal(typeMultiplier("notary","cyber","expert"),.25);
});
test("early-world counters unlock before disguised first encounter",()=>{
 const done={"1-1":3,"1-2":3,"1-3":3};
 assert.equal(unlockedUnits(done).some(x=>x.id==="notification"),true);
 assert.equal(levelUnlocked(0,4,done),true);
 assert.equal(levelUnlocked(0,5,done),false);
});
test("cannot place on inactive row or occupied tile",()=>{
 const g=makeGame(getLevel(0,1),["registrar"]);
 assert.equal(place(g,"registrar",0,2).ok,false);
 assert.equal(place(g,"registrar",2,2).ok,true);
 g.cooldowns.registrar=0;
 assert.equal(place(g,"registrar",2,2).ok,false);
});
test("first stage can be won by a basic registrar",()=>{
 const g=makeGame(getLevel(0,1),["registrar"],"normal",{autoCollect:true});
 assert.equal(place(g,"registrar",2,2).ok,true);
 for(let i=0;i<900&&g.phase==="playing";i++)tick(g,.1);
 assert.equal(g.phase,"won");
 assert.equal(scoreStars(g),3);
});
test("neutral debtor does not count as a breach or spend a guard",()=>{
 const g=makeGame(getLevel(1,3),["registrar"]);
 const e=spawn(g,"nonpayer",2,.02);
 tick(g,.1);
 assert.equal(g.breaches,0);
 assert.equal(g.usedGuards[2],false);
 assert.equal(g.enemies.includes(e),false);
});
test("shield absorbs direct damage and registered case can be restored",()=>{
 const g=makeGame(getLevel(0,7),["registrar","shield","commission"]);
 g.seal=1000;
 place(g,"registrar",2,3);place(g,"shield",2,3);
 const d=g.defenders[0];
 assert.equal(d.shieldHp,3000);
 g.locks.push({lane:1,col:3,enemyUid:99,lost:{...d,lane:1,col:3}});
 assert.equal(place(g,"commission",1,3).ok,true);
 assert.equal(g.locks.length,0);
 assert.equal(g.defenders.length,2);
});
test("the Baron cannot loop forever at the house and manual guard wins phase three",()=>{
 const level=getLevel(0,10);
 const game=makeGame(level,["registrar"]);
 const e=spawn(game,"boss",2,.02);
 tick(game,.1);
 assert.equal(game.phase,"lost");
 const game2=makeGame(level,["registrar"]);
 const e2=spawn(game2,"boss",2,4);
 e2.hp=e2.maxHp*.3;e2.phase=3;
 assert.equal(useGuard(game2,2),true);
 assert.equal(game2.enemies.some(x=>x.id==="boss"),false);
 assert.equal(game2.bossGuardUsed,true);
});
test("world three miniboss appears in its stage wave plan",()=>{
 const plan=makeWavePlan(getLevel(2,5));
 assert.equal(plan.some(x=>x.id==="mini_boss"),true);
});

test("lane guards trigger automatically once; manual button is boss-only",()=>{
 const g=makeGame(getLevel(0,2),["registrar"]);
 assert.equal(useGuard(g,2),false);
 spawn(g,"schemer",2,.02);
 tick(g,.1);
 assert.equal(g.usedGuards[2],true);
 assert.equal(g.phase,"playing");
 spawn(g,"schemer",2,.02);
 tick(g,.1);
 assert.equal(g.phase,"lost");
});
