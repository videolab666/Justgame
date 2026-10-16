import test from "node:test";
import assert from "node:assert/strict";
import {getLevel,UNITS} from "../src/data.js";
import {getThreat,getEncounterThreats,getCounterAdvice} from "../src/tactics.js";

test("legend derives attackers from real encounter and includes boss parts",()=>{
 const lvl=getLevel(3,10),game={plan:[{id:"hacker"},{id:"usb"}],enemies:[{id:"boss"}]};
 const ids=getEncounterThreats(lvl,game);
 for(const x of ["boss","hydra_phish","hydra_call","hydra_malware","hacker","usb"])assert.ok(ids.includes(x));
 assert.equal(getThreat("boss",lvl).name,lvl.bossData.name);
});
test("air and underground counters follow engine targeting",()=>{
 const air=getCounterAdvice("bankrupt",{deck:["trustee","registrar","expert"]});
 assert.ok(air.recommended.every(u=>["trustee","expert","apostille"].includes(u.id)));
 const dig=getCounterAdvice("burrower",{deck:["executor","mine","registrar"]});
 assert.ok(dig.recommended.every(u=>["executor","mine"].includes(u.id)));
});
test("Hydra requires digital finisher and recommends 2FA",()=>{
 const advice=getCounterAdvice("hydra_phish",{level:getLevel(3,10),deck:["twofactor","expert"],owned:UNITS});
 assert.equal(advice.recommended[0].id,"twofactor");
 assert.ok(advice.recommended.every(u=>u.tool==="digital"));
 assert.match(advice.note,/виснажує/);
 assert.match(advice.note,/2FA/);
});
test("boss mechanic notes are world-specific",()=>{
 for(const [w,frag] of [[0,"Заборону"],[1,"сейфи"],[2,"щупалець"],[3,"2FA"]])
  assert.ok(getCounterAdvice("boss",{level:getLevel(w,10)}).note.includes(frag));
});
test("unit availability labels are accurate",()=>{
 const info=getCounterAdvice("schemer",{deck:["registrar"],owned:["registrar","senior"]});
 assert.equal(info.recommended.find(u=>u.id==="registrar").state,"deck");
 assert.equal(info.recommended.find(u=>u.id==="senior").state,"owned");
 assert.equal(info.recommended.find(u=>u.id==="expert").state,"locked");
});
test("neutral debtors must not be targeted by regular weapons",()=>{
 const info=getCounterAdvice("nonpayer");
 assert.ok(info.recommended.every(u=>u.id==="legal_aid"));
 assert.match(info.note,/Нейтральний/);
});
test("tips include stealth detection and raider restoration",()=>{
 assert.ok(getCounterAdvice("broker").support.includes("notification"));
 assert.ok(getCounterAdvice("raider").support.includes("commission"));
 assert.equal(getCounterAdvice("absent"),null);
});
test("lane preview matches the battle plan and skips ordinary schemers",async()=>{
 const {threatLanes,lanesLabel}=await import("../src/tactics.js");
 const {makeGame}=await import("../src/engine.js");
 const level=getLevel(1,6),g=makeGame(level,["registrar"]);
 const lanes=threatLanes(level,g.plan);
 assert.equal(lanes.schemer,undefined);
 for(const a of g.plan)if(a.id!=="schemer")assert.ok(lanes[a.id].includes(a.lane),a.id);
 assert.ok(Object.values(lanes).every(ls=>ls.length<=2));
 assert.equal(lanesLabel([1,3]),"Ряди 2 і 4");
 assert.equal(lanesLabel([2]),"Ряд 3");
 const boss=threatLanes(getLevel(1,10),makeGame(getLevel(1,10),["registrar"]).plan);
 assert.deepEqual(boss.boss,[2]);
 assert.deepEqual(boss.offshore_safe,[0,1,3,4]);
});
