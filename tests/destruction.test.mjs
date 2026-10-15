import test from "node:test";
import assert from "node:assert/strict";
import {getLevel} from "../src/data.js";
import {makeGame,place,removeDefender,advanceFallen} from "../src/engine.js";

test("destroyed defenders leave a short, bounded cosmetic falling silhouette",()=>{
 const g=makeGame(getLevel(0,3),["registrar"]);g.seal=10000;
 assert.equal(place(g,"registrar",2,2).ok,true);
 const defender=g.defenders[0];
 assert.ok(removeDefender(g,defender));
 assert.equal(g.defenders.length,0);
 assert.equal(g.defenderLosses,1);
 assert.equal(g.fallen.length,1);
 assert.equal(g.fallen[0].id,"registrar");
 assert.equal(g.fallen[0].col,2);
 advanceFallen(g,.4);
 assert.ok(g.fallen[0].age>.3);
 advanceFallen(g,.4);
 assert.equal(g.fallen.length,0);
});
test("falling after a raider seizure does not alter saved lock contents",()=>{
 const g=makeGame(getLevel(0,3),["registrar"]);g.seal=1000;
 place(g,"registrar",2,3);
 const defender=g.defenders[0];g.locks.push({lane:2,col:3,lost:{...defender}});
 removeDefender(g,defender,"seize");
 assert.equal(g.locks[0].lost.id,"registrar");
 assert.equal(g.fallen[0].reason,"seize");
 assert.equal(removeDefender(g,defender),false);
});
test("reduced-motion mode does not create ghost sprite effects",()=>{
 const g=makeGame(getLevel(0,3),["registrar"],"normal",{reducedMotion:true});
 g.seal=1000;place(g,"registrar",2,2);
 removeDefender(g,g.defenders[0]);
 assert.equal(g.fallen.length,0);
});
test("mobile-safe cap limits simultaneous unit destruction animations",()=>{
 const g=makeGame(getLevel(0,3),["registrar"]);g.seal=1e8;
 for(let i=0;i<35;i++){
  const d={id:"registrar",col:i%9,lane:i%5};g.defenders.push(d);removeDefender(g,d);
 }
 assert.equal(g.fallen.length,25);
});
