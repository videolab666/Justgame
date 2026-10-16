import test from "node:test";
import assert from "node:assert/strict";
import {getLevel} from "../src/data.js";
import {makeGame,damageEnemy,spawn} from "../src/engine.js";
test("shield absorbs a real hit but generates visible feedback",()=>{
 const g=makeGame(getLevel(0,4),["registrar"]);
 const e=spawn(g,"poa",2,7);
 const hp=e.hp,shield=e.shield;
 const done=damageEnemy(g,e,20,"registry");
 assert.equal(done,0);
 assert.equal(e.hp,hp);
 assert.ok(e.shield<shield);
 assert.ok(g.effects.some(x=>x.kind==="shield-impact"));
});
test("zero-damage boss phases show throttled immune visual instead of apparent misses",()=>{
 const g=makeGame(getLevel(1,10),["registrar"]);
 const boss=spawn(g,"boss",2,7);
 damageEnemy(g,boss,20,"registry");
 assert.ok(g.effects.some(x=>x.kind==="immune"));
 const count=g.effects.filter(x=>x.kind==="immune").length;
 damageEnemy(g,boss,20,"registry");
 assert.equal(g.effects.filter(x=>x.kind==="immune").length,count);
});
