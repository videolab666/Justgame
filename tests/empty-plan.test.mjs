import test from "node:test";
import assert from "node:assert/strict";
import {getLevel} from "../src/data.js";
import {makeGame,tick,spawn,damageEnemy} from "../src/engine.js";
test("an empty scripted plan remains safe even after its final enemy is removed",()=>{
 const g=makeGame(getLevel(0,1),["registrar"]);
 g.plan=[];
 const e=spawn(g,"schemer",2,3);
 damageEnemy(g,e,500,"registry");
 for(let i=0;i<40;i++)tick(g,.1);
 assert.equal(g.phase,"playing");
 assert.equal(g.enemies.length,0);
});
